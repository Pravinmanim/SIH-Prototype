import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Video, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  ShieldAlert, 
  PhoneCall, 
  Mail, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ExternalLink,
  Users,
  Sparkles,
  Shield
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';

export const HelpPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Institution settings state
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

  // FAQ Items
  const faqs = [
    {
      q: "How to add a student record?",
      a: "Institution Administrators can add students individually from the Student Records module by clicking 'Add Student'. Required fields include Roll Number, Full Name, Course Code, and Admission Year. APAAR ID and Phone numbers are validated upon submission against format standards.",
      tags: ["student registration", "add student", "enrollment"]
    },
    {
      q: "How to upload and map CSV/XLSX spreadsheets?",
      a: "Navigate to 'Bulk Import' (Admin only). Step 1: Upload a .CSV or .XLSX file. Step 2: Verify automatic column mapping to database fields (Roll Number, APAAR ID, Course, etc.). Step 3: Inspect pre-commit validation results showing valid rows, exact duplicates, and field errors with plain-English descriptions before committing.",
      tags: ["bulk import", "csv", "xlsx", "column mapping", "upload"]
    },
    {
      q: "Why is a student record marked 'Invalid Data'?",
      a: "A record is flagged as 'Invalid Data' if it fails local format validation rules: for example, an APAAR ID that is not exactly 12 numeric digits, a student phone number that does not start with digits 6-9 or is not 10 digits, or missing mandatory institutional fields.",
      tags: ["invalid data", "format error", "validation", "apaar id format"]
    },
    {
      q: "What does 'Needs Review' mean in the verification queue?",
      a: "Records enter the 'Needs Review' state when heuristic duplicate detection identifies a high-confidence match (such as identical name and date-of-birth across different roll numbers), or when flagged by an administrator for manual verification by a Verification Officer.",
      tags: ["needs review", "review queue", "verification centre", "review cases"]
    },
    {
      q: "How are duplicate alerts generated?",
      a: "APAAR GUARD applies multi-layer duplicate checking: (1) Exact Duplicate: matching 12-digit APAAR ID across active records; (2) Duplicate Roll Number: identical roll number within the same institution; (3) Heuristic Match: matching student name and birthdate across records.",
      tags: ["duplicate records", "duplicate alerts", "detection"]
    },
    {
      q: "How is intake capacity utilization calculated?",
      a: "Intake utilization compares active student enrollment in each academic course and year against the approved AICTE intake quota configured in 'Intake Monitoring'. Utilization at or exceeding 100% generates capacity warnings across the portal.",
      tags: ["intake capacity", "intake monitoring", "course quota", "aicte intake"]
    },
    {
      q: "What permissions does a Verification Officer have?",
      a: "Verification Officers have read-only access to institutional student directories and full determination rights over assigned Review Cases (resolving cases, approving records, or marking false positives with mandatory justification notes). Officers cannot bulk import, modify intake quotas, or alter institutional configurations.",
      tags: ["user permissions", "verification officer", "roles", "rbac"]
    },
    {
      q: "Does APAAR GUARD officially verify APAAR IDs?",
      a: "No. APAAR GUARD performs local mathematical format validation (12-digit check and duplicate isolation). Local validation does NOT establish legal student identity or query live UIDAI/DigiLocker servers. Local checks are strictly verification-support tooling.",
      tags: ["official verification", "digilocker", "uidai", "boundary", "limitations"]
    }
  ];

  // Filter FAQs based on search
  const filteredFaqs = faqs.filter((faq) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      faq.q.toLowerCase().includes(query) ||
      faq.a.toLowerCase().includes(query) ||
      faq.tags.some((t) => t.includes(query))
    );
  });

  const toggleFaq = (idx: number) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. MAIN GUIDANCE BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#142B4A] via-[#1B365D] to-[#0E2038] text-white p-6 sm:p-10 shadow-lg">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AICTE Institutional Support & Knowledge Hub</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {t('helpHeading')}
          </h1>

          <p className="text-sm sm:text-base text-blue-100 font-medium leading-relaxed">
            {t('helpSubtitle')}
          </p>

          <p className="text-xs text-blue-200/80 leading-relaxed max-w-2xl">
            {t('helpDescription')}
          </p>

          {/* Search Help Input */}
          <div className="pt-4 max-w-xl">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchHelpPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white text-slate-900 rounded-2xl text-xs sm:text-sm shadow-md outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-[11px] text-blue-200 mt-2 font-mono">
                Showing search results matching "{searchQuery}"
              </p>
            )}
          </div>
        </div>

        {/* Decorative background shield watermark */}
        <Shield className="absolute -right-8 -bottom-10 w-72 h-72 text-white/5 pointer-events-none" />
      </div>

      {/* 2. MAIN SUPPORT CARDS */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">
          {t('supportCardsTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Support Card 1: Institution Portal Support */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-3">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Institution Portal Support</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Direct institutional helpdesk contact information for enrollment coordinators and officers.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
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
                  <p className="text-amber-800 text-[11px] font-medium m-0">
                    {t('supportNotConfigured')}
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <a 
                href="/settings"
                className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                {t('configureSupport')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </Card>

          {/* Support Card 2: Student Data Management Guide */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Student Data Management</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Step-by-step instructions for registering students, managing roll numbers, and ensuring data hygiene.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Mandatory fields: Roll No, Name, Course, Year</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Phone numbers formatted to 10 Indian digits</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Optimistic locking protects concurrent edits</span>
                </li>
              </ul>
            </div>
            <a 
              href="/students"
              className="mt-4 text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              Open Student Records →
            </a>
          </Card>

          {/* Support Card 3: APAAR ID Validation Guide */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">APAAR ID Format Rules</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Specifications for 12-digit numeric identifier checks and duplicate detection algorithms.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold m-0">Verification Boundary Notice</p>
                <p className="m-0 leading-relaxed text-indigo-800">
                  Local format checks ensure valid 12-digit structure. Local checks are not official UIDAI or DigiLocker verification.
                </p>
              </div>
            </div>
            <a 
              href="/rules"
              className="mt-4 text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
            >
              View Full Rules Matrix →
            </a>
          </Card>

          {/* Support Card 4: Bulk Import Guide */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-3">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Bulk Import Protocol</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                How to safely upload CSV/Excel files, map headers, review error breakdowns, and avoid duplicates.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Max batch size: 5,000 student rows</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Pre-commit dry run with row-by-row error logs</span>
                </li>
              </ul>
            </div>
            <a 
              href="/import"
              className="mt-4 text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              Open Bulk Import Wizard →
            </a>
          </Card>

          {/* Support Card 5: Verification Workflow Guide */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Verification Review Workflows</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Review queue operations for verification officers resolving duplicate flags and format discrepancies.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Mandatory justification note on all determinations</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Immutable audit logging of every transition</span>
                </li>
              </ul>
            </div>
            <a 
              href="/verification"
              className="mt-4 text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
            >
              Open Verification Centre →
            </a>
          </Card>

          {/* Support Card 6: AICTE Intake Capacity Guide */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">AICTE Intake Monitoring</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tracking enrolled capacity against approved institutional intake quotas by course and admission year.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Warning threshold triggers at 85% enrollment</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Audit logging when intake quotas are reconfigured</span>
                </li>
              </ul>
            </div>
            <a 
              href="/intake"
              className="mt-4 text-xs font-semibold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1"
            >
              Open Intake Monitoring →
            </a>
          </Card>
        </div>
      </div>

      {/* 3. DOWNLOAD DOCUMENTS & TEMPLATES SECTION */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">
          {t('downloadDocsTitle')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CSV Template */}
          <Card rounded="2xl" className="p-5 hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 m-0">Student Bulk Template (CSV)</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Standard CSV file pre-formatted with all required institutional headers.
            </p>
            <a
              href="/api/import/template?format=csv"
              download
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Download className="w-3.5 h-3.5" />
              Download .CSV
            </a>
          </Card>

          {/* XLSX Template */}
          <Card rounded="2xl" className="p-5 hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 m-0">Student Bulk Template (Excel)</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Microsoft Excel spreadsheet formatted with sample rows and column headers.
            </p>
            <a
              href="/api/import/template?format=xlsx"
              download
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              <Download className="w-3.5 h-3.5" />
              Download .XLSX
            </a>
          </Card>

          {/* APAAR ID Format Specification */}
          <Card rounded="2xl" className="p-5 hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 m-0">Validation Specification</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Technical documentation of 12-digit format, Verhoeff rules, and heuristics.
            </p>
            <a
              href="/rules"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900"
            >
              <BookOpen className="w-3.5 h-3.5" />
              View Rules Spec
            </a>
          </Card>

          {/* Institutional Compliance Protocol */}
          <Card rounded="2xl" className="p-5 hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 m-0">Verification Protocol</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Institutional guidelines for human determination and privacy masking.
            </p>
            <a
              href="/audit"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Review Audit Policy
            </a>
          </Card>
        </div>
      </div>

      {/* 4. VIDEO GUIDES SECTION */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">
          {t('videoGuidesTitle')}
        </h2>

        <Card rounded="2xl" className="p-8 border border-dashed border-slate-300 bg-slate-50/60 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-3">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 m-0">{t('videosComingSoon')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
            {t('videosComingSoonDesc')}
          </p>
        </Card>
      </div>

      {/* 5. INTERACTIVE FAQS SECTION */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {t('faqTitle')} ({filteredFaqs.length})
          </h2>
          {searchQuery && (
            <span className="text-xs text-slate-500">
              Filtered by: <span className="font-semibold text-blue-600">{searchQuery}</span>
            </span>
          )}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium m-0">
              No frequently asked questions matched your search criteria.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <Card 
                  key={idx} 
                  rounded="2xl" 
                  className="overflow-hidden transition-all duration-150"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between hover:bg-slate-50/80 transition cursor-pointer"
                  >
                    <span className="font-semibold text-xs sm:text-sm text-slate-900 pr-4">
                      {faq.q}
                    </span>
                    <span className="p-1 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 border-t border-slate-100 bg-slate-50/40 leading-relaxed animate-in fade-in duration-150">
                      <p className="m-0">{faq.a}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {faq.tags.map((tag) => (
                          <span 
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
