import { validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import locationService from "../utils/locationService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import path from "path";

export async function uploadProductImages(req, res) {
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
}

export async function getNearbyProducts(req, res) {
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
			where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
		}

		const products = await prisma.product.findMany({
			where,
			include: {
				farmer: { select: { id: true, name: true, location: true, verified: true } },
				reviews: { select: { rating: true } },
				_count: { select: { orders: true, reviews: true } },
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
		console.error("Nearby products error:", error);
		res.status(500).json({ error: "Failed to fetch nearby products" });
	}
}

export async function createProduct(req, res) {
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
<<<<<<< HEAD
=======
			customFields,
>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
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
<<<<<<< HEAD
=======
				customFields: customFields ? JSON.stringify(customFields) : null,
>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
				organic: Boolean(organic),
				farmerId: req.user.id,
			},
			include: {
				farmer: { select: { id: true, name: true, location: true } },
			},
		});

		await prisma.priceHistory.create({
			data: {
				productId: product.id,
				price: parseFloat(price),
			},
		});

		res.status(201).json({ message: "Product created successfully", product });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "product_create",
			targetType: "product",
			targetId: product.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { category, price: parseFloat(price), quantity: parseInt(quantity) },
		});
	} catch (error) {
		console.error("Create product error:", error);
		res.status(500).json({ error: "Failed to create product" });
	}
}

export async function updateProduct(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { id } = req.params;
		const updates = {};
		const allowedFields = [
			"name",
			"description",
			"category",
			"price",
			"quantity",
			"unit",
			"harvestDate",
			"expiryDate",
			"location",
			"organic",
			"available",
<<<<<<< HEAD
=======
			"customFields",
>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
		];

		Object.keys(req.body || {}).forEach((key) => {
			if (!allowedFields.includes(key)) return;
			if (req.body[key] === undefined) return;
			updates[key] = req.body[key];
		});

		if (typeof updates.price !== "undefined") updates.price = parseFloat(updates.price);
		if (typeof updates.quantity !== "undefined") updates.quantity = parseInt(updates.quantity);
		if (typeof updates.harvestDate !== "undefined") {
			updates.harvestDate = updates.harvestDate ? new Date(updates.harvestDate) : null;
		}
		if (typeof updates.expiryDate !== "undefined") {
			updates.expiryDate = updates.expiryDate ? new Date(updates.expiryDate) : null;
		}
<<<<<<< HEAD
=======
		if (typeof updates.customFields !== "undefined") {
			updates.customFields = updates.customFields ? JSON.stringify(updates.customFields) : null;
		}
>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c

		const existingProduct = await prisma.product.findUnique({
			where: { id },
			select: { farmerId: true, price: true },
		});
		if (!existingProduct) return res.status(404).json({ error: "Product not found" });
		if (existingProduct.farmerId !== req.user.id) {
			return res.status(403).json({ error: "Not authorized to update this product" });
		}

		const product = await prisma.product.update({
			where: { id },
			data: { ...updates, updatedAt: new Date() },
			include: {
				farmer: { select: { id: true, name: true, location: true } },
			},
		});

		if (updates.price && updates.price !== existingProduct.price) {
			await prisma.priceHistory.create({
				data: { productId: id, price: parseFloat(updates.price) },
			});
		}

		res.json({ message: "Product updated successfully", product });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "product_update",
			targetType: "product",
			targetId: id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { fields: Object.keys(updates) },
		});
	} catch (error) {
		console.error("Update product error:", error);
		res.status(500).json({ error: "Failed to update product" });
	}
}

export async function deleteProduct(req, res) {
	try {
		const { id } = req.params;
		const existingProduct = await prisma.product.findUnique({
			where: { id },
			select: { farmerId: true },
		});

		if (!existingProduct) return res.status(404).json({ error: "Product not found" });
		if (existingProduct.farmerId !== req.user.id) {
			return res.status(403).json({ error: "Not authorized to delete this product" });
		}

		await prisma.product.delete({ where: { id } });
		res.json({ message: "Product deleted successfully" });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "product_delete",
			targetType: "product",
			targetId: id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});
	} catch (error) {
		console.error("Delete product error:", error);
		res.status(500).json({ error: "Failed to delete product" });
	}
}

export async function getMyProducts(req, res) {
	try {
		const products = await prisma.product.findMany({
			where: { farmerId: req.user.id },
			include: {
				_count: { select: { orders: true, reviews: true } },
				reviews: { select: { rating: true } },
			},
			orderBy: { createdAt: "desc" },
		});

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
}

