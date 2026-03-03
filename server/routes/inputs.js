import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all agro-inputs
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category } = req.query;
        const inputs = await prisma.agroInput.findMany({
            where: {
                inStock: true,
                ...(category && { category: String(category) })
            },
            include: {
                shop: {
                    select: {
                        name: true,
                        location: true
                    }
                }
            }
        });
        res.json({ inputs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch inputs' });
    }
});

// Apply for input credit (Farmer only)
router.post('/credit/apply', authenticateToken, requireRole(['FARMER']), async (req, res) => {
    try {
        const { agroInputId, quantity } = req.body;
        const farmerId = req.user.id;

        const input = await prisma.agroInput.findUnique({
            where: { id: agroInputId }
        });

        if (!input) return res.status(404).json({ error: 'Input not found' });

        const totalAmount = input.price * quantity;

        const credit = await prisma.inputCredit.create({
            data: {
                farmerId,
                shopId: input.shopId,
                agroInputId,
                quantity,
                totalAmount,
                status: 'PENDING'
            }
        });

        res.json({ message: 'Credit application submitted', credit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit credit application' });
    }
});

// Get farmer's credits
router.get('/my-credits', authenticateToken, async (req, res) => {
    try {
        const credits = await prisma.inputCredit.findMany({
            where: { farmerId: req.user.id },
            include: {
                agroInput: true,
                shop: {
                    select: { name: true }
                }
            }
        });
        res.json({ credits });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch credits' });
    }
});

// Get shop's credit requests (Agro-shop only)
router.get('/shop/requests', authenticateToken, requireRole(['AGRO_SHOP']), async (req, res) => {
    try {
        const requests = await prisma.inputCredit.findMany({
            where: { shopId: req.user.id },
            include: {
                farmer: {
                    select: { name: true, location: true }
                },
                agroInput: true
            }
        });
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Review credit request
router.patch('/shop/review/:id', authenticateToken, requireRole(['AGRO_SHOP']), async (req, res) => {
    try {
        const { status } = req.body;
        const credit = await prisma.inputCredit.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json({ message: `Credit ${status.toLowerCase()}`, credit });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
