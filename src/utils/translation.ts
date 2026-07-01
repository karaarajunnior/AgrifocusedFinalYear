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
        'ready_to_buy': 'Ready to start buying fresh produce?',

        // Navbar strings
        'marketplace': 'Marketplace',
        'coops': 'Co-ops',
        'export': 'Export',
        'inputs': 'Inputs',
        'contracts': 'Contracts',
        'forms': 'Forms',
        'account': 'Account',
        'logout': 'Logout',
        'login': 'Login',
        'get_started': 'Get Started',
        'profile': 'Profile',

        // Farmer Dashboard strings
        'farmer_overview': 'Farmer Overview',
        'farmer_overview_subtitle': 'Agricultural analytics and market performance tracking.',
        'list_new_harvest': 'List New Harvest',
        'verify_for_export': 'Verify for Export',
        'total_listings': 'Total Listings',
        'verified_revenue': 'Verified Revenue',
        'completed_sales': 'Completed Sales',
        'network_rating': 'Network Rating',
        'voice_assistant_dashboard': 'Voice Assistant Dashboard',
        'automated_speech_handling': 'Automated Speech Handling',
        'voice_entry_hint': '"List 50kg Bag of Coffee" — Your speech is automatically translated and listed on the global marketplace. Luganda & English supported.',
        'start_voice_entry': 'Start Voice Entry',
        'verified_financial_identity': 'Verified Financial Identity',
        'credit_assessment_hint': 'Secure credit assessment based on DAFIS ledger activity.',
        'credit_score': 'Credit Score',
        'verified_income': 'Verified Income',
        'trailing_12mo': 'Trailing 12mo',
        'score_analysis': 'Score Analysis',
        'download_bank_report': 'Download Bank Report',
        'global_sales_hub': 'Global Sales & Prospecting Hub',
        'heritage_card': 'Heritage Card',
        'social_share_link': 'Social Share Link',
        'digital_coop': 'Digital Coop',
        'bundle_for_export': 'Bundle for Export',
        'export_brochure': 'Export Brochure',
        'pdf_link_hint': 'USD/English PDF Link',
        'invite_neighbor': 'Invite Neighbor',
        'invite_neighbor_hint': 'Earn Trade Pioneer Badge',
        'global_importer_prospector': 'Global Importer Prospector',
        'vetted_leads': 'Vetted Leads',
        'verification': 'Verification',
        'export_status_not_verified': 'Export Status: Not Verified',
        'export_restriction_hint': 'You are currently restricted to local sales. Verified exporters earn 2x more per kg on international contracts.',
        'price_board_title': '24/7 price board',
        'financial_record': 'Financial Record',
        'gross_sales_portfolio': 'Gross Sales Portfolio',
        'verification_fees': 'Verification Fees (2.5%)',
        'net_estimated_payout': 'Net Estimated Payout',
        'verified_ledger_extract': 'verified ledger extract',
        'list_your_harvest': 'List Your Harvest',
        'product_name': 'Product Name',
        'price_per_kg': 'Price per KG (UGX)',
        'product_origin': 'Product Origin',
        'local_market': 'Local Market',
        'international': 'International',
        'estimated_quantity': 'Estimated Quantity',
        'product_photos': 'Product photos',
        'photos_upload_hint': 'Take or upload harvest photos so buyers see them on the dashboard.',
        'take_choose_photos': 'Take / choose photos',
        'description': 'Description',
        'description_placeholder': 'Describe the quality, grade, or moisture level...',
        'finalize_list': 'Finalize & List',
        'continue': 'Continue',
        'cancel': 'Cancel',
        'back': 'Back',

        // Marketplace / Buyer strings
        'fresh_stock': 'Fresh stock',
        'world_market': 'World market',
        'local': 'Local',
        'search_crop_hint': '1. Search crop name',
        'choose_origin_hint': '2. Choose nearby or outside Uganda',
        'order_view_hint': '3. Tap Order or View',
        'all': 'All',
        'near': 'Near',
        'world': 'World',
        'location': 'Location',
        'location_placeholder': 'District, city, country',
        'ready_to_buy_title': 'Ready to start buying fresh produce?',
        'join_dafis_hint': 'Join AgriConnect to place orders, connect securely with verified farmers, and secure the best deals on fresh produce.',
        'welcome_buyer': 'Welcome back',
        'welcome_buyer_subtitle': 'Discover fresh produce directly from farmers and supermarkets',
        'all_assets': 'All Assets',
        'local_markets': 'Local Markets',
        'currency': 'Currency',
        'local_commodities': 'Local Commodities',
        'trade_efficiency_hint': '95% Trade Efficiency',
        'trade_network': 'Trade Network',
        'invite_importer_hint': 'Invite an international roaster or bulk buyer to earn Trade Pioneer status and exclusive logistics discounts.',
        'invite_importer_btn': 'Invite an Importer',
        'regional_inventory': 'Regional Inventory',
        'update': 'Update',
        'no_nearby_products': 'No nearby products found',
        'expand_search': 'Expand Search to',
        'total_procurement': 'Total Procurement',
        'capital_expenditure': 'Capital Expenditure',
        'average_order_value': 'Average Order Value',
        'market_inventory': 'Market Inventory',
        'items_listed': 'Items Listed',
        'recent_orders': 'Recent Orders',
        'latest_transactions': 'Latest Transactions',
        'order_now': 'Order Now',

        // Product Details strings
        'product_journey_map': 'Product Journey Map',
        'quality_check_recorded': 'Quality check recorded',
        'product_quality_check': 'Product quality check',
        'quality_check_desc': 'Buyers can drag a farmer photo or upload a fresh image to estimate visible quality, defects, and listing specifications.',
        'drag_drop_image': 'Drag and drop an image here',
        'upload_image': 'Upload image',
        'analyzing_quality': 'Analyzing visible quality...',
        'score': 'Score',
        'freshness': 'Freshness',
        'uniformity': 'Uniformity',
        'visible_defects': 'Visible defects',
        'recommendations': 'Recommendations',
        'product_details': 'Product Details',
        'traceability_timeline': 'Traceability timeline',
        'generate_qr': 'Generate QR',
        'farmer_information': 'Farmer Information',
        'message_farmer': 'Message Farmer',
        'farming_since': 'Farming since',
        'place_order': 'Place Order',
        'quantity': 'Quantity',
        'total_price': 'Total Price',
        'out_of_stock': 'This product is currently out of stock.',
        'customer_reviews': 'Customer Reviews',
        'price_history': 'Price History',
        'confirm_order': 'Confirm Order',
        'order_notes': 'Order Notes (Optional)',
        'order_notes_placeholder': 'Any special instructions or requirements...',
        'traceability_qr': 'Traceability QR',
        'scan_to_verify': 'Scan to verify origin',
        'held_in_escrow': 'Held in Smart Contract Escrow',
        'released_from_escrow': 'Released from Escrow',
        'escrow_pending': 'Escrow Payment Pending',
        'escrow_failed': 'Escrow Payment Failed',
        'confirm_and_release': 'Confirm Receipt & Release Escrow',
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
        'ready_to_buy': 'Weetegese okutandika okugula ebirime ebipya?',

        // Navbar strings
        'marketplace': 'Akatale',
        'coops': 'Ebibiina by\'Abalimi',
        'export': 'Okutunda Ebweru',
        'inputs': 'Eby\'okukozesa mu Bulimi',
        'contracts': 'Endagaano',
        'forms': 'Ebipapula',
        'account': 'Akawunti',
        'logout': 'Fuluma',
        'login': 'Yingira',
        'get_started': 'Tandika Wano',
        'profile': 'Akawunti Yo',

        // Farmer Dashboard strings
        'farmer_overview': 'Okulondoola Abalimi',
        'farmer_overview_subtitle': 'Okupima emirimu gy\'ebyobulimi n\'obutale.',
        'list_new_harvest': 'Teeka Ekyamaguzi Ekipya',
        'verify_for_export': 'Kakasa Ebisomoozo by\'Okutunda ebweru',
        'total_listings': 'Ebirime Byonna ebitekedwawo',
        'verified_revenue': 'Ensimbi Zikakasidwa',
        'completed_sales': 'Emirundi gy\'otunde',
        'network_rating': 'Okusiima kw\'abaguzi',
        'voice_assistant_dashboard': 'Obuyambi bw\'eddoboozi',
        'automated_speech_handling': 'Okubala ebigambo mu ngeri ey\'otoma',
        'voice_entry_hint': '"Teeka 50kg za kaawa" — Eddoboozi lyo livvuunulwa butereevu ne liteekebwa ku katale. Luganda ne English bikozesebwa.',
        'start_voice_entry': 'Tandika n\'Eddoboozi',
        'verified_financial_identity': 'Ebikwata ku nsimbi ebyakakasibwa',
        'credit_assessment_hint': 'Okupima eby\'okwewola okusinziira ku bitabo bya DAFIS.',
        'credit_score': 'Okusiima kw\'ebyokusaba ensimbi',
        'verified_income': 'Enjusa Ekakasiddwa',
        'trailing_12mo': 'Emyaka 12 egiyise',
        'score_analysis': 'Okusesetula ku madaala',
        'download_bank_report': 'Ggyayo Ripoota y\'Ensimbi',
        'global_sales_hub': 'Entambula y\'Okutunda mu nsi yonna',
        'heritage_card': 'Kadi y\'Abalimi',
        'social_share_link': 'Eky\'okusasaanya ku mikutu',
        'digital_coop': 'Kibiina ky\'Abalimi ku yintaneti',
        'bundle_for_export': 'Kugatta hamu eby\'okutunda',
        'export_brochure': 'Broshuwa y\'Eby\'okutunda',
        'pdf_link_hint': 'Linki y\'ennimi z\'ebweru (USD/English)',
        'invite_neighbor': 'Yita muliraanwa wo',
        'invite_neighbor_hint': 'Funa akabonero k\'Omutandisi w\'Ebyobusuubuzi',
        'global_importer_prospector': 'Abaguzi b\'ebweru abalina ekinyusi',
        'vetted_leads': 'Abasuubuzi abakakasiddwa',
        'verification': 'Okukakasa',
        'export_status_not_verified': 'Mbeera y\'okutunda ebweru: Tekakasingiddwa',
        'export_restriction_hint': 'Kati okugulisa kwo kuli wano wekka. Abalimi abakakasiddwa okutunda ebweru bafuna emirundi 2 mu nsi yonna.',
        'price_board_title': 'Omuwendo gw\'ebirime buli sekinya',
        'financial_record': 'Ebitabo by\'Ensimbi',
        'gross_sales_portfolio': 'Ensimbi zonna eziyingidde',
        'verification_fees': 'Ensimbi z\'okukakasa (2.5%)',
        'net_estimated_payout': 'Ensimbi zennyini ez\'okufuna',
        'verified_ledger_extract': 'Ebisunguliddwa mu kitabo ekikakasiddwa',
        'list_your_harvest': 'Teeka ebirime byo mu katale',
        'product_name': 'Erinnya ly\'Ekyamaguzi',
        'price_per_kg': 'Omuwendo ku buli Kilo (UGX)',
        'product_origin': 'Gye kisibuka',
        'local_market': 'Akatale k\'omu kitundu',
        'international': 'Mu nsi yonna',
        'estimated_quantity': 'Obungi bw\'ebintu obusuubirwa',
        'product_photos': 'Ebifananyi by\'ekyamaguzi',
        'photos_upload_hint': 'Kuba oba teekawo ebifananyi by\'ekirime abaguzi babirabe.',
        'take_choose_photos': 'Kuba/Londa ebifananyi',
        'description': 'Ekinyusi/Okunnyonnyola',
        'description_placeholder': 'Nnyonnyola omutindo, obujjanjabi, oba omukka...',
        'finalize_list': 'Maliriza & Teekawo',
        'continue': 'Genda mu maaso',
        'cancel': 'Sazaamu',
        'back': 'Mabega',

        // Marketplace / Buyer strings
        'fresh_stock': 'Ebirime ebipya',
        'world_market': 'Akatale k\'ensi yonna',
        'local': 'Wano',
        'search_crop_hint': '1. Noonya erinnya ly\'ekirime',
        'choose_origin_hint': '2. Londa ebiri okumpi oba ebweru wa Uganda',
        'order_view_hint': '3. Nyiga Gula oba Laba',
        'all': 'Byonna',
        'near': 'Okumpi',
        'world': 'Ensi yonna',
        'location': 'Ekifo',
        'location_placeholder': 'Disitulikiti, kibuga, nsi',
        'ready_to_buy_title': 'Weetegese okutandika okugula ebirime ebipya?',
        'join_dafis_hint': 'Yegatte ku DAFIS okutandika okugula, okukwasaganya n\'abalimi abakakasibwa, n\'okufuna ebirungi eby\'omu katale.',
        'welcome_buyer': 'Nsanyuse okukubona',
        'welcome_buyer_subtitle': 'Zuula ebirime ebipya okuva eri abalimi n\'amaduuka amanene',
        'all_assets': 'Ebirime Byonna',
        'local_markets': 'Obutale bw\'omu Kitundu',
        'currency': 'Ensimbi',
        'local_commodities': 'Ebirime by\'omu Kitundu',
        'trade_efficiency_hint': 'Entambula 95% Ey\'amaanyi',
        'trade_network': 'Omukutu gw\'Ebyobusuubuzi',
        'invite_importer_hint': 'Yita omusuubuzi w\'ebweru ofune okusiima n\'okusasulwa okw\'enjawulo ku ntambula.',
        'invite_importer_btn': 'Yita Omusuubuzi w\'ebweru',
        'regional_inventory': 'Ebirime ebiri mu Kitundu',
        'update': 'Okukyusa',
        'no_nearby_products': 'Tewali birime bizuuliddwa okumpi',
        'expand_search': 'Gaziya okunoonya kutusa ku',
        'total_procurement': 'Ebyaguliddwa Byonna',
        'capital_expenditure': 'Ensimbi ezikozesedwa',
        'average_order_value': 'Omuwendo gw\'ebiragiro ku buli rugendo',
        'market_inventory': 'Ebirime ebiri mu katale',
        'items_listed': 'Ebintu ebiwandiikiddwa',
        'recent_orders': 'Ebiragiro ebyakafiibwa',
        'latest_transactions': 'Emirundi gy\'okugula egisembyeyo',
        'order_now': 'Gula Kati',

        // Product Details strings
        'product_journey_map': 'Entambula y\'Ekyamaguzi',
        'quality_check_recorded': 'Omutindo gwakakasibwa',
        'product_quality_check': 'Okukebera omutindo gw\'ekyamaguzi',
        'quality_check_desc': 'Abaguzi bayinza okuteekawo ekifananyi okukebera omutindo, obujanjabi, n\'ebirala.',
        'drag_drop_image': 'Teeka ekifananyi wano',
        'upload_image': 'Teekawo Ekifananyi',
        'analyzing_quality': 'Tukebera omutindo gw\'ekifananyi...',
        'score': 'Geredi',
        'freshness': 'Obupya',
        'uniformity': 'Okufaanagana',
        'visible_defects': 'Obulemu obulabika',
        'recommendations': 'Amagezi aguweeredwa',
        'product_details': 'Ebikwata ku Kyamaguzi',
        'traceability_timeline': 'Entambula y\'okulondoola',
        'generate_qr': 'Funa QR Code',
        'farmer_information': 'Ebibadde ku Mulimi',
        'message_farmer': 'Muzzeyo Eddoboozi',
        'farming_since': 'Alimidde okuva',
        'place_order': 'Teeka Ekiragiro',
        'quantity': 'Obungi',
        'total_price': 'Omuwendo gwonna',
        'out_of_stock': 'Ekyamaguzi kino kyaggwawo mu sitoka.',
        'customer_reviews': 'Okusiima kw\'Abaguzi',
        'price_history': 'Ebyafaayo ku Muwendo',
        'confirm_order': 'Kakasa Ekiragiro',
        'order_notes': 'Ebiragiro ebirala (Bw\'oba oyagala)',
        'order_notes_placeholder': 'Ebiragiro eby\'enjawulo ku ngenda y\'ebintu...',
        'traceability_qr': 'QR Code y\'okulondoola',
        'scan_to_verify': 'Scan okukakasa gye kisibuka',
        'held_in_escrow': '🔒 Zikwatiddwa ku blockchain (Escrow)',
        'released_from_escrow': '✓ Zisangiddwa okuva mu Escrow',
        'escrow_pending': '⌛ Okusasula kwa Escrow kulindirira',
        'escrow_failed': '✗ Okusasula kwa Escrow kugaanyi',
        'confirm_and_release': 'Kakasa nti ofunye ebirime & Gyawo ssente mu Escrow',
    },
    ach: {}, // Acholi
    teo: {}, // Ateso
    lgg: {}, // Lugbara
    nyn: {}  // Runyankole
};

export const isSupportedLanguage = (lang: string | null | undefined): lang is Language => {
    return Boolean(lang && ['en', 'ug', 'ach', 'teo', 'lgg', 'nyn'].includes(lang));
};

export const normalizeLanguage = (lang: string | null | undefined): Language => {
    const lower = String(lang || 'en').toLowerCase();
    if (lower === 'lug' || lower === 'luganda') return 'ug';
    if (lower === 'acholi') return 'ach';
    if (lower === 'ateso') return 'teo';
    if (lower === 'lugbara') return 'lgg';
    if (lower === 'runyankole' || lower === 'runyankore') return 'nyn';
    return isSupportedLanguage(lower) ? lower : 'en';
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
    localStorage.setItem('agri_lang', normalizeLanguage(lang));
};

export const getLanguage = (): Language => {
    return normalizeLanguage(localStorage.getItem('agri_lang'));
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
