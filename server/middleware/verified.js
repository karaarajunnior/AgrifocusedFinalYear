export function requireVerified(req, res, next) {
	// Admins bypass verification gating
	if (req.user?.role === "ADMIN") return next();
	if (!req.user?.verified) {
		return res.status(403).json({
			error: "Account not verified. Please wait for admin approval.",
		});
	}
	return next();
}

