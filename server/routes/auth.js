import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { authenticateToken } from "../middleware/auth.js";
import { generateMfaSetup, verifyTotp } from "../services/mfaService.js";

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
					verified: role === "ADMIN" ? true : false,
				},
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					verified: true,
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
	[
		body("email").isEmail().normalizeEmail(),
		body("password").exists(),
		body("mfaCode").optional().isString().trim().isLength({ min: 4, max: 10 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email, password, mfaCode } = req.body;

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

			if (user.mfaEnabled) {
				if (!mfaCode) {
					return res.status(401).json({
						error: "MFA code required",
						mfaRequired: true,
					});
				}
				const ok = verifyTotp({ secretBase32: user.mfaSecret, token: mfaCode });
				if (!ok) {
					return res.status(401).json({ error: "Invalid MFA code" });
				}
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

// MFA setup (generate secret + QR). Does NOT enable until verified.
router.post("/mfa/setup", authenticateToken, async (req, res) => {
	try {
		const setup = await generateMfaSetup(req.user.email);

		await prisma.user.update({
			where: { id: req.user.id },
			data: {
				mfaTempSecret: setup.base32,
			},
		});

		res.json({
			message: "MFA setup generated",
			mfa: {
				otpauthUrl: setup.otpauthUrl,
				qrCodeDataUrl: setup.qrCodeDataUrl,
			},
		});
	} catch (error) {
		console.error("MFA setup error:", error);
		res.status(500).json({ error: "Failed to setup MFA" });
	}
});

// MFA verify/setup complete
router.post(
	"/mfa/verify",
	authenticateToken,
	[body("code").isString().trim().isLength({ min: 4, max: 10 })],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await prisma.user.findUnique({ where: { id: req.user.id } });
			if (!user?.mfaTempSecret) {
				return res.status(400).json({ error: "No MFA setup in progress" });
			}

			const ok = verifyTotp({ secretBase32: user.mfaTempSecret, token: req.body.code });
			if (!ok) {
				return res.status(400).json({ error: "Invalid MFA code" });
			}

			await prisma.user.update({
				where: { id: req.user.id },
				data: {
					mfaEnabled: true,
					mfaSecret: user.mfaTempSecret,
					mfaTempSecret: null,
				},
			});

			res.json({ message: "MFA enabled successfully" });
		} catch (error) {
			console.error("MFA verify error:", error);
			res.status(500).json({ error: "Failed to enable MFA" });
		}
	},
);

router.post(
	"/mfa/disable",
	authenticateToken,
	[
		body("password").exists({ checkFalsy: true }),
		body("code").isString().trim().isLength({ min: 4, max: 10 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await prisma.user.findUnique({ where: { id: req.user.id } });
			if (!user?.mfaEnabled) {
				return res.status(400).json({ error: "MFA is not enabled" });
			}

			const okPassword = await bcrypt.compare(req.body.password, user.password);
			if (!okPassword) {
				return res.status(400).json({ error: "Invalid password" });
			}

			const okTotp = verifyTotp({ secretBase32: user.mfaSecret, token: req.body.code });
			if (!okTotp) {
				return res.status(400).json({ error: "Invalid MFA code" });
			}

			await prisma.user.update({
				where: { id: req.user.id },
				data: {
					mfaEnabled: false,
					mfaSecret: null,
					mfaTempSecret: null,
				},
			});

			res.json({ message: "MFA disabled successfully" });
		} catch (error) {
			console.error("MFA disable error:", error);
			res.status(500).json({ error: "Failed to disable MFA" });
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
				mfaEnabled: true,
				autoFulfillOnPayment: true,
				notifySms: true,
				notifyWhatsapp: true,
				notifyChat: true,
				notifyPayment: true,
				notifyOrder: true,
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
