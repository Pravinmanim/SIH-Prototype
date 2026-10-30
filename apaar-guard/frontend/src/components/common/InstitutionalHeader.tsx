import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Building2, 
  PhoneCall, 
  Globe, 
  HelpCircle, 
  ExternalLink, 
  Mail, 
  Clock, 
  ChevronDown,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';
import { NotificationDropdown } from './NotificationDropdown';
import { UserProfileDropdown } from './UserProfileDropdown';
import { api } from '../../services/api';

export const InstitutionalHeader: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();

  // Institution settings state for Help Desk
  const [supportInfo, setSupportInfo] = useState<{
    support_phone: string | null;
    support_email: string | null;
    support_hours: string | null;
    is_configured: boolean;
  }>({
    support_phone: null,
    support_email: null,
    support_hours: null,
    is_configured: false,
  });

  const [helpdeskOpen, setHelpdeskOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const helpdeskRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<any>('/institution/settings')
      .then((data) => {
        setSupportInfo({
          support_phone: data.support_phone,
          support_email: data.support_email,
          support_hours: data.support_hours,
          is_configured: data.is_configured,
        });
      })
      .catch(() => {});
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (helpdeskRef.current && !helpdeskRef.current.contains(e.target as Node)) {
        setHelpdeskOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="bg-[#142B4A] text-white border-b border-blue-900/60 shadow-md select-none shrink-0 z-30">
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* LEFT: Branding & Institutional Information */}
        <div className="flex items-center space-x-3.5 min-w-0">
          {/* Logo & Title */}
          <div 
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 cursor-pointer shrink-0 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white leading-tight">
                  {t('appName')}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {t('sihPrototype')}
                </span>
              </div>
              <p className="text-[11px] text-blue-200/90 font-normal m-0 tracking-tight line-clamp-1">
                {t('appSubtitle')}
              </p>
            </div>
          </div>

          {/* Dynamic Institution Masthead Info */}
          <div className="hidden xl:flex items-center space-x-2 pl-4 border-l border-white/15 text-xs text-blue-100">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-white truncate max-w-[240px] block leading-tight">
                {user?.institution?.name}
              </span>
              <div className="flex items-center space-x-2 text-[10px] text-blue-300 mt-0.5 font-mono">
                <span>Code: {user?.institution?.code}</span>
                <span>•</span>
                <span>AICTE: {user?.institution?.aicte_id || 'AICTE-APPROVED'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Utility Controls (Helpdesk, Language, Notifications, User) */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* 1. INSTITUTION HELPDESK BUTTON & POPOVER */}
          <div className="relative" ref={helpdeskRef}>
            <button
              onClick={() => setHelpdeskOpen(!helpdeskOpen)}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-blue-200 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium">{t('helpdesk')}</span>
              <ChevronDown className="w-3 h-3 text-blue-300" />
            </button>

            {helpdeskOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900">{t('helpdesk')}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {user?.institution?.code}
                  </span>
                </div>

                <div className="py-3 space-y-2.5 text-xs">
                  {supportInfo.is_configured ? (
                    <>
                      {supportInfo.support_phone && (
                        <div className="flex items-center space-x-2 text-slate-700">
                          <PhoneCall className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-semibold">{supportInfo.support_phone}</span>
                        </div>
                      )}
                      {supportInfo.support_email && (
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-600">{supportInfo.support_email}</span>
                        </div>
                      )}
                      {supportInfo.support_hours && (
                        <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{supportInfo.support_hours}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                      <p className="font-semibold m-0">{t('supportNotConfigured')}</p>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setHelpdeskOpen(false);
                            navigate('/settings');
                          }}
                          className="mt-2 text-blue-700 hover:underline font-bold inline-flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          {t('configureSupport')} <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setHelpdeskOpen(false);
                      navigate('/help');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>View Help & Resources</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. LANGUAGE SELECTOR */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-blue-200 hover:text-white border border-white/10 transition cursor-pointer"
              title={t('selectLanguage')}
              aria-label={t('selectLanguage')}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold uppercase tracking-wider">{language}</span>
              <ChevronDown className="w-3 h-3 text-blue-300" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('selectLanguage')}
                </div>
                <button
                  onClick={() => {
                    setLanguage('en');
                    setLangDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    language === 'en' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>English</span>
                  {language === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setLanguage('ta');
                    setLangDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    language === 'ta' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>தமிழ் (Tamil)</span>
                  {language === 'ta' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* 3. NOTIFICATION CENTRE */}
          <NotificationDropdown />

          {/* 4. USER PROFILE DROPDOWN */}
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
};

