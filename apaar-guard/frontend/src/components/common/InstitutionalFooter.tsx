import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';

export const InstitutionalFooter: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <footer className="mt-12 pt-8 pb-12 border-t border-slate-200/80 text-xs text-slate-500 space-y-4">
      {/* Mandatory Regulatory Verification Boundary Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs text-amber-950 m-0">
            Mandatory Verification Boundary & Regulatory Disclaimer
          </p>
          <p className="text-[11px] text-amber-800 leading-relaxed m-0">
            {t('officialNotice')} Local validation assesses only 12-digit numeric structure and checks for duplicate roll numbers or identifiers across institutional records. It does not establish student identity, legal custody, or replace statutory DigiLocker/UIDAI verification mechanisms.
          </p>
        </div>
      </div>

      {/* Institutional Metadata & Nav Links */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-2 text-slate-600">
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800">{t('appName')}</span>
          <span>•</span>
          <span className="font-medium">{user?.institution?.name || 'Institutional Portal'}</span>
          <span className="text-slate-400 font-mono">({user?.institution?.code})</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-600">
          <Link to="/help" className="hover:text-blue-600 transition">
            {t('navHelp')}
          </Link>
          <span>•</span>
          <Link to="/rules" className="hover:text-blue-600 transition">
            {t('navRules')}
          </Link>
          <span>•</span>
          <Link to="/tools" className="hover:text-blue-600 transition">
            {t('navTools')}
          </Link>
          <span>•</span>
          <span className="text-slate-400 font-mono">v1.0.0-prototype</span>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        AICTE SIH26263 Prototype • Accurate Student Records. Transparent Verification. Trusted Data.
      </div>
    </footer>
  );
};
