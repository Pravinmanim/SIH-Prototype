import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  X, 
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

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
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

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
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await api.post<any>(`/review/cases/${selectedCaseId}/action`, {
        action,
        note_text: actionNote
      });
      setSuccessToast(res.message);
      // Reload detail and list
      const refreshed = await api.get<any>(`/review/cases/${selectedCaseId}`);
      setCaseDetail(refreshed);
      setActionNote('');
      fetchCases();
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Verification Centre & Human Review Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review flagged records, examine duplicate comparisons, and record official determinations.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-amber-50 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Similarity alerts never imply fraud. Local human verification only.</span>
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

      {/* Filter Tabs & Severity Select */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-semibold">
          {['ALL', 'Pending Review', 'In Progress', 'Correction Requested', 'Resolved', 'False Positive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Case ID</th>
                <th className="px-5 py-3.5 font-semibold">Student / Roll</th>
                <th className="px-5 py-3.5 font-semibold">Reason Flagged</th>
                <th className="px-5 py-3.5 font-semibold">Severity</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Date Flagged</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    Loading verification queue...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    No cases match the selected filter. Queue is clear.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-800">
                      #{c.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{c.student_name}</div>
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
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openCaseModal(c.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                      <h2 className="text-lg font-bold text-slate-900 m-0">Case #{caseDetail.case.id}: Review & Determination</h2>
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
                    <span className="font-semibold">{caseDetail.boundary_notice}</span>
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
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Side-by-Side Record Comparison</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Record A */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <span className="font-bold text-slate-800 block text-xs">Record A (Current Student)</span>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Full Name</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('full_name') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.full_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Roll Number</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('roll_number') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.roll_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Masked APAAR ID</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('apaar_id') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.masked_apaar_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Course & Admission Year</span>
                            <span className="text-slate-800">{caseDetail.student?.course_name} ({caseDetail.student?.admission_year})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('date_of_birth') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.student?.date_of_birth || 'Not Specified'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Record B */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <span className="font-bold text-slate-800 block text-xs">Record B (Matched Candidate)</span>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Full Name</span>
                            <span className={`font-semibold ${caseDetail.matching_fields.includes('full_name') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.full_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Roll Number</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('roll_number') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.roll_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Masked APAAR ID</span>
                            <span className={`font-mono ${caseDetail.matching_fields.includes('apaar_id') ? 'bg-amber-100 text-amber-900 px-1 rounded' : 'text-slate-800'}`}>
                              {caseDetail.peer_student?.masked_apaar_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Course & Admission Year</span>
                            <span className="text-slate-800">{caseDetail.peer_student?.course_name} ({caseDetail.peer_student?.admission_year})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Date of Birth</span>
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
                    <span className="font-bold text-slate-700 block uppercase tracking-wider">Target Student Profile</span>
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
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Review Notes Timeline</h3>
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
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Action Reason / Written Justification (Mandatory for Resolve / False Positive)
                    </label>
                    <textarea
                      rows={2}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Enter verification rationale, physical register reference, or reason..."
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={submittingAction || !actionNote.trim()}
                      onClick={() => executeAction('add_note')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Add Note Only
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
