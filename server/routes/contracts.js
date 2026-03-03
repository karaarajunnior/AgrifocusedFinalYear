import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get farmer's contracts
router.get('/my-contracts', authenticateToken, async (req, res) => {
    try {
        const contracts = await prisma.forwardContract.findMany({
            where: {
                OR: [
                    { farmerId: req.user.id },
                    { buyerId: req.user.id }
                ]
            },
            include: {
                farmer: { select: { name: true } },
                buyer: { select: { name: true } }
            }
        });
        res.json({ contracts });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Propose a forward contract
router.post('/propose', authenticateToken, async (req, res) => {
    try {
        const { farmerId, commodity, quantity, pricePerUnit, deliveryMonth, terms } = req.body;
        const buyerId = req.user.id; // Usually buyers propose to farmers or vice versa

        const contract = await prisma.forwardContract.create({
            data: {
                farmerId,
                buyerId,
                commodity,
                quantity,
                pricePerUnit,
                totalValuation: quantity * pricePerUnit,
                deliveryMonth,
                terms,
                status: 'PROPOSED'
            }
        });

        res.json({ message: 'Contract proposal sent', contract });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Update contract status
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const contract = await prisma.forwardContract.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json({ message: 'Contract updated', contract });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
