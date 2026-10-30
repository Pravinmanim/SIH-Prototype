import React from 'react';
import { 
  X, 
  Printer, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  GraduationCap, 
  Eye
} from 'lucide-react';
import type { StudentDetail } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';

interface StudentIDCardModalProps {
  student: StudentDetail;
  onClose: () => void;
  revealedApaar?: string | null;
  onRevealApaar?: (studentId: number) => Promise<void>;
  isRevealing?: boolean;
}

export const StudentIDCardModal: React.FC<StudentIDCardModalProps> = ({
  student,
  onClose,
  revealedApaar = null,
  onRevealApaar,
  isRevealing = false,
}) => {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();

  // Safe, non-sensitive application record reference for the student ID card
  const recordReference = `AG-INST${student.institution_id}-STD${student.id}-${student.admission_year}`;

  const handlePrint = () => {
    // Native browser print dialog allows printing to physical printers or Save as PDF
    window.print();
  };

  const institutionName = 
    student.institution_name || 
    user?.institution?.name || 
    'Apex Institute of Technology';

  const institutionCode = 
    student.institution_code || 
    user?.institution?.code || 
    'AIT-DELHI';

  const courseDisplay = 
    student.course?.name || 
    student.course_name || 
    'Course Not Assigned';

  const isApaarRevealed = revealedApaar !== null && revealedApaar !== undefined && revealedApaar !== '';
  const apaarDisplay = isApaarRevealed ? revealedApaar : student.masked_apaar_id;

  // Student initials for avatar placeholder
  const studentInitials = student.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'ST';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop (hidden during print) */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity no-print" 
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl z-10 border border-slate-200 space-y-6">
        {/* Modal Action Controls (hidden during print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/80">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">
                {t('card_modal_title', 'Student ID & APAAR Verification Card')}
              </h2>
              <p className="text-xs text-slate-500 m-0">
                {t('card_modal_subtitle', 'Print-ready institutional identity card with non-sensitive verification reference.')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Print card or save as PDF via browser print dialog"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('btn_print_card', 'Print / Save as PDF')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin APAAR Reveal Action Notice (hidden during print) */}
        {isAdmin && student.has_apaar && !isApaarRevealed && onRevealApaar && (
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs flex items-center justify-between gap-3 no-print">
            <div className="flex items-start space-x-2 text-indigo-900">
              <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold m-0">
                  {t('apaar_masked_notice', 'APAAR ID is masked for privacy.')}
                </p>
                <p className="text-[11px] text-indigo-700 m-0">
                  {t('apaar_reveal_audit_note', 'As an authorized administrator, you may reveal the full 12-digit ID for printing. An immutable audit log entry will be recorded.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRevealApaar(student.id)}
              disabled={isRevealing}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition flex-shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Eye className="w-3 h-3" />
              <span>{isRevealing ? t('loading', 'Revealing...') : t('btn_unmask_apaar', 'Reveal Full ID (Audited)')}</span>
            </button>
          </div>
        )}

        {/* PRINTABLE PHYSICAL CARD CONTAINER */}
        <div className="flex justify-center">
          <div
            id="student-id-card-printable"
            className="w-full max-w-[420px] bg-white rounded-2xl border-2 border-slate-300 shadow-lg overflow-hidden flex flex-col text-slate-900 relative"
            style={{ minHeight: '260px' }}
          >
            {/* Top Institutional Header */}
            <div className="bg-[#0F172A] text-white p-3.5 border-b-2 border-amber-500/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-xs flex-shrink-0 border border-white/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white m-0 leading-tight line-clamp-1">
                    {institutionName}
                  </h3>
                  <p className="text-[10px] text-slate-300 m-0 font-medium tracking-wide">
                    {institutionCode} • AICTE APPROVED INSTITUTION
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-950/60 border border-amber-400/30 px-1.5 py-0.5 rounded">
                  STUDENT ID
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 flex gap-4 flex-1">
              {/* Left Column: Photo Placeholder & Academic Year */}
              <div className="flex flex-col items-center space-y-2 flex-shrink-0">
                <div className="w-20 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shadow-inner">
                  <span className="text-lg font-bold text-slate-600 font-mono tracking-tight">
                    {studentInitials}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider mt-1">
                    PHOTO
                  </span>
                </div>
                <div className="w-full text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    BATCH
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {student.admission_year}
                  </span>
                </div>
              </div>

              {/* Right Column: Identity Fields */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Student Full Name & Status */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 m-0 truncate tracking-tight">
                      {student.full_name}
                    </h4>
                    <StatusBadge status={student.status} />
                  </div>
                  <div className="mt-0.5 flex items-center space-x-1.5 text-xs text-slate-600 font-mono">
                    <span className="text-slate-400 text-[10px] uppercase font-sans">ROLL:</span>
                    <span className="font-bold text-slate-800">{student.roll_number}</span>
                  </div>
                </div>

                {/* Course Programme */}
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    PROGRAMME / COURSE
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate block mt-0.5">
                    {courseDisplay}
                  </span>
                </div>

                {/* APAAR ID Display Block */}
                <div className="bg-blue-50/60 rounded-lg p-2 border border-blue-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 block">
                      APAAR ID (ACADEMIC REGISTRY)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 tracking-wider block mt-0.5">
                      {apaarDisplay}
                    </span>
                  </div>
                  <div>
                    {isApaarRevealed ? (
                      <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                        <Unlock className="w-2.5 h-2.5" />
                        <span>REVEALED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-0.5 text-[9px] font-medium text-slate-600 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-md">
                        <Lock className="w-2.5 h-2.5" />
                        <span>MASKED</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer: Safe Local Reference */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wider m-0">
                  APAAR GUARD LOCAL RECORD REFERENCE
                </p>
                <p className="text-[8px] text-slate-500 m-0 mt-0.5 leading-tight">
                  Internal institutional identity card for verification reference. Local checks do not constitute official UIDAI or DigiLocker verification.
                </p>
                <p className="text-[9px] font-mono font-medium text-slate-600 m-0 mt-1 truncate">
                  REF: {recordReference}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Controls (hidden during print) */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500 no-print">
          <p className="m-0 text-[11px] text-slate-500">
            {t('print_tip', 'Tip: Select "Save as PDF" in your browser print window to store a digital PDF copy.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            {t('btn_close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
