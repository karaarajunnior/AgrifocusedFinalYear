import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getLanguage, 
  setLanguage as setStorageLanguage, 
  Language, 
  setOnMissingKeyCallback, 
  missingKeysQueue, 
  dynamicTranslations, 
  saveDynamicTranslations 
} from '../utils/translation';
import { requestTranslation } from '../services/translationApi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLangState] = useState<Language>(getLanguage());
  // Triggers re-renders across the app when background translations complete
  const [, setDictVersion] = useState(0);

  const handleSetLanguage = (lang: Language) => {
    setStorageLanguage(lang);
    setLangState(lang);
  };

  useEffect(() => {
    let isProcessing = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const processQueue = async () => {
      // If we are in english or empty queue, do nothing
      if (isProcessing || missingKeysQueue.size === 0 || language === 'en') return;
      isProcessing = true;

      // Slice out the current keys needing translation
      const keysToTranslate = Array.from(missingKeysQueue);
      missingKeysQueue.clear();

      let newlyTranslated = false;

      // Make API requests sequentially to avoid Rate Limiting the Sunbird API
      for (const text of keysToTranslate) {
          try {
              const translated = await requestTranslation(text, 'en', language);
              
              if (translated && translated !== text) {
                  if (!dynamicTranslations[language]) dynamicTranslations[language] = {};
                  dynamicTranslations[language][text] = translated;
                  newlyTranslated = true;
              }
          } catch (e) {
              console.warn("Background translation warning:", e);
          }
      }

      // If we got new translations, save them and force UI re-render
      if (newlyTranslated) {
          saveDynamicTranslations();
          setDictVersion(v => v + 1); 
      }

      isProcessing = false;
    };

    // Register callback so whenever `t()` encounters an untranslated string, it fires
    setOnMissingKeyCallback(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Wait 1 second before processing to batch multiple synchronous `t()` calls during a render route
      debounceTimer = setTimeout(processQueue, 1000);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      setOnMissingKeyCallback(() => {});
    };
  }, [language]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'agri_lang') {
        const newLang = e.newValue as Language;
        if (newLang) setLangState(newLang);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
