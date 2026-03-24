/**
 * Zero-cost Local Translation Service for DAFIS.
 * Provides dictionary-based translations for common agricultural terms 
 * in Ugandan dialects to support illiterate/non-English speaking farmers.
 */

const DICTIONARY = {
    luganda: {
        "coffee": "emmwanyi",
        "price": "omuwendo",
        "harvest": "amakungula",
        "payment": "okusasula",
        "market": "akatale",
        "farmer": "omulunzi/omulimi",
        "buyer": "omulunzi",
        "fertilizer": "ebigimusa",
        "seeds": "ensigo",
        "weather": "embeera y'obudde",
        "rain": "enkuba",
        "sun": "omusana",
        "hello": "ki kati",
        "how much": "mmeka",
        "confirmed": "kakakasiddwa",
        "pending": "akyalindiriddwa",
        "delivered": "atussiddwa",
        "i want to buy": "njala okugula",
        "i want to sell": "njala okutunda",
        "input": "ebikozesebwa",
        "shop": "edduuka",
        "location": "ekifo",
    },
    runyankore: {
        "coffee": "emwani",
        "price": "omuhendo",
        "harvest": "amakungura",
        "payment": "okushashura",
        "market": "akatare",
        "farmer": "omuhingi",
        "fertilizer": "ebigyimusa",
        "seeds": "ensigo",
        "weather": "embeera y'obwire",
        "hello": "agandi",
        "how much": "zingahi",
    },
    acholi: {
        "coffee": "kawa",
        "price": "wel",
        "harvest": "acaka",
        "payment": "cul",
        "market": "cuk",
        "farmer": "lapur",
        "fertilizer": "pur",
        "seeds": "koti",
        "weather": "piny",
        "hello": "itye ningning",
    }
};

/**
 * Translates a sentence by looking up common words.
 * For complex sentences, it provides a 'best-effort' gist.
 */
export function translateLocal(text, targetLang) {
    if (!text || !targetLang || targetLang === 'english') return text;
    
    const langDict = DICTIONARY[targetLang.toLowerCase()];
    if (!langDict) return text;

    let translated = text.toLowerCase();
    
    // Simple greedy replacement for common terms
    const sortedKeys = Object.keys(langDict).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        translated = translated.replace(regex, langDict[key]);
    }

    return translated;
}
