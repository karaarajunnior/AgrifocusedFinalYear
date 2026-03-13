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

// Buy agro-input (Farmer only)
router.post('/buy', authenticateToken, requireRole(['FARMER']), async (req, res) => {
    try {
        const { agroInputId, quantity } = req.body;
        const farmerId = req.user.id;

        const input = await prisma.agroInput.findUnique({
            where: { id: agroInputId }
        });

        if (!input) return res.status(404).json({ error: 'Input not found' });

        const totalAmount = input.price * quantity;

        const purchase = await prisma.inputPurchase.create({
            data: {
                farmerId,
                shopId: input.shopId,
                agroInputId,
                quantity,
                totalAmount
            }
        });

        res.json({ message: 'Purchase successful', purchase });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Failed to complete purchase' });
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

// Admin: Get all agro-inputs
router.get('/admin/list', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        const inputs = await prisma.agroInput.findMany({
            include: {
                shop: {
                    select: { name: true, location: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ inputs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch inputs' });
    }
});

// Admin: Create agro-input
router.post('/admin/create', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        const { name, description, price, unit, category, shopId } = req.body;
        const input = await prisma.agroInput.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                unit,
                category,
                shopId
            }
        });
        res.status(201).json({ message: 'Agro-input created successfully', input });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create agro-input' });
    }
});

// Admin: Delete agro-input
router.delete('/admin/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        await prisma.agroInput.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Agro-input deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete agro-input' });
    }
});

// Admin: List all agro-shops
router.get('/admin/shops', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        const shops = await prisma.user.findMany({
            where: { role: 'AGRO_SHOP' },
            select: { id: true, name: true, location: true }
        });
        res.json({ shops });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

export default router;
