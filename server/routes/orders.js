import express from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// Create order (buyers only)
router.post(
	"/",
	authenticateToken,
	requireRole(["BUYER"]),
	[
		body("productId").isString(),
		body("quantity").isInt({ min: 1 }),
		body("deliveryDate").optional().isISO8601(),
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

			// Check if order belongs to farmer
			const existingOrder = await prisma.order.findUnique({
				where: { id },
				select: { farmerId: true },
			});

			if (!existingOrder) {
				return res.status(404).json({ error: "Order not found" });
			}

			if (existingOrder.farmerId !== req.user.id) {
				return res
					.status(403)
					.json({ error: "Not authorized to update this order" });
			}

			const order = await prisma.order.update({
				where: { id },
				data: { status },
				include: {
					product: {
						select: {
							name: true,
							category: true,
						},
					},
					buyer: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			// If order is confirmed, create/update blockchain transaction
			if (status === "CONFIRMED") {
				const existingTransaction = await prisma.transaction.findUnique({
					where: { orderId: id },
				});

				if (!existingTransaction) {
					await prisma.transaction.create({
						data: {
							orderId: id,
							productId: order.productId,
							amount: order.totalPrice,
							blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
							blockNumber: Math.floor(Math.random() * 1000000),
							gasUsed: Math.random() * 0.01,
							status: "COMPLETED",
						},
					});
				}
			}

			res.json({
				message: "Order status updated successfully",
				order,
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
	[
		body("rating").isInt({ min: 1, max: 5 }),
		body("comment").optional().isLength({ max: 500 }),
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
