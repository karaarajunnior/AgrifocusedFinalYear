import express from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import blockchainService from "../services/blockchainService.js";
import { requireVerified } from "../middleware/verified.js";

const prisma = new PrismaClient();
const router = express.Router();

// Create order (buyers only)
router.post(
	"/",
	authenticateToken,
	requireRole(["BUYER"]),
	requireVerified,
	[
		body("productId").isString(),
		body("quantity").isInt({ min: 1 }),
		body("deliveryDate").optional().isISO8601(),
		body("notes").optional().trim().isLength({ max: 2000 }).escape(),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { productId, quantity, deliveryDate, notes } = req.body;

			// Get product details
			const product = await prisma.product.findUnique({
				where: { id: productId },
				include: { farmer: true },
			});

			if (!product) {
				return res.status(404).json({ error: "Product not found" });
			}

			if (!product.available) {
				return res.status(400).json({ error: "Product is not available" });
			}

			if (product.quantity < quantity) {
				return res
					.status(400)
					.json({ error: "Insufficient quantity available" });
			}

			if (product.farmerId === req.user.id) {
				return res.status(400).json({ error: "Cannot order your own product" });
			}

			const totalPrice = product.price * quantity;

			// Create order
			const order = await prisma.order.create({
				data: {
					quantity,
					totalPrice,
					deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
					notes,
					buyerId: req.user.id,
					farmerId: product.farmerId,
					productId,
				},
				include: {
					product: {
						select: {
							name: true,
							price: true,
							unit: true,
							category: true,
						},
					},
					farmer: {
						select: {
							name: true,
							phone: true,
							location: true,
						},
					},
				},
			});

			// Update product quantity
			await prisma.product.update({
				where: { id: productId },
				data: {
					quantity: { decrement: quantity },
				},
			});

			// Log analytics
			await prisma.userAnalytics.create({
				data: {
					userId: req.user.id,
					event: "order_placed",
					metadata: JSON.stringify({
						orderId: order.id,
						productId,
						quantity,
						totalPrice,
					}),
				},
			});

			res.status(201).json({
				message: "Order created successfully",
				order,
			});
		} catch (error) {
			console.error("Create order error:", error);
			res.status(500).json({ error: "Failed to create order" });
		}
	},
);

// Get user's orders
router.get("/my-orders", authenticateToken, async (req, res) => {
	try {
		const where =
			req.user.role === "BUYER"
				? { buyerId: req.user.id }
				: { farmerId: req.user.id };

		const orders = await prisma.order.findMany({
			where,
			include: {
				product: {
					select: {
						name: true,
						images: true,
						category: true,
						unit: true,
					},
				},
				buyer: {
					select: {
						name: true,
						phone: true,
						location: true,
					},
				},
				farmer: {
					select: {
						name: true,
						phone: true,
						location: true,
					},
				},
				transaction: {
					select: {
						status: true,
						blockHash: true,
						timestamp: true,
					},
				},
				review: {
					select: {
						rating: true,
						comment: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		res.json({ orders });
	} catch (error) {
		console.error("Get orders error:", error);
		res.status(500).json({ error: "Failed to fetch orders" });
	}
});

// Update order status (farmers only)
router.patch(
	"/:id/status",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("status").isIn([
			"PENDING",
			"CONFIRMED",
			"IN_TRANSIT",
			"DELIVERED",
			"CANCELLED",
		]),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { id } = req.params;
			const { status } = req.body;

			const allowedTransitions = {
				PENDING: ["CONFIRMED", "CANCELLED"],
				CONFIRMED: ["IN_TRANSIT", "CANCELLED"],
				IN_TRANSIT: ["DELIVERED"],
				DELIVERED: [],
				CANCELLED: [],
			};

			// Check if order belongs to farmer + get current status/product/qty
			const existingOrder = await prisma.order.findUnique({
				where: { id },
				select: {
					farmerId: true,
					buyerId: true,
					status: true,
					productId: true,
					quantity: true,
					totalPrice: true,
				},
			});

			if (!existingOrder) {
				return res.status(404).json({ error: "Order not found" });
			}

			if (existingOrder.farmerId !== req.user.id) {
				return res
					.status(403)
					.json({ error: "Not authorized to update this order" });
			}

			const currentStatus = existingOrder.status;
			if (currentStatus === status) {
				return res.json({ message: "Order status unchanged", order: existingOrder });
			}

			if (!allowedTransitions[currentStatus]?.includes(status)) {
				return res.status(400).json({
					error: `Invalid status transition from ${currentStatus} to ${status}`,
				});
			}

			// Persist status update + inventory restore on cancel
			await prisma.$transaction(async (tx) => {
				await tx.order.update({
					where: { id },
					data: { status },
				});

				if (status === "CANCELLED") {
					await tx.product.update({
						where: { id: existingOrder.productId },
						data: {
							quantity: { increment: existingOrder.quantity },
							available: true,
						},
					});

					// If a transaction exists, mark it failed/cancelled
					await tx.transaction.updateMany({
						where: { orderId: id },
						data: { status: "FAILED" },
					});
				}
			});

			// If order is confirmed, create/update blockchain transaction (simulated or real)
			if (status === "CONFIRMED") {
				try {
					const blockchainResult = await blockchainService.recordTransaction({
						orderId: id,
						productId: existingOrder.productId,
						buyerAddress: existingOrder.buyerId,
						farmerAddress: existingOrder.farmerId,
						quantity: existingOrder.quantity,
						totalPrice: existingOrder.totalPrice,
					});

					await prisma.transaction.upsert({
						where: { orderId: id },
						update: {
							blockHash: blockchainResult.transactionHash,
							blockNumber: blockchainResult.blockNumber,
							gasUsed: blockchainResult.gasUsed,
							status: "COMPLETED",
						},
						create: {
							orderId: id,
							productId: existingOrder.productId,
							amount: existingOrder.totalPrice,
							blockHash: blockchainResult.transactionHash,
							blockNumber: blockchainResult.blockNumber,
							gasUsed: blockchainResult.gasUsed,
							status: "COMPLETED",
						},
					});
				} catch (e) {
					console.error("Blockchain recordTransaction failed:", e);
					await prisma.transaction.upsert({
						where: { orderId: id },
						update: { status: "FAILED" },
						create: {
							orderId: id,
							productId: existingOrder.productId,
							amount: existingOrder.totalPrice,
							status: "FAILED",
						},
					});
				}
			}

			res.json({
				message: "Order status updated successfully",
				order: await prisma.order.findUnique({
					where: { id },
					include: {
						product: {
							select: { name: true, images: true, category: true, unit: true },
						},
						buyer: { select: { name: true, phone: true, location: true } },
						farmer: { select: { name: true, phone: true, location: true } },
						transaction: {
							select: { status: true, blockHash: true, timestamp: true },
						},
						review: { select: { rating: true, comment: true } },
					},
				}),
			});
		} catch (error) {
			console.error("Update order status error:", error);
			res.status(500).json({ error: "Failed to update order status" });
		}
	},
);

// Add review (buyers only, after delivery)
router.post(
	"/:id/review",
	authenticateToken,
	requireRole(["BUYER"]),
	requireVerified,
	[
		body("rating").isInt({ min: 1, max: 5 }),
		body("comment").optional().trim().isLength({ max: 500 }).escape(),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { id } = req.params;
			const { rating, comment } = req.body;

			// Check if order exists and belongs to buyer
			const order = await prisma.order.findUnique({
				where: { id },
				select: {
					buyerId: true,
					productId: true,
					status: true,
					review: true,
				},
			});

			if (!order) {
				return res.status(404).json({ error: "Order not found" });
			}

			if (order.buyerId !== req.user.id) {
				return res
					.status(403)
					.json({ error: "Not authorized to review this order" });
			}

			if (order.status !== "DELIVERED") {
				return res
					.status(400)
					.json({ error: "Can only review delivered orders" });
			}

			if (order.review) {
				return res.status(400).json({ error: "Order already reviewed" });
			}

			const review = await prisma.review.create({
				data: {
					rating,
					comment,
					userId: req.user.id,
					productId: order.productId,
					orderId: id,
				},
			});

			res.status(201).json({
				message: "Review added successfully",
				review,
			});
		} catch (error) {
			console.error("Add review error:", error);
			res.status(500).json({ error: "Failed to add review" });
		}
	},
);

export default router;
