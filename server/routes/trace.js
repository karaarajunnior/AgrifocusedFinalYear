import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get traceability record for a product (Public)
router.get('/:batchNumber', async (req, res) => {
	try {
		const record = await prisma.traceabilityRecord.findUnique({
			where: { batchNumber: req.params.batchNumber },
			include: {
				farmer: {
					select: {
						name: true,
						location: true,
						avatar: true,
						country: true
					}
				}
			}
		});

		if (!record) {
			return res.status(404).json({ error: 'Traceability record not found for this batch' });
		}

		res.json({ record });
	} catch (error) {
		res.status(500).json({ error: 'Failed' });
	}
});

// Create/Update traceability (Farmer only)
router.post('/record', authenticateToken, async (req, res) => {
	try {
		const farmerId = req.user.id;
		const {
			productId,
			batchNumber,
			altitude,
			variety,
			processingMethod,
			story,
			mapLocation
		} = req.body;

		const record = await prisma.traceabilityRecord.upsert({
			where: { batchNumber },
			update: {
				altitude: parseInt(altitude),
				variety,
				processingMethod,
				story,
				mapLocation
			},
			create: {
				productId,
				batchNumber,
				farmerId,
				altitude: parseInt(altitude),
				variety,
				processingMethod,
				story,
				mapLocation
			}
		});

		res.json({ message: 'Traceability record updated', record });
	} catch (error) {
		res.status(500).json({ error: 'Failed to save traceability' });
	}
});

export default router;
