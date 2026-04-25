import { requestTranslation } from '../services/translationApi';

export type Language = 'en' | 'ug' | 'ach' | 'teo' | 'lgg' | 'nyn';

export const languageNames: Record<Language, string> = {
    en: 'English',
    ug: 'Luganda',
    ach: 'Acholi',
    teo: 'Ateso',
    lgg: 'Lugbara',
    nyn: 'Runyankole'
};

export const staticTranslations: Record<Language, Record<string, string>> = {
    en: {
        'dashboard': 'Dashboard',
        'my_listings': 'My Listings',
        'add_product': 'Add Product',
        'chat': 'Chat',
        'orders': 'Orders',
        'logistics': 'Logistics',
        'proactive_engagement': 'Proactive Engagement: Recent Buyers',
        'voice_assistant_active': 'Voice assistant active. How can I help you today?',
        'searching_for': 'Searching for',
        'command_not_recognized': 'Command not recognized. Try saying "Go to dashboard" or "List 50kg Coffee".',
        'suggested_commands': 'Try saying:',
        'list_command_hint': '"List 50kg of Coffee"',
        'search_command_hint': '"Search for Honey"',
        'navigation_command_hint': '"Go to Logistics"',
        'origin': 'Origin',
        'processing': 'Processing',
        'current': 'Current',
        'exact_origin': 'Exact Point of Origin',
        'market': 'Market',
        'farmer': 'Farmer',
        'buyer': 'Buyer',
        'admin': 'Admin',
        'marketplace_title': 'Fresh Produce Marketplace',
        'marketplace_subtitle': 'Discover fresh, quality produce directly from verified farmers across the region',
        'search_placeholder': 'Search for products, farmers, or locations...',
        'newest_first': 'Newest First',
        'price_low_high': 'Price: Low to High',
        'price_high_low': 'Price: High to Low',
        'highest_rated': 'Highest Rated',
        'filters': 'Filters',
        'category': 'Category',
        'all_categories': 'All Categories',
        'min_price': 'Min Price (UGX)',
        'max_price': 'Max Price (UGX)',
        'organic_only': 'Organic Only',
        'clear_filters': 'Clear All Filters',
        'found_products': 'Found',
        'products': 'products',
        'no_products_found': 'No products found',
        'no_products_desc': 'Try adjusting your search terms or filters to find what you are looking for.',
        'available': 'Available:',
        'view_details': 'View Details',
        'order': 'Order',
        'organic_badge': '🌿 Organic',
        'signup_buyer': 'Sign Up as Buyer',
        'have_account': 'Already have an account?',
        'ready_to_buy': 'Ready to start buying fresh produce?'
    },
    ug: { // Luganda
        'dashboard': 'Ebisiko byaffe',
        'my_listings': 'Ebyamaguzibye',
        'add_product': 'Yongerako Ekyamaguzi',
        'chat': 'Muzzeyo',
        'orders': 'Ebiragiro',
        'logistics': 'Entambula',
        'proactive_engagement': 'Abaguzi abapya',
        'voice_assistant_active': 'Obuyambi bw’eddoboozi butandise. Buyinza butya okukuyamba lelo?',
        'searching_for': 'Nnoonya',
        'command_not_recognized': 'Ekigambo kino tekinyuse. Gezaako okugamba "Genda ku dashboard" oba "Teeka 50kg za kaawa".',
        'suggested_commands': 'Gezaako okugamba:',
        'list_command_hint': '"Teeka 50kg za kaawa"',
        'search_command_hint': '"Noonya omubisi gw’enjuki"',
        'navigation_command_hint': '"Genda ku ntambula"',
        'origin': 'Ensiba',
        'processing': 'Okukanika',
        'current': 'Wano',
        'exact_origin': 'Ennamba y’olusaaga',
        'market': 'Akatale',
        'farmer': 'Omulunzi',
        'buyer': 'Omuguzi',
        'admin': 'Omuddukanya',
        'marketplace_title': 'Akatale k\'Ebirime Ebipya',
        'marketplace_subtitle': 'Zuula ebirime ebipya, eby\'omutindo okuva butereevu eri abalimi abakakasibwa',
        'search_placeholder': 'Noonya ebirime, abalimi, oba ebifo...',
        'newest_first': 'Ebipya Bisooke',
        'price_low_high': 'Omuwendo: Omutono Okudda Waggulu',
        'price_high_low': 'Omuwendo: Omunene Okudda Wansi',
        'highest_rated': 'Ebisinga Obulungi',
        'filters': 'Sengejja',
        'category': 'Ekika',
        'all_categories': 'Ebika Byonna',
        'min_price': 'Omuwendo Omutono (UGX)',
        'max_price': 'Omuwendo Omunene (UGX)',
        'organic_only': 'Ebitagattiddwamu Dagala',
        'clear_filters': 'Gyawo Ensengejja Zonna',
        'found_products': 'Zudde',
        'products': 'eby amaguzi',
        'no_products_found': 'Tewali byamaguzi bizuuliddwa',
        'no_products_desc': 'Gezaako okukyusa ebigambo by\'onoonya oba ensengejja.',
        'available': 'Ebiriwo:',
        'view_details': 'Laba Ebisingawo',
        'order': 'Gula',
        'organic_badge': '🌿 Terina Dagala',
        'signup_buyer': 'Wandiisa ng\'Omuguzi',
        'have_account': 'Olinayo akawunti?',
        'ready_to_buy': 'Weetegese okutandika okugula ebirime ebipya?'
    },
    ach: {}, // Acholi
    teo: {}, // Ateso
    lgg: {}, // Lugbara
    nyn: {}  // Runyankole
};

const getDynamicTranslations = () => {
    try {
        const cached = localStorage.getItem('agri_dynamic_translations');
        if (cached) return JSON.parse(cached);
    } catch (e) {
        console.error("Failed to parse dynamic translations", e);
    }
    return { en: {}, ug: {} };
};

export const dynamicTranslations = getDynamicTranslations();
export const missingKeysQueue = new Set<string>();
let onMissingKeyDiscovered: ((keys: string[]) => void) | null = null;

export const setOnMissingKeyCallback = (cb: (keys: string[]) => void) => {
    onMissingKeyDiscovered = cb;
};

export const saveDynamicTranslations = () => {
    localStorage.setItem('agri_dynamic_translations', JSON.stringify(dynamicTranslations));
};

export const setLanguage = (lang: Language) => {
    localStorage.setItem('agri_lang', lang);
};

export const getLanguage = (): Language => {
    return (localStorage.getItem('agri_lang') as Language) || 'en';
};

/**
 * Universal text translator hook. Provides immediate synchronous fallback to English, 
 * but logs misses for the LanguageContext to fetch dynamically from Sunbird AI.
 */
export const t = (key: string): string => {
    if (!key) return key;
    
    // Ignore trying to translate numbers or tiny chars
    if (!isNaN(Number(key)) || key.length < 2) return key;

    const lang = getLanguage();
    
    // Check static dictionaries first
    if (staticTranslations[lang] && staticTranslations[lang][key]) {
        return staticTranslations[lang][key];
    }
    
    const englishFallback = staticTranslations['en'][key] || key;
    
    // If we're operating in English, we're done here
    if (lang === 'en') return englishFallback;

    // Check dynamic local cache 
    if (dynamicTranslations[lang] && dynamicTranslations[lang][englishFallback]) {
        return dynamicTranslations[lang][englishFallback];
    }

    // Key is missing in the target language - queue it for background translation!
    if (!missingKeysQueue.has(englishFallback)) {
        missingKeysQueue.add(englishFallback);
        if (onMissingKeyDiscovered) {
            onMissingKeyDiscovered(Array.from(missingKeysQueue));
        }
    }

    // Immediately return english text so UI doesn't crash or stutter while waiting for network
    return englishFallback;
};

/**
 * Specifically converts spoken voice text depending on current selected language.
 * Now dynamically triggers Sunbird translation if needed before mapping intents.
 */
export const translateCommandAsync = async (voiceText: string): Promise<string> => {
    const lang = getLanguage();
    if (lang === 'en') return voiceText;

    // Dynamically request translation of the raw voice text from local language to English
    // so the assistant parser can understand it.
    try {
        const englishTranslation = await requestTranslation(voiceText, lang, 'en');
        return englishTranslation;
    } catch(e) {
        console.error("Voice translation fallback");
        return voiceText.toLowerCase();
    }
};

// Kept for backward compatibility if needed, but async is better for API calls
export const translateCommand = (voiceText: string): string => {
    const lang = getLanguage();
    if (lang === 'en') return voiceText;

    let translated = voiceText.toLowerCase();
    if (translated.includes('teeka')) translated = translated.replace('teeka', 'list');
    if (translated.includes('za')) translated = translated.replace('za', 'of');
    if (translated.includes('kaawa')) translated = translated.replace('kaawa', 'coffee');
    if (translated.includes('genda')) translated = translated.replace('genda', 'go to');
    if (translated.includes('ku')) translated = translated.replace('ku', 'to');
    
    return translated;
};
