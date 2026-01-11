import { computeTrustScore } from "../services/trustScoreService.js";

export async function getTrustScore(req, res) {
	try {
		const userId = String(req.params.userId || "");
		if (!userId) return res.status(400).json({ error: "userId required" });

		const score = await computeTrustScore({ userId });
		if (!score) return res.status(404).json({ error: "User not found" });

		res.json({ trust: score });
	} catch (error) {
		console.error("Trust score error:", error);
		res.status(500).json({ error: "Failed to compute trust score" });
	}
}

