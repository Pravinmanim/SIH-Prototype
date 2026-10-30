import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  X, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Card } from '../components/ui/Card';

const ALLOWED_BUTTONS: Record<string, { label: string; action: string; variant: string }[]> = {
  'Pending Review': [
    { label: 'Start Review', action: 'start_review', variant: 'blue' },
    { label: 'Request Correction', action: 'request_correction', variant: 'orange' },
    { label: 'Mark False Positive', action: 'mark_false_positive', variant: 'purple' },
    { label: 'Resolve Case', action: 'resolve', variant: 'emerald' },
  ],
  'In Progress': [
    { label: 'Request Correction', action: 'request_correction', variant: 'orange' },
    { label: 'Mark False Positive', action: 'mark_false_positive', variant: 'purple' },
    { label: 'Resolve Case', action: 'resolve', variant: 'emerald' },
  ],
  'Correction Requested': [
    { label: 'Resume Review', action: 'start_review', variant: 'blue' },
    { label: 'Resolve Case', action: 'resolve', variant: 'emerald' },
  ],
  'Resolved': [
    { label: 'Reopen Case', action: 'reopen', variant: 'slate' },
  ],
  'False Positive': [
    { label: 'Reopen Case', action: 'reopen', variant: 'slate' },
  ],
};

export const VerificationPage: React.FC = () => {
  const { t } = useTranslation();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Case Modal state
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      const res = await api.get<any[]>(`/review/cases?${params.toString()}`);
      setCases(res);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter, severityFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, severityFilter, searchTerm, pageSize]);

  const openCaseModal = async (id: number) => {
    setSelectedCaseId(id);
    setLoadingDetail(true);
    setActionError(null);
    setActionNote('');
    try {
      const data = await api.get<any>(`/review/cases/${id}`);
      setCaseDetail(data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load case detail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const executeAction = async (action: string) => {
    if (!selectedCaseId) return;
    if ((action === 'resolve' || action === 'mark_false_positive') && !actionNote.trim()) {
      setActionError("A written justification reason is mandatory when transitioning to 'Resolved' or 'False Positive'.");
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await api.post<any>(`/review/cases/${selectedCaseId}/action`, {
        action,
        note_text: actionNote.trim()
      });
      setSuccessToast(res.message);
      // Reload detail and list
      const refreshed = await api.get<any>(`/review/cases/${selectedCaseId}`);
      setCaseDetail(refreshed);
      setActionNote('');
      fetchCases();
    } catch (err: any) {
      if (err.status === 409) {
        setActionError(err.message || 'Illegal case status transition.');
      } else {
        setActionError(err.message || 'Action failed.');
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Search and Pagination logic
  const filteredCases = cases.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      String(c.id).includes(q) ||
      (c.student_name && c.student_name.toLowerCase().includes(q)) ||
      (c.roll_number && c.roll_number.toLowerCase().includes(q)) ||
      (c.course_code && c.course_code.toLowerCase().includes(q)) ||
      (c.reason && c.reason.toLowerCase().includes(q)) ||
      (c.severity && c.severity.toLowerCase().includes(q)) ||
      (c.status && c.status.toLowerCase().includes(q))
    );
  });

  const total = filteredCases.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const paginatedCases = filteredCases.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">{t('verif_title', 'Verification Centre & Human Review Queue')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('verif_sub', 'Review flagged records, examine duplicate comparisons, and record official determinations.')}
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-amber-50 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{t('official_notice_short', 'Similarity alerts never imply fraud. Local human verification only.')}</span>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Search and Filters */}
      <Card rounded="2xl" className="p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, roll number, case ID, reason..."
              className="w-full pl-9 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">{t('filter_severity', 'Severity')}:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-medium text-slate-700"
            >
              <option value="ALL">{t('filter_all', 'All Severities')}</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full pb-1 text-xs font-semibold border-t border-slate-100 pt-3">
          {[
            { id: 'ALL', label: t('tab_all', 'All Cases') },
            { id: 'Pending Review', label: t('tab_pending', 'Pending Review') },
            { id: 'In Progress', label: t('tab_in_progress', 'In Progress') },
            { id: 'Correction Requested', label: t('tab_correction_req', 'Correction Requested') },
            { id: 'Resolved', label: t('tab_resolved', 'Resolved Cases') },
            { id: 'False Positive', label: t('dec_false_positive', 'False Positive') },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Queue List Table */}
      <Card rounded="2xl" className="border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">{t('col_case_id', 'Case ID')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_student_roll', 'Student / Roll')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_reason_flagged', 'Reason Flagged')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_severity', 'Severity')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_status', 'Status')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_date_flagged', 'Date Flagged')}</th>
                <th className="px-5 py-3.5 font-semibold text-right">{t('col_actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    {t('loading', 'Loading verification queue...')}
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    {t('verif_empty_pending', 'No review cases currently pending determination.')}
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => openCaseModal(c.id)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-800">
                      #{c.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{c.student_name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {c.roll_number} • {c.course_code}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 max-w-xs">
                      {c.reason}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        c.severity === 'critical' ? 'bg-rose-100 text-rose-800' :
                        c.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {c.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openCaseModal(c.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                        title="Examine & Review Case"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>{t('examine', 'Examine')}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span>{t('rows_per_page', 'Rows per page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1 bg-white outline-none font-medium text-slate-700"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400 ml-2">
              Showing {startIndex} - {endIndex} of {total} review cases
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-medium text-slate-600">
              {t('page', 'Page')} {page} {t('of', 'of')} {totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Case Review Modal / Side-by-side comparison */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setSelectedCaseId(null)}></div>
          <div className="relative bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl z-10 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            {loadingDetail ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading review case details...</div>
            ) : !caseDetail ? (
              <div className="py-16 text-center text-rose-500 text-sm">Failed to load case data.</div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-slate-900 m-0">Case #{caseDetail.case.id}: {t('verif_modal_title', 'Review & Determination')}</h2>
                      <StatusBadge status={caseDetail.case.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Reason: {caseDetail.case.reason}
                    </p>
                  </div>
                  <button onClick={() => setSelectedCaseId(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Boundary Disclaimer */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{t('official_notice', caseDetail.boundary_notice)}</span>
                    <p className="text-[11px] text-amber-800 mt-0.5 m-0">
                      Decisions recorded here are logged permanently into the institutional audit ledger.
                    </p>
                  </div>
                </div>

                {actionError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Side-by-Side Comparison if Peer Student exists */}
                {caseDetail.peer_student ? (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{t('verif_side_by_side', 'Side-by-Side Record Comparison')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Record A */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <span className="font-bold text-slate-800 block text-xs">{t('verif_record_a', 'Record A (Current Student)')}</span>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_full_name', 'Full Name')}</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('full_name') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.full_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_roll_number', 'Roll Number')}</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('roll_number') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.roll_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_apaar_id', 'Masked APAAR ID')}</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('apaar_id') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.masked_apaar_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_course', 'Course')} & {t('col_year', 'Year')}</span>
                            <span className="text-slate-800">{caseDetail.student?.course_name} ({caseDetail.student?.admission_year})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('field_dob', 'Date of Birth')}</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('date_of_birth') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.date_of_birth || 'Not Specified'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Record B */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <span className="font-bold text-slate-800 block text-xs">{t('verif_record_b', 'Record B (Matched Candidate)')}</span>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_full_name', 'Full Name')}</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('full_name') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.full_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_roll_number', 'Roll Number')}</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('roll_number') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.roll_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_apaar_id', 'Masked APAAR ID')}</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('apaar_id') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.masked_apaar_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('col_course', 'Course')} & {t('col_year', 'Year')}</span>
                            <span className="text-slate-800">{caseDetail.peer_student?.course_name} ({caseDetail.peer_student?.admission_year})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">{t('field_dob', 'Date of Birth')}</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('date_of_birth') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.date_of_birth || 'Not Specified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single record flagged detail */
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 block uppercase tracking-wider">{t('drawer_student_profile', 'Target Student Profile')}</span>
                    <div className="grid grid-cols-2 gap-3 text-slate-800">
                      <div>Name: <span className="font-semibold">{caseDetail.student?.full_name}</span></div>
                      <div>Roll: <span className="font-mono font-semibold">{caseDetail.student?.roll_number}</span></div>
                      <div>APAAR: <span className="font-mono">{caseDetail.student?.masked_apaar_id}</span></div>
                      <div>Course: {caseDetail.student?.course_name} ({caseDetail.student?.admission_year})</div>
                    </div>
                  </div>
                )}

                {/* Audit & Officer Notes Timeline */}
                <div>
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{t('verif_notes_timeline', 'Review Notes Timeline')}</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {caseDetail.notes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No notes added yet.</p>
                    ) : (
                      caseDetail.notes.map((n: any) => (
                        <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-slate-500 text-[10px]">
                            <span className="font-semibold text-slate-700">{n.author_name}</span>
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800 mt-1 m-0">{n.note_text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Action Form */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  {actionError && (
                    <div id="action-error" role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{actionError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="case-action-reason" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('verif_action_reason', 'Action Reason / Written Justification (Mandatory for Resolve / False Positive)')}
                    </label>
                    <textarea
                      id="case-action-reason"
                      rows={2}
                      aria-invalid={!!actionError}
                      aria-describedby={actionError ? 'action-error' : undefined}
                      value={actionNote}
                      onChange={(e) => {
                        setActionNote(e.target.value);
                        if (actionError) setActionError(null);
                      }}
                      placeholder="Enter verification rationale, physical register reference, or reason..."
                      className={`w-full text-xs p-2.5 border rounded-lg outline-none focus:ring-2 transition ${
                        actionError
                          ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 focus:ring-blue-600'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={submittingAction || !actionNote.trim()}
                      onClick={() => executeAction('add_note')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 cursor-pointer"
                    >
                      {t('btn_add_note_only', 'Add Note Only')}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {(ALLOWED_BUTTONS[caseDetail.case.status] || []).map((btn) => {
                        const requiresNote = btn.action === 'resolve' || btn.action === 'mark_false_positive';
                        const isDisabled = submittingAction || (requiresNote && !actionNote.trim());

                        const variantClass = 
                          btn.variant === 'blue' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                          btn.variant === 'orange' ? 'bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100' :
                          btn.variant === 'purple' ? 'bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100' :
                          btn.variant === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                          'bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200';

                        return (
                          <button
                            key={btn.action}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => executeAction(btn.action)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition cursor-pointer ${variantClass}`}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
