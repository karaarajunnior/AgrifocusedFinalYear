/**
 * Zero-cost Local Translation Service for DAFIS.
 * Provides dictionary-based translations for common agricultural terms 
 * in Ugandan dialects to support illiterate/non-English speaking farmers.
 */

const LANGUAGE_ALIASES = {
    en: "english",
    eng: "english",
    english: "english",
    ug: "luganda",
    lug: "luganda",
    luganda: "luganda",
    ach: "acholi",
    acholi: "acholi",
    nyn: "runyankore",
    runyankole: "runyankore",
    runyankore: "runyankore",
    teo: "ateso",
    ateso: "ateso",
    lgg: "lugbara",
    lugbara: "lugbara",
};

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
    },
    ateso: {},
    lugbara: {},
};

const LOCAL_TO_ENGLISH_PHRASES = {
    luganda: [
        ["genda ku dashboard", "go to dashboard"],
        ["genda ku katale", "go to market"],
        ["genda ku akatale", "go to market"],
        ["genda ku chat", "go to chat"],
        ["genda ku profile", "go to profile"],
        ["teeka", "list"],
        ["tunda", "sell"],
        ["noonya", "search"],
        ["gula", "buy"],
        ["kaawa", "coffee"],
        ["emmwanyi", "coffee"],
        ["akatale", "market"],
        ["obungi", "quantity"],
        ["omuwendo", "price"],
    ],
    runyankore: [
        ["za omu dashboard", "go to dashboard"],
        ["za omu katare", "go to market"],
        ["emwani", "coffee"],
        ["akatare", "market"],
        ["omuhendo", "price"],
        ["gura", "buy"],
        ["guza", "sell"],
        ["sherura", "search"],
    ],
    acholi: [
        ["cit i dashboard", "go to dashboard"],
        ["cit i cuk", "go to market"],
        ["kawa", "coffee"],
        ["cuk", "market"],
        ["wel", "price"],
        ["wil", "buy"],
        ["cat", "sell"],
    ],
};

export function normalizeLocalLanguage(lang) {
    if (!lang) return "english";
    return LANGUAGE_ALIASES[String(lang).trim().toLowerCase()] || String(lang).trim().toLowerCase();
}

/**
 * Translates a sentence by looking up common words.
 * For complex sentences, it provides a 'best-effort' gist.
 */
export function translateLocal(text, targetLang) {
    const normalizedTarget = normalizeLocalLanguage(targetLang);
    if (!text || !targetLang || normalizedTarget === 'english') return text;
    
    const langDict = DICTIONARY[normalizedTarget];
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

export function translateLocalToEnglish(text, sourceLang) {
    const normalizedSource = normalizeLocalLanguage(sourceLang);
    if (!text || normalizedSource === "english") return text;

    let translated = text.toLowerCase();
    const phraseMap = LOCAL_TO_ENGLISH_PHRASES[normalizedSource] || [];
    for (const [local, english] of phraseMap.sort((a, b) => b[0].length - a[0].length)) {
        translated = translated.replace(new RegExp(`\\b${local}\\b`, "gi"), english);
    }

    const dictionary = DICTIONARY[normalizedSource] || {};
    const reverseEntries = Object.entries(dictionary)
        .sort((a, b) => String(b[1]).length - String(a[1]).length);
    for (const [english, local] of reverseEntries) {
        const localText = String(local).split("/")[0].trim();
        if (!localText) continue;
        translated = translated.replace(new RegExp(`\\b${localText}\\b`, "gi"), english);
    }

    return translated;
}

export function translateWithLocalFallback(text, sourceLang, targetLang) {
    const source = normalizeLocalLanguage(sourceLang);
    const target = normalizeLocalLanguage(targetLang);
    if (!text || source === target) return text;
    if (target === "english") return translateLocalToEnglish(text, source);
    if (source === "english") return translateLocal(text, target);
    return translateLocal(translateLocalToEnglish(text, source), target);
}
