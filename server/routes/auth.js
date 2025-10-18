import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Register
router.post(
	"/register",
	[
		body("email").isEmail().normalizeEmail(),
		body("password").isLength({ min: 6 }),
		body("name").trim().isLength({ min: 2 }),
		body("role").isIn(["FARMER", "BUYER", "ADMIN"]),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email, password, name, role, phone, location, address } =
				req.body;

			const existingUser = await prisma.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				return res.status(400).json({ error: "User already exists" });
			}

			const salt = await bcrypt.genSalt(12);
			const hashedPassword = await bcrypt.hash(password, salt);

			const user = await prisma.user.create({
				data: {
					email,
					password: hashedPassword,
					name,
					role,
					phone,
					location,
					address,
				},
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					createdAt: true,
				},
			});

			const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
				expiresIn: process.env.JWT_EXPIRES_IN,
			});

			res.status(201).json({
				message: "User registered successfully",
				user,
				token,
			});
		} catch (error) {
			console.error("Registration error:", error);
			res.status(500).json({ error: "Registration failed" });
		}
	},
);

// Login
router.post(
	"/login",
	[body("email").isEmail().normalizeEmail(), body("password").exists()],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email, password } = req.body;

			const user = await prisma.user.findUnique({
				where: { email },
			});

			if (!user) {
				return res.status(400).json({ error: "Invalid credentials" });
			}

			const isValidPassword = await bcrypt.compare(password, user.password);
			if (!isValidPassword) {
				return res.status(400).json({ error: "Invalid credentials" });
			}

			await prisma.userAnalytics.create({
				data: {
					userId: user.id,
					event: "login",
					metadata: JSON.stringify({
						ip: req.ip,
						userAgent: req.get("User-Agent"),
					}),
				},
			});

			const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
				expiresIn: process.env.JWT_EXPIRES_IN,
			});

			const { password: _, ...userWithoutPassword } = user;

			res.json({
				message: "Login successful",
				user: userWithoutPassword,
				token,
			});
		} catch (error) {
			console.error("Login error:", error);
			res.status(500).json({ error: "Login failed" });
		}
	},
);

// Get current user
router.get("/me", authenticateToken, async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				phone: true,
				location: true,
				address: true,
				avatar: true,
				verified: true,
				createdAt: true,
			},
		});

		res.json({ user });
	} catch (error) {
		console.error("Get user error:", error);
		res.status(500).json({ error: "Failed to fetch user data" });
	}
});

export default router;
