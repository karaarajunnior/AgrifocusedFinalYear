import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import { generateMfaSetup, verifyTotp } from "../services/mfaService.js";
import {
	issueAccessToken,
	issueRefreshToken,
	rotateRefreshToken,
	revokeRefreshToken,
} from "../services/tokenService.js";
import { writeAuditLog } from "../services/auditLogService.js";

export async function register(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password, name, role, phone, location, address } = req.body;

		const existingUser = await prisma.user.findUnique({ where: { email } });
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
				passwordChangedAt: new Date(),
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

		const token = issueAccessToken({ userId: user.id });
		const refresh = await issueRefreshToken({ userId: user.id });

		await writeAuditLog({
			actorUserId: user.id,
			action: "auth_register",
			targetType: "user",
			targetId: user.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { role: user.role },
		});

		res.status(201).json({
			message: "User registered successfully",
			user,
			token,
			refreshToken: refresh.token,
			refreshTokenExpiresAt: refresh.expiresAt,
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ error: "Registration failed" });
	}
}

export async function login(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password, mfaCode } = req.body;
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(400).json({ error: "Invalid credentials" });

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
			if (!ok) return res.status(401).json({ error: "Invalid MFA code" });
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

		const token = issueAccessToken({ userId: user.id });
		const refresh = await issueRefreshToken({ userId: user.id });

		await writeAuditLog({
			actorUserId: user.id,
			action: "auth_login",
			targetType: "user",
			targetId: user.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});

		const { password: _pw, ...userWithoutPassword } = user;
		res.json({
			message: "Login successful",
			user: userWithoutPassword,
			token,
			refreshToken: refresh.token,
			refreshTokenExpiresAt: refresh.expiresAt,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "Login failed" });
	}
}

export async function refresh(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const rotated = await rotateRefreshToken({ refreshToken: req.body.refreshToken });
		if (!rotated.ok) return res.status(401).json({ error: "Invalid refresh token" });

		const token = issueAccessToken({ userId: rotated.userId });
		res.json({
			token,
			refreshToken: rotated.newRefreshToken.token,
			refreshTokenExpiresAt: rotated.newRefreshToken.expiresAt,
		});
	} catch (error) {
		console.error("Refresh token error:", error);
		res.status(500).json({ error: "Failed to refresh token" });
	}
}

export async function logout(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
		if (req.body.refreshToken) {
			await revokeRefreshToken({ refreshToken: req.body.refreshToken });
		}
		res.json({ ok: true });
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({ error: "Failed to logout" });
	}
}

export async function mfaSetup(req, res) {
	try {
		const setup = await generateMfaSetup(req.user.email);
		await prisma.user.update({
			where: { id: req.user.id },
			data: { mfaTempSecret: setup.base32 },
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
}

export async function mfaVerify(req, res) {
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
		if (!ok) return res.status(400).json({ error: "Invalid MFA code" });

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
}

export async function mfaDisable(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const user = await prisma.user.findUnique({ where: { id: req.user.id } });
		if (!user?.mfaEnabled) return res.status(400).json({ error: "MFA is not enabled" });

		const okPassword = await bcrypt.compare(req.body.password, user.password);
		if (!okPassword) return res.status(400).json({ error: "Invalid password" });

		const okTotp = verifyTotp({ secretBase32: user.mfaSecret, token: req.body.code });
		if (!okTotp) return res.status(400).json({ error: "Invalid MFA code" });

		await prisma.user.update({
			where: { id: req.user.id },
			data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null },
		});

		res.json({ message: "MFA disabled successfully" });
	} catch (error) {
		console.error("MFA disable error:", error);
		res.status(500).json({ error: "Failed to disable MFA" });
	}
}

export async function me(req, res) {
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
				walletAddress: true,
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
}

