import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (!token) {
		return res.status(401).json({ error: "Access token required" });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
				verified: true,
				accountStatus: true,
				mfaEnabled: true,
				passwordChangedAt: true,
			},
		});

		if (!user) {
			return res.status(401).json({ error: "Invalid token" });
		}

		if (user.accountStatus === "DISABLED") {
			return res.status(403).json({
				error: "Account is disabled pending admin review",
				accountDisabled: true,
				accountStatus: user.accountStatus,
			});
		}

		// Invalidate tokens issued before the last password change (stops account takeover reuse)
		if (decoded?.iat && user.passwordChangedAt) {
			const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
			if (changedAtSec > decoded.iat) {
				return res.status(401).json({ error: "Token has been revoked. Please login again." });
			}
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(403).json({ error: "Invalid or expired token" });
	}
};

const requireRole = (roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		// Enforce mandatory MFA across all role-protected routes
		if (!req.user.mfaEnabled) {
			return res.status(403).json({
				error: "MFA must be enabled to access this resource",
				mfaSetupRequired: true,
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ error: "Insufficient permissions" });
		}

		next();
	};
};

export { authenticateToken, requireRole };
