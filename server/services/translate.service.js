import axios from 'axios';
import { normalizeLocalLanguage, translateLocal } from './translationService.js';

// Simple in-memory cache to prevent redundant API calls for exact same text strings
const translationCache = new Map();

/**
 * Translates text using the Sunbird AI API.
 * @param {string} text - The text to translate
 * @param {string} sourceLang - 'en'/'eng' etc.
 * @param {string} targetLang - 'ug'/'lug' etc.
 * @returns {Promise<string>} - The translated string
 */
export const translateText = async (text, sourceLang = 'en', targetLang = 'ug') => {
    if (!text || text.trim() === '') return text;

    const src = normalizeLocalLanguage(sourceLang);
    const tgt = normalizeLocalLanguage(targetLang);
    
    // Don't translate if languages match
    if (src === tgt) return text;

    const cacheKey = `${src}_${tgt}_${text}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    const apiKey = process.env.sunbird_api_key;
    if (!apiKey) {
        return translateLocal(text, tgt, src);
    }

    try {
        const url = 'https://api.sunbird.ai/tasks/nllb_translate';
        
        // As per Sunbird AI specification
        const payload = {
            text: text,
            source_language: src,
            target_language: tgt
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let translated = text;
        const data = response.data;
        
        // Handle varying possible JSON response structures from the API
        if (typeof data === 'string') {
            translated = data;
        } else if (data?.output) {
            translated = data.output;
        } else if (data?.text) {
            translated = data.text;
        } else if (data?.translation) {
            translated = data.translation;
        }

        if (!translated || translated === text) {
            translated = translateLocal(text, tgt, src);
        }

        translationCache.set(cacheKey, translated);
        return translated;
        
    } catch (error) {
        console.error('Error translating text via Sunbird:', error.response ? error.response.data : error.message);
        return translateLocal(text, tgt, src);
    }
};
