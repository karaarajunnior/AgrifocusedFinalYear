import blockchainService from "../services/blockchainService.js";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";

const prisma = new PrismaClient();
const router = express.Router();

// Admin: verify farmer on-chain (required by the Solidity contract before listing)
router.post(
	"/verify-farmer",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const { userId } = req.body;
			if (!userId) return res.status(400).json({ error: "userId required" });

			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) return res.status(404).json({ error: "User not found" });
			if (user.role !== "FARMER") {
				return res.status(400).json({ error: "User is not a farmer" });
			}
			if (!user.walletAddress) {
				return res.status(400).json({ error: "Farmer walletAddress not set" });
			}

			const result = await blockchainService.verifyFarmerOnChain(user.walletAddress);

			await prisma.userAnalytics.create({
				data: {
					userId: req.user.id,
					event: "blockchain_farmer_verified",
					metadata: JSON.stringify({
						farmerUserId: user.id,
						farmerWallet: user.walletAddress,
						...result,
					}),
				},
			});

			res.json({ message: "Farmer verified on-chain", blockchain: result });
		} catch (error) {
			console.error("Verify farmer error:", error);
			res.status(500).json({ error: "Failed to verify farmer on-chain" });
		}
	},
);

// Record product listing on blockchain
router.post(
	"/list-product",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	async (req, res) => {
	try {
		const { productId } = req.body;

		const product = await prisma.product.findUnique({
			where: { id: productId },
			include: { farmer: true },
		});

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		if (product.farmerId !== req.user.id) {
			return res.status(403).json({ error: "Not authorized" });
		}

		if (!product.farmer?.walletAddress && process.env.CONTRACT_ADDRESS) {
			return res.status(400).json({ error: "Set your wallet address before listing" });
		}

		const blockchainResult = await blockchainService.listProduct(
			product,
			product.farmer?.walletAddress || req.user.id,
		);

		// Persist on product (auditability)
		await prisma.product.update({
			where: { id: productId },
			data: {
				listedOnChain: true,
				chainTxHash: blockchainResult.transactionHash,
				chainBlockNumber: blockchainResult.blockNumber,
				chainListedAt: new Date(),
			},
		});

		// Log blockchain listing event
		await prisma.userAnalytics.create({
			data: {
				userId: req.user.id,
				event: "blockchain_product_listed",
				metadata: JSON.stringify({
					productId,
					transactionHash: blockchainResult.transactionHash,
					blockNumber: blockchainResult.blockNumber,
					blockHash: blockchainResult.blockHash,
					gasUsed: blockchainResult.gasUsed,
				}),
			},
		});

		res.json({
			message: "Product listed on blockchain successfully",
			blockchain: blockchainResult,
		});
	} catch (error) {
		console.error("Blockchain listing error:", error);
		res.status(500).json({ error: "Failed to list product on blockchain" });
	}
	},
);

// Record transaction on blockchain
router.post(
	"/record-transaction",
	authenticateToken,
	requireVerified,
	async (req, res) => {
	try {
		const { orderId } = req.body;

		const order = await prisma.order.findUnique({
			where: { id: orderId },
			include: {
				product: true,
				buyer: true,
				farmer: true,
			},
		});

		if (!order) {
			return res.status(404).json({ error: "Order not found" });
		}

		// Access control: only buyer/farmer/admin can record
		const hasAccess =
			order.buyerId === req.user.id ||
			order.farmerId === req.user.id ||
			req.user.role === "ADMIN";
		if (!hasAccess) return res.status(403).json({ error: "Access denied" });

		// Real chain needs wallet addresses; simulation can proceed without
		if (process.env.CONTRACT_ADDRESS) {
			if (!order.buyer.walletAddress || !order.farmer.walletAddress) {
				return res.status(400).json({
					error: "Buyer and farmer walletAddress must be set for on-chain recording",
				});
			}
		}

		const transactionData = {
			orderId: order.id,
			productId: order.productId,
			buyerAddress: order.buyer.walletAddress || order.buyer.id,
			farmerAddress: order.farmer.walletAddress || order.farmer.id,
			quantity: order.quantity,
			totalPrice: order.totalPrice,
		};

		const blockchainResult = await blockchainService.recordTransaction(
			transactionData,
		);

		// Create or update blockchain transaction record
		await prisma.transaction.upsert({
			where: { orderId: orderId },
			update: {
				blockHash: blockchainResult.transactionHash,
				blockNumber: blockchainResult.blockNumber,
				gasUsed: blockchainResult.gasUsed,
				status: "COMPLETED",
			},
			create: {
				orderId: orderId,
				productId: order.productId,
				amount: order.totalPrice,
				blockHash: blockchainResult.transactionHash,
				blockNumber: blockchainResult.blockNumber,
				gasUsed: blockchainResult.gasUsed,
				status: "COMPLETED",
			},
		});

		res.json({
			message: "Transaction recorded on blockchain successfully",
			blockchain: blockchainResult,
		});
	} catch (error) {
		console.error("Blockchain transaction error:", error);
		res
			.status(500)
			.json({ error: "Failed to record transaction on blockchain" });
	}
	},
);

// Get blockchain statistics
router.get("/stats", authenticateToken, async (req, res) => {
	try {
		const stats = blockchainService.getBlockchainStats();

		const [totalProducts, totalTransactions, totalUsers] = await Promise.all([
			prisma.product.count(),
			prisma.transaction.count(),
			prisma.user.count(),
		]);

		res.json({
			blockchain: stats,
			platform: {
				totalProducts,
				totalTransactions,
				totalUsers,
				activeContracts: totalProducts,
			},
		});
	} catch (error) {
		console.error("Blockchain stats error:", error);
		res.status(500).json({ error: "Failed to fetch blockchain statistics" });
	}
});

// Get blockchain transaction details
router.get("/transaction/:orderId", authenticateToken, async (req, res) => {
	try {
		const { orderId } = req.params;

		const transaction = await prisma.transaction.findUnique({
			where: { orderId },
			include: {
				order: {
					include: {
						product: {
							select: { name: true, category: true },
						},
						buyer: {
							select: { name: true, location: true },
						},
						farmer: {
							select: { name: true, location: true },
						},
					},
				},
			},
		});

		if (!transaction) {
			return res.status(404).json({ error: "Transaction not found" });
		}

		const hasAccess =
			transaction.order.buyerId === req.user.id ||
			transaction.order.farmerId === req.user.id ||
			req.user.role === "ADMIN";

		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		res.json({
			transaction: {
				id: transaction.id,
				blockHash: transaction.blockHash,
				blockNumber: transaction.blockNumber,
				gasUsed: transaction.gasUsed,
				amount: transaction.amount,
				status: transaction.status,
				timestamp: transaction.timestamp,
				order: {
					id: transaction.order.id,
					quantity: transaction.order.quantity,
					totalPrice: transaction.order.totalPrice,
					status: transaction.order.status,
					product: transaction.order.product,
					buyer: transaction.order.buyer,
					farmer: transaction.order.farmer,
				},
			},
		});
	} catch (error) {
		console.error("Get blockchain transaction error:", error);
		res.status(500).json({ error: "Failed to fetch transaction" });
	}
});

// Get all blockchain transactions for a user
router.get("/transactions", authenticateToken, async (req, res) => {
	try {
		const { page = 1, limit = 20 } = req.query;

		const whereClause =
			req.user.role === "ADMIN"
				? {}
				: {
						OR: [
							{ order: { buyerId: req.user.id } },
							{ order: { farmerId: req.user.id } },
						],
				  };

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const [transactions, total] = await Promise.all([
			prisma.transaction.findMany({
				where: whereClause,
				include: {
					order: {
						include: {
							product: {
								select: { name: true, category: true, images: true },
							},
							buyer: {
								select: { name: true, location: true },
							},
							farmer: {
								select: { name: true, location: true },
							},
						},
					},
				},
				orderBy: { timestamp: "desc" },
				skip,
				take: parseInt(limit),
			}),
			prisma.transaction.count({ where: whereClause }),
		]);

		res.json({
			transactions,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / parseInt(limit)),
			},
		});
	} catch (error) {
		console.error("Get blockchain transactions error:", error);
		res.status(500).json({ error: "Failed to fetch transactions" });
	}
});

// Verify blockchain transaction integrity
router.post("/verify/:transactionId", authenticateToken, async (req, res) => {
	try {
		const { transactionId } = req.params;

		const transaction = await prisma.transaction.findUnique({
			where: { id: transactionId },
			include: {
				order: {
					include: {
						product: true,
					},
				},
			},
		});

		if (!transaction) {
			return res.status(404).json({ error: "Transaction not found" });
		}

		const hasAccess =
			transaction.order.buyerId === req.user.id ||
			transaction.order.farmerId === req.user.id ||
			req.user.role === "ADMIN";

		if (!hasAccess) {
			return res.status(403).json({ error: "Access denied" });
		}

		// Verify against the simulated/real chain (best-effort)
		const chainVerification = transaction.blockHash
			? await blockchainService.verifyTransaction(transaction.blockHash)
			: { verified: false };

		const isValid = Boolean(chainVerification?.verified);

		const verificationResult = {
			transactionId: transaction.id,
			blockHash: transaction.blockHash,
			blockNumber: transaction.blockNumber,
			isValid,
			verificationTime: new Date(),
			checks: {
				hashIntegrity: isValid,
				blockExists: isValid,
				transactionInBlock: isValid,
				gasCalculation: typeof transaction.gasUsed === "number" && transaction.gasUsed > 0,
				amountMatch: transaction.amount === transaction.order.totalPrice,
			},
		};

		verificationResult.overallStatus = Object.values(
			verificationResult.checks,
		).every((check) => check)
			? "VERIFIED"
			: "FAILED";

		res.json({
			verification: verificationResult,
		});
	} catch (error) {
		console.error("Verify transaction error:", error);
		res.status(500).json({ error: "Failed to verify transaction" });
	}
});

router.get(
	"/network-stats",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const [
				totalTransactions,
				totalValue,
				averageGasUsed,
				recentBlocks,
				networkActivity,
			] = await Promise.all([
				prisma.transaction.count({ where: { status: "COMPLETED" } }),

				prisma.transaction.aggregate({
					where: { status: "COMPLETED" },
					_sum: { amount: true, gasUsed: true },
				}),

				prisma.transaction.aggregate({
					where: { status: "COMPLETED" },
					_avg: { gasUsed: true },
				}),

				prisma.transaction.findMany({
					where: { status: "COMPLETED" },
					select: {
						blockNumber: true,
						blockHash: true,
						timestamp: true,
						gasUsed: true,
						amount: true,
					},
					orderBy: { blockNumber: "desc" },
					take: 10,
				}),

				prisma.transaction.groupBy({
					by: ["timestamp"],
					where: {
						status: "COMPLETED",
						timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
					},
					_count: true,
					_sum: { amount: true, gasUsed: true },
				}),
			]);

			// Calculating network health metrics
			const avgBlockTime = calculateAverageBlockTime(recentBlocks);
			const networkHashRate = calculateNetworkHashRate(totalTransactions);

			res.json({
				networkStats: {
					totalTransactions,
					totalValue: totalValue._sum.amount || 0,
					totalGasUsed: totalValue._sum.gasUsed || 0,
					averageGasPrice: averageGasUsed._avg.gasUsed || 0,
					avgBlockTime,
					networkHashRate,
					pendingTransactions: await prisma.transaction.count({
						where: { status: "PENDING" },
					}),
				},
				recentBlocks: recentBlocks.map((block) => ({
					blockNumber: block.blockNumber,
					blockHash: block.blockHash.substring(0, 10) + "...",
					timestamp: block.timestamp,
					gasUsed: block.gasUsed,
					value: block.amount,
				})),
				networkActivity: networkActivity.map((activity) => ({
					date: activity.timestamp,
					transactions: activity._count,
					value: activity._sum.amount || 0,
					gasUsed: activity._sum.gasUsed || 0,
				})),
			});
		} catch (error) {
			console.error("Network stats error:", error);
			res.status(500).json({ error: "Failed to fetch network stats" });
		}
	},
);

// Helper functions
const calculateAverageBlockTime = (blocks) => {
	if (blocks.length < 2) return 0;

	let totalTime = 0;
	for (let i = 0; i < blocks.length - 1; i++) {
		const timeDiff =
			new Date(blocks[i].timestamp) - new Date(blocks[i + 1].timestamp);
		totalTime += timeDiff;
	}

	return Math.round(totalTime / (blocks.length - 1) / 1000);
};

const calculateNetworkHashRate = (totalTransactions) => {
	return Math.round(totalTransactions * 1.5);
};

export default router;
