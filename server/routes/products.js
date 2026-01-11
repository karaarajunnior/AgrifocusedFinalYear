import express from "express";
import { body, validationResult, query } from "express-validator";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { authenticateToken, requireRole } from "../middleware/auth.js";
import locationService from "../utils/locationService.js";
import { requireVerified } from "../middleware/verified.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

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
});

// Upload product images (farmers only, own product)
router.post(
	"/:id/images",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	uploadProductImages.array("images", 6),
	async (req, res) => {
		try {
			const { id } = req.params;
			const product = await prisma.product.findUnique({
				where: { id },
				select: { farmerId: true, images: true },
			});
			if (!product) return res.status(404).json({ error: "Product not found" });
			if (product.farmerId !== req.user.id) {
				return res.status(403).json({ error: "Not authorized" });
			}

			const files = req.files || [];
			if (!Array.isArray(files) || files.length === 0) {
				return res.status(400).json({ error: "No images uploaded" });
			}

			let existing = [];
			try {
				existing = product.images ? JSON.parse(product.images) : [];
			} catch {
				existing = [];
			}

			const urls = files.map((f) => `/uploads/products/${path.basename(f.path)}`);
			const merged = [...existing, ...urls].slice(0, 10);

			const updated = await prisma.product.update({
				where: { id },
				data: { images: JSON.stringify(merged) },
				select: { id: true, images: true },
			});

			res.json({
				message: "Images uploaded",
				product: {
					id: updated.id,
					images: updated.images ? JSON.parse(updated.images) : [],
				},
			});
		} catch (error) {
			console.error("Upload product images error:", error);
			res.status(500).json({ error: "Failed to upload images" });
		}
	},
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
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { location, radius = 50, category, search } = req.query;

			const where = {
				available: true,
				quantity: { gt: 0 },
			};

			if (category) where.category = category;
			if (search) {
				where.OR = [
					{ name: { contains: search } },
					{ description: { contains: search } },
				];
			}

			const products = await prisma.product.findMany({
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
						select: { rating: true },
					},
					_count: {
						select: { orders: true, reviews: true },
					},
				},
				orderBy: { createdAt: "desc" },
				take: 200,
			});

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

			const nearby = await locationService.getProductsWithinRadius(
				location,
				productsWithRatings,
				parseInt(radius),
			);

			res.json({ products: nearby });
		} catch (error) {
			console.error("Get nearby products error:", error);
			res.status(500).json({ error: "Failed to fetch nearby products" });
		}
	},
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
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const {
				name,
				description,
				category,
				price,
				quantity,
				unit,
				harvestDate,
				expiryDate,
				location,
				images,
				organic,
			} = req.body;

			const product = await prisma.product.create({
				data: {
					name,
					description,
					category,
					price: parseFloat(price),
					quantity: parseInt(quantity),
					unit: unit || "kg",
					harvestDate: harvestDate ? new Date(harvestDate) : null,
					expiryDate: expiryDate ? new Date(expiryDate) : null,
					location,
					images: images ? JSON.stringify(images) : null,
					organic: Boolean(organic),
					farmerId: req.user.id,
				},
				include: {
					farmer: {
						select: {
							id: true,
							name: true,
							location: true,
						},
					},
				},
			});

			// Create initial price history entry
			await prisma.priceHistory.create({
				data: {
					productId: product.id,
					price: parseFloat(price),
				},
			});

			res.status(201).json({
				message: "Product created successfully",
				product,
			});
		} catch (error) {
			console.error("Create product error:", error);
			res.status(500).json({ error: "Failed to create product" });
		}
	},
);

// Update product (farmer only - own products)
router.put(
	"/:id",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	async (req, res) => {
		try {
			const { id } = req.params;
			const updates = req.body;

			// Check if product belongs to farmer
			const existingProduct = await prisma.product.findUnique({
				where: { id },
				select: { farmerId: true, price: true },
			});

			if (!existingProduct) {
				return res.status(404).json({ error: "Product not found" });
			}

			if (existingProduct.farmerId !== req.user.id) {
				return res
					.status(403)
					.json({ error: "Not authorized to update this product" });
			}

			const product = await prisma.product.update({
				where: { id },
				data: {
					...updates,
					updatedAt: new Date(),
				},
				include: {
					farmer: {
						select: {
							id: true,
							name: true,
							location: true,
						},
					},
				},
			});

			// If price changed, add to price history
			if (updates.price && updates.price !== existingProduct.price) {
				await prisma.priceHistory.create({
					data: {
						productId: id,
						price: parseFloat(updates.price),
					},
				});
			}

			res.json({
				message: "Product updated successfully",
				product,
			});
		} catch (error) {
			console.error("Update product error:", error);
			res.status(500).json({ error: "Failed to update product" });
		}
	},
);

// Delete product (farmer only - own products)
router.delete(
	"/:id",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Check if product belongs to farmer
			const existingProduct = await prisma.product.findUnique({
				where: { id },
				select: { farmerId: true },
			});

			if (!existingProduct) {
				return res.status(404).json({ error: "Product not found" });
			}

			if (existingProduct.farmerId !== req.user.id) {
				return res
					.status(403)
					.json({ error: "Not authorized to delete this product" });
			}

			await prisma.product.delete({
				where: { id },
			});

			res.json({ message: "Product deleted successfully" });
		} catch (error) {
			console.error("Delete product error:", error);
			res.status(500).json({ error: "Failed to delete product" });
		}
	},
);

// Get farmer's products
router.get(
	"/farmer/my-products",
	authenticateToken,
	requireRole(["FARMER"]),
	async (req, res) => {
		try {
			const products = await prisma.product.findMany({
				where: { farmerId: req.user.id },
				include: {
					_count: {
						select: {
							orders: true,
							reviews: true,
						},
					},
					reviews: {
						select: { rating: true },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			// Calculate analytics for each product
			const productsWithAnalytics = products.map((product) => {
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

			res.json({ products: productsWithAnalytics });
		} catch (error) {
			console.error("Get farmer products error:", error);
			res.status(500).json({ error: "Failed to fetch your products" });
		}
	},
);
export default router;
