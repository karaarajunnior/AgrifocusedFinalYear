import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

function sha256Hex(input) {
	return crypto.createHash("sha256").update(input).digest("hex");
}

function accessTokenTtl() {
	return process.env.JWT_EXPIRES_IN || "2h";
}

function refreshTokenDays() {
	const d = Number(process.env.REFRESH_TOKEN_DAYS || 30);
	if (Number.isNaN(d) || d < 1 || d > 365) return 30;
	return d;
}

export function issueAccessToken({ userId }) {
	return jwt.sign({ userId }, process.env.JWT_SECRET||"mysecret", {

	return jwt.sign({ userId }, process.env.JWT_SECRET, {

		expiresIn: accessTokenTtl(),
	});
}

export async function issueRefreshToken({ userId }) {
	const token = crypto.randomBytes(48).toString("hex");
	const tokenHash = sha256Hex(token);
	const expiresAt = new Date(Date.now() + refreshTokenDays() * 24 * 60 * 60 * 1000);

	const created = await prisma.refreshToken.create({
		data: {
			userId,
			tokenHash,
			expiresAt,
		},
	});

	return { id: created.id, token, expiresAt };
}

export async function rotateRefreshToken({ refreshToken }) {
	const tokenHash = sha256Hex(String(refreshToken || ""));
	const existing = await prisma.refreshToken.findUnique({
		where: { tokenHash },
	});

	if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
		return { ok: false, reason: "invalid_refresh_token" };
	}

	const next = await issueRefreshToken({ userId: existing.userId });

	const updated = await prisma.refreshToken.update({
		where: { id: existing.id },
		data: {
			revokedAt: new Date(),
			replacedById: next.id,
		},
	});

	return { ok: true, userId: existing.userId, newRefreshToken: next, revoked: updated.id };
}

export async function revokeRefreshToken({ refreshToken }) {
	const tokenHash = sha256Hex(String(refreshToken || ""));
	const existing = await prisma.refreshToken.findUnique({
		where: { tokenHash },
	});
	if (!existing) return { ok: true, idempotent: true };
	if (existing.revokedAt) return { ok: true, idempotent: true };

	await prisma.refreshToken.update({
		where: { id: existing.id },
		data: { revokedAt: new Date() },
	});
	return { ok: true, idempotent: false };
}

