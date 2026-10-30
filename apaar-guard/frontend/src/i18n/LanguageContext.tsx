import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Language, TranslationDictionary } from './types';
import { en } from './en';
import { ta } from './ta';
import { hi } from './hi';

const keyAliases: Record<string, string> = {
  appName: 'brand_name',
  appSubtitle: 'brand_subtitle',
  sihPrototype: 'brand_prototype',
  portalTitle: 'portal_title',
  officialNotice: 'official_notice',
  selectLanguage: 'select_language',
  helpdesk: 'helpdesk_title',
  supportNotConfigured: 'helpdesk_unconfigured',
  configureSupport: 'helpdesk_configure',
  notifications: 'notif_title',
  unreadCount: 'notif_unread',
  markAllRead: 'notif_mark_all_read',
  noNotifications: 'notif_empty',
  roleAdmin: 'role_admin',
  roleOfficer: 'role_officer',
  signOut: 'sign_out',
  navDashboard: 'nav_dashboard',
  navStudents: 'nav_students',
  navAddStudent: 'nav_add_student',
  navBulkImport: 'nav_bulk_import',
  navVerification: 'nav_verification',
  navIntake: 'nav_intake',
  navReports: 'nav_reports',
  navAudit: 'nav_audit',
  navRules: 'nav_rules',
  navHelp: 'nav_help',
  navSettings: 'nav_settings',
  navTools: 'nav_tools',
  navMainModules: 'nav_main_modules',
  navOperationsSupport: 'nav_operations_support',
  helpHeading: 'help_title',
  helpSubtitle: 'help_subtitle',
  helpDescription: 'help_subtitle',
  searchHelpPlaceholder: 'search',
  supportCardsTitle: 'helpdesk_title',
  downloadDocsTitle: 'help_user_manual',
  videoGuidesTitle: 'help_sop',
  videosComingSoon: 'help_sop',
  videosComingSoonDesc: 'help_sop_desc',
  faqTitle: 'help_faq_title',
};

const translations: Record<Language, TranslationDictionary> = {
  en,
  ta,
  hi,
};

export const checkTranslationCompleteness = () => {
  const enKeys = Object.keys(en);
  const taKeys = new Set(Object.keys(ta));
  const hiKeys = new Set(Object.keys(hi));

  const missingTa = enKeys.filter(k => !taKeys.has(k));
  const missingHi = enKeys.filter(k => !hiKeys.has(k));

  return {
    totalEnKeys: enKeys.length,
    missingTa,
    missingHi,
    taCompleteness: `${Math.round(((enKeys.length - missingTa.length) / enKeys.length) * 100)}%`,
    hiCompleteness: `${Math.round(((enKeys.length - missingHi.length) / enKeys.length) * 100)}%`,
  };
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('apaar_language');
      if (saved === 'ta' || saved === 'hi' || saved === 'en') return saved;
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

  const t = (key: string, fallback?: string): string => {
    const resolvedKey = keyAliases[key] || key;
    const currentDict = translations[language] || translations.en;
    return currentDict[resolvedKey] || fallback || en[resolvedKey] || currentDict[key] || en[key] || fallback || String(key);
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
