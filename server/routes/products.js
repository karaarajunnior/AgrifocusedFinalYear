import express from "express";
import { body, validationResult, query } from "express-validator";
import prisma from "../db/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import locationService from "../utils/locationService.js";
import { requireVerified } from "../middleware/verified.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { writeAuditLog } from "../services/auditLogService.js";
import {
	createProduct,
	deleteProduct,
	getMyProducts,
	getNearbyProducts,
	updateProduct,
	uploadProductImages as uploadProductImagesHandler,
} from "../controllers/productsController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productUploadsDir = path.join(__dirname, "..", "uploads", "products");

const productImageStorage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(productUploadsDir, { recursive: true });
			cb(null, productUploadsDir);
		} catch (e) {
			cb(e);
		}
	},
	filename: (req, file, cb) => {
		const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
		cb(null, `${Date.now()}_${safe}`);
	},
});

const uploadProductImages = multer({
	storage: productImageStorage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB each
	fileFilter: (req, file, cb) => {
		const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
		if (!allowed.has(file.mimetype)) {
			return cb(new Error("Only JPG, PNG, WEBP images are allowed"));
		}
		cb(null, true);
	},
});

// Upload product images (farmers only, own product)
router.post(
	"/:id/images",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	uploadProductImages.array("images", 6),
	uploadProductImagesHandler,
);

// Get nearby products within radius (location-based discovery)
router.get(
	"/nearby",
	[
		query("location").isString().trim().isLength({ min: 2 }),
		query("radius").optional().isInt({ min: 1, max: 500 }),
		query("category")
			.optional()
			.isIn([
				"VEGETABLES",
				"FRUITS",
				"GRAINS",
				"PULSES",
				"SPICES",
				"DAIRY",
				"POULTRY",
				"ORGANIC",
				"PROCESSED",
			]),
		query("search").optional().isString().trim().isLength({ min: 1, max: 100 }),
	],
	getNearbyProducts,
);

// Get all products with filters
router.get(
	"/",
	[
		query("category")
			.optional()
			.isIn([
				"VEGETABLES",
				"FRUITS",
				"GRAINS",
				"PULSES",
				"SPICES",
				"DAIRY",
				"POULTRY",
				"ORGANIC",
				"PROCESSED",
			]),
		query("location").optional().isString(),
		query("minPrice").optional().isFloat({ min: 0 }),
		query("maxPrice").optional().isFloat({ min: 0 }),
		query("organic").optional().isBoolean(),
		query("page").optional().isInt({ min: 1 }),
		query("limit").optional().isInt({ min: 1, max: 100 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const {
				category,
				location,
				minPrice,
				maxPrice,
				organic,
				search,
				page = 1,
				limit = 20,
			} = req.query;

			const where = {
				available: true,
				quantity: { gt: 0 },
			};

			if (category) where.category = category;
			if (location) where.location = { contains: location };
			if (organic !== undefined) where.organic = organic === "true";
			if (minPrice || maxPrice) {
				where.price = {};
				if (minPrice) where.price.gte = parseFloat(minPrice);
				if (maxPrice) where.price.lte = parseFloat(maxPrice);
			}
			if (search) {
				where.OR = [
					{ name: { contains: search } },
					{ description: { contains: search } },
				];
			}

			const skip = (parseInt(page) - 1) * parseInt(limit);

			const [products, total] = await Promise.all([
				prisma.product.findMany({
					where,
					include: {
						farmer: {
							select: {
								id: true,
								name: true,
								location: true,
								verified: true,
							},
						},
						reviews: {
							select: {
								rating: true,
							},
						},
						_count: {
							select: {
								orders: true,
								reviews: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
					skip,
					take: parseInt(limit),
				}),
				prisma.product.count({ where }),
			]);

			// Calculate average ratings
			const productsWithRatings = products.map((product) => {
				const avgRating =
					product.reviews.length > 0
						? product.reviews.reduce((sum, review) => sum + review.rating, 0) /
						  product.reviews.length
						: 0;

				return {
					...product,
					avgRating: Math.round(avgRating * 10) / 10,
					totalOrders: product._count.orders,
					totalReviews: product._count.reviews,
				};
			});

			res.json({
				products: productsWithRatings,
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
					total,
					pages: Math.ceil(total / parseInt(limit)),
				},
			});
		} catch (error) {
			console.error("Get products error:", error);
			res.status(500).json({ error: "Failed to fetch products" });
		}
	},
);

// Get single product
router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const product = await prisma.product.findUnique({
			where: { id },
			include: {
				farmer: {
					select: {
						id: true,
						name: true,
						location: true,
						phone: true,
						verified: true,
						createdAt: true,
					},
				},
				reviews: {
					include: {
						user: {
							select: {
								name: true,
								avatar: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
				},
				priceHistory: {
					orderBy: { date: "desc" },
					take: 30,
				},
			},
		});

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		// Log product view analytics
		if (req.user) {
			await prisma.userAnalytics.create({
				data: {
					userId: req.user.id,
					event: "product_view",
					metadata: JSON.stringify({
						productId: id,
						category: product.category,
					}),
				},
			});
		}

		// Calculate average rating
		const avgRating =
			product.reviews.length > 0
				? product.reviews.reduce((sum, review) => sum + review.rating, 0) /
				  product.reviews.length
				: 0;

		res.json({
			...product,
			avgRating: Math.round(avgRating * 10) / 10,
		});
	} catch (error) {
		console.error("Get product error:", error);
		res.status(500).json({ error: "Failed to fetch product" });
	}
});

// Create product (farmers only)
router.post(
	"/",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("name").trim().isLength({ min: 2, max: 100 }),
		body("category").isIn([
			"VEGETABLES",
			"FRUITS",
			"GRAINS",
			"PULSES",
			"SPICES",
			"DAIRY",
			"POULTRY",
			"ORGANIC",
			"PROCESSED",
		]),
		body("price").isFloat({ min: 0.01 }),
		body("quantity").isInt({ min: 1 }),
		body("location").trim().isLength({ min: 2 }),
	],
	createProduct,
);

// Update product (farmer only - own products)
router.put(
	"/:id",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("name").optional().trim().isLength({ min: 2, max: 100 }),
		body("description").optional().isString().trim().isLength({ max: 5000 }),
		body("category")
			.optional()
			.isIn([
				"VEGETABLES",
				"FRUITS",
				"GRAINS",
				"PULSES",
				"SPICES",
				"DAIRY",
				"POULTRY",
				"ORGANIC",
				"PROCESSED",
			]),
		body("price").optional().isFloat({ min: 0.01 }),
		body("quantity").optional().isInt({ min: 0 }),
		body("unit").optional().isString().trim().isLength({ min: 1, max: 32 }),
		body("harvestDate").optional().isISO8601(),
		body("expiryDate").optional().isISO8601(),
		body("location").optional().isString().trim().isLength({ min: 2, max: 120 }),
		body("organic").optional().isBoolean(),
		body("available").optional().isBoolean(),
	],
	updateProduct,
);

// Delete product (farmer only - own products)
router.delete(
	"/:id",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	deleteProduct,
);

// Get farmer's products
router.get(
	"/farmer/my-products",
	authenticateToken,
	requireRole(["FARMER"]),
	getMyProducts,
);
export default router;
