import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Language, TranslationDictionary } from './types';
import { en } from './en';
import { ta } from './ta';

const translations: Record<Language, TranslationDictionary> = {
  en,
  ta,
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationDictionary, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('apaar_language');
      if (saved === 'ta' || saved === 'en') return saved;
    } catch {
      // Fallback
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('apaar_language', lang);
    } catch {
      // Storage unavailable
    }
  };

  const t = (key: keyof TranslationDictionary, fallback?: string): string => {
    const currentDict = translations[language] || translations.en;
    return currentDict[key] || fallback || en[key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
