import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get farmer's grading requests
router.get('/my-requests', authenticateToken, async (req, res) => {
    try {
        const requests = await prisma.gradingRequest.findMany({
            where: { userId: req.user.id }
        });
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Request quality grading
router.post('/apply', authenticateToken, async (req, res) => {
    try {
        const { commodity } = req.body;
        const request = await prisma.gradingRequest.create({
            data: {
                userId: req.user.id,
                commodity,
                status: 'PENDING'
            }
        });
        res.json({ message: 'Grading request submitted', request });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin/Grader update results
router.patch('/review/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        const { grade, aromaScore, flavorScore, bodyScore, notes, status } = req.body;
        const request = await prisma.gradingRequest.update({
            where: { id: req.params.id },
            data: {
                grade,
                aromaScore,
                flavorScore,
                bodyScore,
                notes,
                status
            }
        });
        res.json({ message: 'Grading results updated', request });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
