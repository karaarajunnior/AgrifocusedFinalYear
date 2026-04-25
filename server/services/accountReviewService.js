import prisma from "../db/prisma.js";
import { writeAuditLog } from "./auditLogService.js";

const DEFAULT_INACTIVE_DAYS = Number(process.env.ACCOUNT_INACTIVE_REVIEW_DAYS || 30);
const ACCOUNT_REVIEW_SELECT = {
	id: true,
	name: true,
	email: true,
	role: true,
	verified: true,
	accountStatus: true,
	accountStatusReason: true,
	accountStatusChangedAt: true,
	createdAt: true,
	analytics: {
		where: { event: "login" },
		select: { timestamp: true },
		orderBy: { timestamp: "desc" },
		take: 1,
	},
	documents: {
		where: { status: "REJECTED" },
		select: { id: true, originalName: true, updatedAt: true },
		take: 3,
		orderBy: { updatedAt: "desc" },
	},
	exportApplications: {
		where: { status: "REJECTED" },
		select: { id: true, rejectionReason: true, updatedAt: true },
		take: 1,
		orderBy: { updatedAt: "desc" },
	},
};

function daysAgo(days) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isRecentAlert(existingAlert, thresholdDate) {
	return existingAlert && new Date(existingAlert.createdAt) >= thresholdDate;
}

async function notifyAdminsOnce({ user, type, body, actorUserId, metadata }) {
	const admins = await prisma.user.findMany({
		where: { role: "ADMIN", accountStatus: { not: "DISABLED" } },
		select: { id: true },
	});

	if (admins.length === 0) return 0;

	const dedupeSince = daysAgo(7);
	const recent = await prisma.notificationLog.findFirst({
		where: {
			type,
			body: { contains: user.id },
			createdAt: { gte: dedupeSince },
		},
		orderBy: { createdAt: "desc" },
	});

	if (isRecentAlert(recent, dedupeSince)) return 0;

	await prisma.$transaction(
		admins.map((admin) =>
			prisma.notificationLog.create({
				data: {
					userId: admin.id,
					type,
					channel: "in_app",
					to: "admin",
					body,
					provider: "account_review_ai",
					status: "delivered",
				},
			}),
		),
	);

	await writeAuditLog({
		actorUserId,
		action: type,
		targetType: "user",
		targetId: user.id,
		metadata,
	});

	return admins.length;
}

export async function evaluateUserForAccountReview({
	userId,
	reason = "compliance",
	notes = "",
	actorUserId,
} = {}) {
	if (!userId) throw new Error("userId is required");

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			verified: true,
			accountStatus: true,
			accountStatusReason: true,
			createdAt: true,
			products: { select: { id: true }, take: 1 },
			documents: {
				where: { status: "REJECTED" },
				select: { id: true },
				take: 1,
			},
			exportApplications: {
				where: { status: "REJECTED" },
				select: { id: true, rejectionReason: true },
				take: 1,
				orderBy: { updatedAt: "desc" },
			},
		},
	});

	if (!user) throw new Error("user_not_found");
	if (user.role === "ADMIN") {
		return { user, flagged: false, reason: "admins_are_not_reviewed" };
	}

	const signals = [];
	if (reason === "non_compliance" || reason === "compliance") {
		if (!user.verified) signals.push("User is not verified yet");
		if (user.documents.length > 0) signals.push("User has rejected documents");
		if (user.exportApplications.length > 0) signals.push("User has a rejected export application");
		if (notes) signals.push(notes);
	}

	if (signals.length === 0) {
		return { user, flagged: false, reason: "no_review_signal" };
	}

	const summary = signals.join("; ");
	await prisma.user.update({
		where: { id: user.id },
		data: {
			accountStatus: "REVIEW_REQUESTED",
			accountStatusReason: summary,
			accountStatusChangedAt: new Date(),
		},
	});

	const alertsSent = await notifyAdminsOnce({
		user,
		type: "account_review_non_compliance",
		body: `AI account review needed for ${user.name} (${user.id}). Reason: ${summary}. Admin can disable the account during review if needed.`,
		actorUserId: actorUserId || user.id,
		metadata: { reason, signals },
	});

	return { user: { ...user, accountStatus: "REVIEW_REQUESTED" }, flagged: true, alertsSent, signals };
}

export async function scanInactiveUsers({ inactiveDays = DEFAULT_INACTIVE_DAYS, limit = 50 } = {}) {
	const cutoff = daysAgo(inactiveDays);

	const users = await prisma.user.findMany({
		where: {
			role: { not: "ADMIN" },
			accountStatus: { not: "DISABLED" },
			OR: [
				{ analytics: { none: { timestamp: { gte: cutoff } } } },
				{
					analytics: {
						some: { event: "login" },
						none: { event: "login", timestamp: { gte: cutoff } },
					},
				},
			],
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			accountStatus: true,
			createdAt: true,
			analytics: {
				where: { event: "login" },
				select: { timestamp: true },
				orderBy: { timestamp: "desc" },
				take: 1,
			},
		},
		take: limit,
		orderBy: { updatedAt: "asc" },
	});

	let alertsSent = 0;
	const reviewed = [];

	for (const user of users) {
		const lastLoginAt = user.analytics[0]?.timestamp || user.createdAt;
		const reason = `Inactive for ${inactiveDays}+ days. Last seen: ${new Date(lastLoginAt).toISOString()}`;

		await prisma.user.update({
			where: { id: user.id },
			data: {
				accountStatus: "REVIEW_REQUESTED",
				accountStatusReason: reason,
				accountStatusChangedAt: new Date(),
			},
		});

		alertsSent += await notifyAdminsOnce({
			user,
			type: "account_review_inactive",
			body: `AI noticed inactive account ${user.name} (${user.id}). ${reason}. Admin can disable the account if appropriate.`,
			actorUserId: user.id,
			metadata: { inactiveDays, lastLoginAt },
		});

		reviewed.push({ ...user, lastLoginAt, accountStatus: "REVIEW_REQUESTED", reason });
	}

	return { inactiveDays, reviewed, alertsSent };
}

function buildReviewItem(user, inactiveDays = DEFAULT_INACTIVE_DAYS) {
	const lastSeenAt = user.analytics?.[0]?.timestamp || user.createdAt;
	const inactive = new Date(lastSeenAt) < daysAgo(inactiveDays);
	const reasons = [];

	if (inactive) {
		reasons.push(`Inactive for ${inactiveDays}+ days`);
	}
	if (!user.verified) {
		reasons.push("User is not verified");
	}
	if (user.documents?.length) {
		reasons.push("Rejected document needs review");
	}
	if (user.exportApplications?.length) {
		reasons.push("Rejected export application");
	}
	if (user.accountStatusReason) {
		reasons.push(user.accountStatusReason);
	}

	const riskLevel = user.accountStatus === "DISABLED"
		? "high"
		: reasons.length > 1
			? "high"
			: reasons.length === 1
				? "medium"
				: "low";

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		verified: user.verified,
		accountStatus: user.accountStatus || "ACTIVE",
		riskLevel,
		riskReason: reasons[0] || "No active issue found",
		complianceFlags: reasons.slice(1),
		lastSeenAt,
		recommendedAction:
			riskLevel === "high"
				? "Review now. Disable only if the account is unsafe or non-compliant."
				: "Check the user and keep active if the issue is resolved.",
	};
}

export async function getAccountReviewSummary({ inactiveDays = DEFAULT_INACTIVE_DAYS, limit = 50 } = {}) {
	const cutoff = daysAgo(inactiveDays);
	const users = await prisma.user.findMany({
		where: {
			role: { not: "ADMIN" },
			OR: [
				{ accountStatus: { in: ["REVIEW_REQUESTED", "DISABLED"] } },
				{ verified: false },
				{ documents: { some: { status: "REJECTED" } } },
				{ exportApplications: { some: { status: "REJECTED" } } },
				{ analytics: { none: { timestamp: { gte: cutoff } } } },
				{
					analytics: {
						some: { event: "login" },
						none: { event: "login", timestamp: { gte: cutoff } },
					},
				},
			],
		},
		select: ACCOUNT_REVIEW_SELECT,
		orderBy: [
			{ accountStatusChangedAt: "desc" },
			{ updatedAt: "asc" },
		],
		take: limit,
	});

	const reviews = users.map((user) => buildReviewItem(user, inactiveDays));
	return {
		inactiveDays,
		reviews,
		counts: {
			total: reviews.length,
			highRisk: reviews.filter((review) => review.riskLevel === "high").length,
			disabled: reviews.filter((review) => review.accountStatus === "DISABLED").length,
			reviewRequested: reviews.filter((review) => review.accountStatus === "REVIEW_REQUESTED").length,
		},
	};
}

export async function setAccountStatus({
	adminUserId,
	targetUserId,
	status,
	reason,
	ip,
	userAgent,
}) {
	const existing = await prisma.user.findUnique({
		where: { id: targetUserId },
		select: { id: true, role: true },
	});

	if (!existing) {
		const error = new Error("user_not_found");
		error.statusCode = 404;
		throw error;
	}

	if (existing.role === "ADMIN") {
		const error = new Error("cannot_change_admin_status");
		error.statusCode = 400;
		throw error;
	}

	const updated = await prisma.user.update({
		where: { id: targetUserId },
		data: {
			accountStatus: status,
			accountStatusReason: reason || null,
			accountStatusChangedAt: new Date(),
			...(status === "DISABLED" ? { verified: false } : {}),
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			verified: true,
			accountStatus: true,
			accountStatusReason: true,
			accountStatusChangedAt: true,
		},
	});

	await writeAuditLog({
		actorUserId: adminUserId,
		action: "account_status_update",
		targetType: "user",
		targetId: targetUserId,
		ip,
		userAgent,
		metadata: { status, reason },
	});

	return updated;
}

export async function runAccountReview() {
	return scanInactiveUsers();
}
