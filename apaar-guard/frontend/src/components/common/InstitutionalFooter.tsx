import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ShieldAlert, Lock, BookOpen, ExternalLink, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';

export interface FooterProps {
  className?: string;
  showDisclaimer?: boolean;
}

export const InstitutionalFooter: React.FC<FooterProps> = ({ 
  className = '',
  showDisclaimer = true 
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer 
        className={`mt-12 pt-6 pb-8 border-t border-slate-200/90 text-xs text-slate-500 space-y-4 bg-white/60 backdrop-blur-xs rounded-2xl px-4 sm:px-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${className}`}
        role="contentinfo"
        aria-label="Portal Footer"
      >
        {/* Mandatory Regulatory Verification Boundary Notice */}
        {showDisclaimer && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 flex items-start space-x-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-bold text-[11px] text-amber-950 m-0">
                {t('footer_boundary_title', 'Mandatory Verification Boundary & Regulatory Disclaimer')}
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed m-0">
                {t('footer_boundary_desc', 'Local validation assesses only 12-digit numeric structure and checks for duplicate roll numbers or identifiers across institutional records. It does not establish student identity, legal custody, or replace statutory DigiLocker/UIDAI verification mechanisms.')}
              </p>
            </div>
          </div>
        )}

        {/* Main Footer Row: Brand, Copyright & Institutional Attribution */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-1">
          {/* Left: Brand, Copyright, Tagline */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 font-medium text-slate-700">
                <span className="font-bold text-slate-900">
                  &copy; {currentYear} APAAR GUARD.
                </span>
                <span>{t('footer_rights', 'All Rights Reserved.')}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
                  {t('footer_prototype_badge', 'SIH Prototype')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                {t('footer_tagline', 'Accurate Student Records. Transparent Verification. Trusted Data.')}
              </p>
            </div>
          </div>

          {/* Right: Quick Links, Privacy Policy & Version */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600">
            <Link 
              to="/help" 
              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 transition underline-offset-4 hover:underline"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('nav_help', 'Help & Resources')}</span>
            </Link>

            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">&bull;</span>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 transition underline-offset-4 hover:underline cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('footer_privacy', 'Privacy & Data Protection')}</span>
            </button>

            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">&bull;</span>

            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
              {t('footer_version', 'v2.4.0 (SIH 2026)')}
            </span>
          </div>
        </div>

        {/* Institution Tenancy Note */}
        {user?.institution && (
          <div className="text-center md:text-left text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex flex-wrap items-center justify-center md:justify-between gap-2">
            <span>
              {user.institution.name} &bull; {t('instCode', 'Institution Code')}: <span className="font-mono font-medium text-slate-600">{user.institution.code}</span>
            </span>
            <span className="text-[10px] text-slate-400">
              AICTE Smart India Hackathon 2026 &bull; Problem Statement SIH26263
            </span>
          </div>
        )}
      </footer>

      {/* Privacy & Data Protection Institutional Modal */}
      {showPrivacyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="privacy-modal-title" className="text-sm font-bold text-slate-900 m-0">
                    {t('footer_privacy_title', 'Institutional Privacy & Data Protection Policy')}
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    {t('footer_version', 'v2.4.0 (SIH 2026)')} &bull; {t('footer_prototype_badge', 'SIH Prototype')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed m-0">
              {t('footer_privacy_desc', 'APAAR GUARD enforces stringent institutional student data confidentiality standards under AICTE and NEP 2020 guidelines.')}
            </p>

            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs text-slate-700">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{t('footer_privacy_point1')}</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{t('footer_privacy_point2')}</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{t('footer_privacy_point3')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Link
                to="/rules"
                onClick={() => setShowPrivacyModal(false)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                <span>{t('nav_rules', 'Validation Rules Matrix')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                {t('footer_close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const Footer = InstitutionalFooter;
export default InstitutionalFooter;
