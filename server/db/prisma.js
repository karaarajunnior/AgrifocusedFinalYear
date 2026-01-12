import { PrismaClient } from "@prisma/client";

// Ensure a single PrismaClient instance across imports/hot-reloads.
const globalForPrisma = globalThis;

const prisma =
	globalForPrisma.__agri_prisma ||
	new PrismaClient({
		log: ["warn", "error"],
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.__agri_prisma = prisma;
}

export default prisma;

