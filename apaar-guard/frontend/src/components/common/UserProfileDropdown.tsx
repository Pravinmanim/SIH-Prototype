import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  Settings, 
  HelpCircle, 
  Building2, 
  Globe, 
  ChevronDown,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';

export const UserProfileDropdown: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label="User Profile Menu"
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 border border-blue-400/40 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {initials}
        </div>
        <div className="hidden lg:block text-left">
          <p className="text-xs font-semibold text-white leading-tight truncate max-w-[130px] m-0">
            {user?.full_name}
          </p>
          <p className="text-[10px] text-blue-200 capitalize m-0 truncate">
            {isAdmin ? t('roleAdmin') : t('roleOfficer')}
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-blue-200 hidden sm:block" />
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800">
          {/* User Bio Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-full bg-[#142B4A] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate m-0">{user?.full_name}</p>
                <p className="text-xs text-slate-500 font-mono truncate m-0">{user?.email}</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isAdmin ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isAdmin ? t('roleAdmin') : t('roleOfficer')}
                  </span>
                </div>
              </div>
            </div>

            {/* Institution Badge */}
            <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-start space-x-2 text-xs text-slate-600">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 leading-tight truncate m-0">
                  {user?.institution?.name}
                </p>
                <p className="text-[11px] text-slate-400 font-mono m-0 mt-0.5">
                  Code: {user?.institution?.code}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2 space-y-1 text-xs">
            {/* Language Switcher Section */}
            <div className="px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-100 mb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  {t('selectLanguage')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase">{language}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    language === 'en'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {language === 'en' && <Check className="w-3 h-3" />}
                  English
                </button>
                <button
                  onClick={() => setLanguage('ta')}
                  className={`px-2 py-1 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    language === 'ta'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ta' && <Check className="w-3 h-3" />}
                  தமிழ்
                </button>
              </div>
            </div>

            {/* Help & Support */}
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/help');
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>{t('navHelp')}</span>
            </button>

            {/* Institution Settings (Admin only) */}
            {isAdmin && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-600" />
                <span>{t('navSettings')}</span>
              </button>
            )}
          </div>

          {/* Sign Out Button */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-xs transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
