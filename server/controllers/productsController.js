import { validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import locationService from "../utils/locationService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import path from "path";
import OpenAI from "openai";

let _openai = null;
function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!_openai) {
		_openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return _openai;
}

function readUInt24BE(buffer, offset) {
	return (buffer[offset] << 16) + (buffer[offset + 1] << 8) + buffer[offset + 2];
}

function getImageDimensions(buffer, mimetype) {
	try {
		if (mimetype === "image/png" && buffer.toString("ascii", 1, 4) === "PNG") {
			return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
		}

		if (mimetype === "image/jpeg") {
			let offset = 2;
			while (offset < buffer.length) {
				if (buffer[offset] !== 0xff) break;
				const marker = buffer[offset + 1];
				const length = buffer.readUInt16BE(offset + 2);
				if (marker >= 0xc0 && marker <= 0xc3) {
					return {
						height: buffer.readUInt16BE(offset + 5),
						width: buffer.readUInt16BE(offset + 7),
					};
				}
				offset += 2 + length;
			}
		}

		if (mimetype === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF") {
			const chunk = buffer.toString("ascii", 12, 16);
			if (chunk === "VP8X") {
				return {
					width: readUInt24BE(buffer, 24) + 1,
					height: readUInt24BE(buffer, 27) + 1,
				};
			}
			if (chunk === "VP8 ") {
				return {
					width: buffer.readUInt16LE(26) & 0x3fff,
					height: buffer.readUInt16LE(28) & 0x3fff,
				};
			}
			if (chunk === "VP8L") {
				const bits = buffer.readUInt32LE(21);
				return {
					width: (bits & 0x3fff) + 1,
					height: ((bits >> 14) & 0x3fff) + 1,
				};
			}
		}
	} catch {
		return null;
	}
	return null;
}

function buildImageQualityReport(file, product = null) {
	const dimensions = getImageDimensions(file.buffer, file.mimetype);
	const megapixels = dimensions ? Number(((dimensions.width * dimensions.height) / 1_000_000).toFixed(2)) : null;
	const recommendations = [];
	let score = 58;

	if (dimensions) {
		if (dimensions.width >= 1200 && dimensions.height >= 900) score += 20;
		else recommendations.push("Retake closer or use a higher resolution camera for buyer inspection.");

		const ratio = dimensions.width / dimensions.height;
		if (ratio >= 0.75 && ratio <= 1.8) score += 8;
		else recommendations.push("Crop the product so the harvest fills most of the frame.");
	} else {
		recommendations.push("Could not read image dimensions; upload JPEG, PNG, or WEBP.");
	}

	if (file.size >= 120_000 && file.size <= 5_000_000) score += 10;
	else if (file.size < 120_000) recommendations.push("Image file is very small; details may not be visible to buyers.");

	if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) score += 4;
	const finalScore = Math.max(0, Math.min(100, score));

	return {
		score: finalScore,
		grade: finalScore >= 85 ? "Export-ready" : finalScore >= 70 ? "Market-ready" : "Needs clearer photo",
		specifications: {
			productName: product?.name || "Uploaded sample",
			category: product?.category || "Unknown",
			format: file.mimetype.replace("image/", "").toUpperCase(),
			fileSizeKb: Math.round(file.size / 1024),
			width: dimensions?.width || null,
			height: dimensions?.height || null,
			megapixels,
		},
		signals: [
			dimensions ? `${dimensions.width}x${dimensions.height} image captured` : "Image dimensions unavailable",
			product ? `Compared against listing: ${product.name}` : "Standalone buyer sample",
			"Estimate uses photo metadata and listing context; confirm final grade physically.",
		],
		recommendations: recommendations.length
			? recommendations
			: ["Photo is clear enough for marketplace review.", "Add a close-up and a full-batch photo for stronger buyer trust."],
	};
}

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

export async function analyzeProductImage(req, res) {
	try {
		const file = req.file;
		if (!file) return res.status(400).json({ error: "No image uploaded" });

		let productName = req.body?.productName || "Uploaded sample";
		let category = req.body?.category || "Unknown";

		if (req.body?.productId) {
			const product = await prisma.product.findUnique({
				where: { id: String(req.body.productId) },
				select: { name: true, category: true },
			});
			if (product) {
				productName = product.name;
				category = product.category;
			}
		}

		// Read image specifications locally
		const dimensions = getImageDimensions(file.buffer, file.mimetype);
		const megapixels = dimensions ? Number(((dimensions.width * dimensions.height) / 1_000_000).toFixed(2)) : null;

		const openaiClient = getOpenAI();
		if (!openaiClient) {
			console.warn("OpenAI API key not set. Falling back to mock heuristic quality check.");
			return res.json({ analysis: buildImageQualityReport(file, { name: productName, category }) });
		}

		const base64Image = file.buffer.toString("base64");
		const prompt = `You are a strict and objective agricultural product quality inspector.
Analyze this uploaded crop/harvest image against the following listing details:
- Stated Product Name: "${productName}"
- Stated Product Category: "${category}"

Evaluate:
1. "isMatch": Is the image actually a picture of the stated product or crop category?
   If the image is completely unrelated (e.g., shoes, clothes, electronics, vehicles, documents, people, or another crop that is clearly not matching the description), set "isMatch" to false.
2. "score": A numeric quality score from 0 to 100 based on clarity, lighting, detail, and presentation of the harvest. If "isMatch" is false, the score must be exactly 0.
3. "grade": A quality label:
   - "Export-ready" (score 85-100): Exceptional clarity, lighting, detail, looks high grade.
   - "Market-ready" (score 70-84): Good clarity, standard local market look.
   - "Needs clearer photo" (score 0-69): Blurry, low detail, poor lighting, or if "isMatch" is false.
4. "signals": Array of 2-3 specific visual features observed in the photo (e.g., "Deep green leaves visible", "Clean dried beans in pile"). If "isMatch" is false, list mismatch signals (e.g., "Detected footwear instead of crop").
5. "recommendations": Array of 1-3 visual improvement tips or feedback (e.g., "Improve lighting to show color better"). If "isMatch" is false, specify "Upload a photo matching the listed product".

Output strictly in JSON format matching this schema:
{
  "isMatch": boolean,
  "score": number,
  "grade": "Export-ready" | "Market-ready" | "Needs clearer photo",
  "signals": string[],
  "recommendations": string[]
}`;

		const response = await openaiClient.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: prompt },
						{
							type: "image_url",
							image_url: { url: `data:${file.mimetype};base64,${base64Image}` },
						},
					],
				},
			],
			response_format: { type: "json_object" },
		});

		const resultText = response.choices?.[0]?.message?.content;
		const parsed = JSON.parse(resultText || "{}");

		const finalScore = typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 0;
		const finalGrade = parsed.grade || "Needs clearer photo";
		const finalRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : ["Please upload a clearer image of your crop."];
		const finalSignals = Array.isArray(parsed.signals) ? parsed.signals : [];

		res.json({
			analysis: {
				score: finalScore,
				grade: finalGrade,
				specifications: {
					productName,
					category,
					format: file.mimetype.replace("image/", "").toUpperCase(),
					fileSizeKb: Math.round(file.size / 1024),
					width: dimensions?.width || null,
					height: dimensions?.height || null,
					megapixels,
				},
				signals: [
					...(dimensions ? [`${dimensions.width}x${dimensions.height} image captured`] : []),
					...finalSignals
				],
				recommendations: finalRecommendations
			}
		});
	} catch (error) {
		console.error("Analyze product image error:", error);
		// Safe fallback
		try {
			res.json({ analysis: buildImageQualityReport(req.file, { name: req.body?.productName, category: req.body?.category }) });
		} catch (fallbackError) {
			res.status(500).json({ error: "Failed to analyze image" });
		}
	}
}

export async function getNearbyProducts(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { location, latitude, longitude, radius = 50, category, search } = req.query;
		const hasLocation = typeof location === "string" && location.trim().length >= 2;
		const hasCoordinates = latitude !== undefined && longitude !== undefined;
		if (!hasLocation && !hasCoordinates) {
			return res.status(400).json({ error: "Location or coordinates are required" });
		}

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
				farmer: { select: { id: true, name: true, location: true, verified: true, latitude: true, longitude: true } },
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
			hasCoordinates ? { latitude, longitude } : location,
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
			origin,
			customFields,

			latitude,
			longitude,

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

				customFields: customFields ? JSON.stringify(customFields) : null,

				organic: Boolean(organic),
				origin: origin || "LOCAL",
				latitude: latitude ? parseFloat(latitude) : null,
				longitude: longitude ? parseFloat(longitude) : null,
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
			"origin",
			"available",
			"customFields",
			"latitude",
			"longitude",
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

		if (typeof updates.customFields !== "undefined") {
			updates.customFields = updates.customFields ? JSON.stringify(updates.customFields) : null;
		}


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

