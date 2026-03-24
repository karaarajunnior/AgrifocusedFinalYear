import prisma from "../db/prisma.js";

/**
 * USSD Simulation Service
 * Simulates the menu flow for *284# DAFIS Mobile
 */

const SESSIONS = new Map(); // Mock session storage (In memory)

export async function handleUSSDRequest(msisdn, text, sessionId) {
    let session = SESSIONS.get(sessionId) || { step: 'START', data: {} };
    
    const parts = text.split('*');
    const input = parts[parts.length - 1]; // Get latest input

    let response = "";
    let endSession = false;

    if (input === "" || session.step === 'START') {
        response = "CON Welcome to DAFIS Mobile\n1. List Harvest\n2. Check Market Prices\n3. My Credit Score\n4. Help";
        session.step = 'MAIN_MENU';
    } else if (session.step === 'MAIN_MENU') {
        if (input === '1') {
            response = "CON Enter product type:\n1. Coffee\n2. Maize\n3. Beans";
            session.step = 'LIST_PRODUCT_TYPE';
        } else if (input === '2') {
            const prices = await prisma.marketPrice.findMany({ take: 3, orderBy: { timestamp: 'desc' } });
            response = "END Latest Prices:\n" + prices.map(p => `${p.commodity}: UGX ${p.pricePerKg}`).join("\n");
            endSession = true;
        } else if (input === '3') {
            const user = await prisma.user.findFirst({ where: { phone: msisdn } });
            if (!user) {
                response = "END Account not found. Please register on DAFIS App first.";
            } else {
                // Here we would call creditScoreService
                response = `END Your Credit Rating is GOOD.\nLimit: UGX 500,000`;
            }
            endSession = true;
        } else {
            response = "END Invalid choice. Try again.";
            endSession = true;
        }
    } else if (session.step === 'LIST_PRODUCT_TYPE') {
        session.data.type = input === '1' ? 'COFFEE' : (input === '2' ? 'MAIZE' : 'BEANS');
        response = `CON Enter quantity (kg) of ${session.data.type}:`;
        session.step = 'LIST_QUANTITY';
    } else if (session.step === 'LIST_QUANTITY') {
        session.data.quantity = input;
        response = `CON Enter your asking price per kg (UGX):`;
        session.step = 'LIST_PRICE';
    } else if (session.step === 'LIST_PRICE') {
        session.data.price = input;
        
        // Final Confirmation
        const user = await prisma.user.findFirst({ where: { phone: msisdn } });
        if (user) {
            // Map common types to Category enum if possible
            const type = session.data.type.toUpperCase();
            const categories = ['COFFEE', 'VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'POULTRY', 'ORGANIC', 'PROCESSED'];
            const finalCategory = categories.includes(type) ? type : 'ORGANIC';

            try {
                await prisma.product.create({
                    data: {
                        name: session.data.type,
                        category: finalCategory,
                        price: parseFloat(session.data.price),
                        quantity: parseInt(session.data.quantity) || 1,
                        location: user.location || 'Unknown',
                        farmerId: user.id
                    }
                });
                response = `END Harvest listed successfully! Buyers can now see your ${session.data.type}.`;
            } catch (err) {
                console.error("USSD Product Create Error:", err);
                response = `END Error saving harvest. Please ensure you are a registered farmer.`;
            }
        } else {
            response = `END User not found. Please register first.`;
        }
        endSession = true;
    }

    if (endSession) {
        SESSIONS.delete(sessionId);
    } else {
        SESSIONS.set(sessionId, session);
    }

    return response;
}
