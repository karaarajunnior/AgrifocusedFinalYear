import prisma from "../db/prisma.js";

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export async function computeCreditScore(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            sales: { where: { status: "DELIVERED" } },
            purchases: true,
            credits: true,
        }
    });

    if (!user || user.role !== "FARMER") return null;

    let score = 300; // Base FICO-like scale starting point (300-850)
    const reasons = [];

    // 1. Transaction Volume (verified income)
    const totalIncome = user.sales.reduce((sum, o) => sum + o.totalPrice, 0);
    const incomePoints = Math.min(200, Math.floor(totalIncome / 100000) * 10); // +10 per 100k UGX
    if (incomePoints > 0) {
        score += incomePoints;
        reasons.push(`Verified income: UGX ${totalIncome.toLocaleString()}`);
    }

    // 2. Input Investment (shows professional growth)
    const totalInputs = user.purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const inputPoints = Math.min(100, Math.floor(totalInputs / 50000) * 20);
    if (inputPoints > 0) {
        score += inputPoints;
        reasons.push("Investment in quality inputs");
    }

    // 3. Credit History (Agro-input credits)
    const repaidCredits = user.credits.filter(c => c.repaymentStatus === true).length;
    const defaultCredits = user.credits.filter(c => c.status === "REJECTED").length; // Using REJECTED or a specific overdue status if exists
    
    score += Math.min(150, repaidCredits * 30);
    if (repaidCredits > 0) reasons.push(`${repaidCredits} credits repaid successfully`);
    
    score -= defaultCredits * 100;
    if (defaultCredits > 0) reasons.push(`${defaultCredits} unfavorable credit records`);

    // 4. Verification Multiplier
    if (user.verified) {
        score += 50;
        reasons.push("DAFIS Identity Verified");
    }

    score = clamp(score, 300, 850);

    let rating = "Fair";
    if (score >= 700) rating = "Excellent";
    else if (score >= 600) rating = "Good";

    return {
        score,
        rating,
        reasons: reasons.slice(0, 5),
        totalIncome,
        repaidCount: repaidCredits
    };
}
