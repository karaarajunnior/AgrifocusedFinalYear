import axios from 'axios';

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
    
    // Map internal codes to Sunbird supported language codes
    const mapLang = (lang) => {
        const lower = lang.toLowerCase();
        if (lower === 'en' || lower === 'eng' || lower === 'english') return 'eng';
        if (lower === 'ug' || lower === 'lug' || lower === 'luganda') return 'lug';
        if (lower === 'ach' || lower === 'acholi') return 'ach';
        if (lower === 'teo' || lower === 'ateso') return 'teo';
        if (lower === 'lgg' || lower === 'lugbara') return 'lgg';
        if (lower === 'nyn' || lower === 'runyankole' || lower === 'runyankore') return 'nyn';
        return lower;
    };
    
    const src = mapLang(sourceLang);
    const tgt = mapLang(targetLang);
    
    // Don't translate if languages match
    if (src === tgt) return text;

    const cacheKey = `${src}_${tgt}_${text}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    const apiKey = process.env.sunbird_api_key;
    if (!apiKey) {
        console.warn('Sunbird API key missing in .env. Returning original text.');
        return text;
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

        translationCache.set(cacheKey, translated);
        return translated;
        
    } catch (error) {
        console.error('Error translating text via Sunbird:', error.response ? error.response.data : error.message);
        // Gracefully fallback to original text if translation completely fails
        return text;
    }
};
