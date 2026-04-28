import express from 'express';
import { translateText } from '../services/translate.service.js';
import { normalizeLocalLanguage } from '../services/translationService.js';

const router = express.Router();

/**
 * POST /api/translate
 * Expects JSON body: { text: "Hello", sourceLanguage: "en", targetLanguage: "ug" }
 */
router.post('/', async (req, res) => {
    try {
        const { text, sourceLanguage, targetLanguage } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required for translation' });
        }

        const source = normalizeLocalLanguage(sourceLanguage || 'en');
        const target = normalizeLocalLanguage(targetLanguage || 'ug');
        const translated = await translateText(text, source, target);
        
        res.json({ original: text, translated, sourceLanguage: source, targetLanguage: target });
    } catch (error) {
        console.error('Translation route error:', error);
        // Do not crash the client, return original as fallback
        res.json({ original: req.body?.text, translated: req.body?.text });
    }
});

export default router;
