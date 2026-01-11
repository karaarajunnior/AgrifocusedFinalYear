import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function writeAuditLog({
	actorUserId = null,
	action,
	targetType = null,
	targetId = null,
	ip = null,
	userAgent = null,
	metadata = null,
}) {
	try {
		if (!action) return;
		await prisma.auditLog.create({
			data: {
				actorUserId: actorUserId || null,
				action: String(action),
				targetType: targetType ? String(targetType) : null,
				targetId: targetId ? String(targetId) : null,
				ip: ip ? String(ip) : null,
				userAgent: userAgent ? String(userAgent) : null,
				metadata: metadata ? JSON.stringify(metadata) : null,
			},
		});
	} catch (e) {
		// Never break user flow because of logging
		console.warn("Audit log write failed:", e?.message || e);
	}
}

