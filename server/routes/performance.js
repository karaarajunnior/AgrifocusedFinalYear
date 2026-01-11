import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { getRedis } from "../redis.js";

const router = express.Router();

router.get(
	"/",
	authenticateToken,
	requireRole(["ADMIN"]),
	(req, res) => {
		const mem = process.memoryUsage();
		const redis = getRedis();
		res.json({
			uptimeSec: process.uptime(),
			node: process.version,
			platform: process.platform,
			redis: {
				enabled: Boolean(redis),
				urlConfigured: Boolean(process.env.REDIS_URL),
			},
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

