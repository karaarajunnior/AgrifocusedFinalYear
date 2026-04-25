import api from './api';

/**
 * Requests a dynamic translation from the backend (which uses Sunbird AI).
 * @param text The text to translate
 * @param sourceLanguage Source language code (e.g. 'en')
 * @param targetLanguage Target language code (e.g. 'ug' / Luganda)
 * @returns The translated string, or original text if it fails
 */
export const requestTranslation = async (
    text: string, 
    sourceLanguage: string = 'en', 
    targetLanguage: string = 'ug'
): Promise<string> => {
    if (!text || text.trim() === '') return text;
    if (sourceLanguage === targetLanguage) return text;

    try {
        const response = await api.post('/translate', {
            text,
            sourceLanguage,
            targetLanguage
        });

        if (response.data && response.data.translated) {
            return response.data.translated;
        }
        return text;
    } catch (error) {
        console.error('Translation request failed:', error);
        return text;
    }
};
