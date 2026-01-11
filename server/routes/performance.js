import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get(
	"/",
	authenticateToken,
	requireRole(["ADMIN"]),
	(req, res) => {
		const mem = process.memoryUsage();
		res.json({
			uptimeSec: process.uptime(),
			node: process.version,
			platform: process.platform,
			memory: {
				rss: mem.rss,
				heapTotal: mem.heapTotal,
				heapUsed: mem.heapUsed,
				external: mem.external,
			},
			timestamp: new Date().toISOString(),
		});
	},
);

export default router;

