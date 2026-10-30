import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Edit3, 
  X, 
  ShieldAlert,
  Users,
  TrendingUp,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  BookOpen,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Card, MetricCard } from '../components/ui/Card';

export const IntakePage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [intakeData, setIntakeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Edit modal
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newIntake, setNewIntake] = useState<string>('60');
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search, Filter, Pagination & Examine Row
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [examiningItem, setExaminingItem] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const fetchIntake = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>(`/intake?academic_year=${selectedYear}`);
      setIntakeData(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntake();
  }, [selectedYear]);

  useEffect(() => {
    setPage(1);
  }, [selectedYear, searchTerm, statusFilter, pageSize]);

  const handleCopyCourseSummary = (item: any) => {
    const text = `Course: ${item.course_name} (${item.course_code})\nAcademic Year: ${selectedYear}\nApproved Intake: ${item.approved_intake || 'Not Configured'}\nEnrolled: ${item.current_count}\nRemaining: ${item.remaining_capacity}\nUtilization: ${item.utilization_percent}%\nStatus: ${item.status}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setNewIntake(String(item.approved_intake || 60));
    setIntakeError(null);
    setEditNotes(item.notes || '');
    setErrorMsg(null);
  };

  const handleSaveIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    // Validate whole positive integer >= 1
    const rawStr = String(newIntake).trim();
    if (!rawStr || !/^\d+$/.test(rawStr)) {
      setIntakeError('Enter a valid whole-number intake capacity.');
      return;
    }
    const parsedNum = Number(rawStr);
    if (!Number.isInteger(parsedNum) || parsedNum < 1) {
      setIntakeError('Enter a valid whole-number intake capacity.');
      return;
    }
    if (parsedNum > 1000) {
      setIntakeError('Intake capacity cannot exceed 1000 seats.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setIntakeError(null);
    try {
      const res = await api.post<any>('/intake', {
        course_id: editingItem.course_id,
        academic_year: selectedYear,
        approved_intake: parsedNum,
        notes: editNotes
      });
      setSuccessMsg(res.message);
      setEditingItem(null);
      fetchIntake();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update intake.');
    } finally {
      setSaving(false);
    }
  };

  const allItems = intakeData?.items || [];
  const filteredItems = allItems.filter((item: any) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'over' && item.remaining_capacity >= 0) return false;
      if (statusFilter === 'near' && (item.utilization_percent < 90 || item.utilization_percent > 100)) return false;
      if (statusFilter === 'available' && (item.utilization_percent >= 90 || !item.has_config)) return false;
      if (statusFilter === 'unconfigured' && item.has_config && item.approved_intake > 0) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (item.course_name && item.course_name.toLowerCase().includes(q)) ||
        (item.course_code && item.course_code.toLowerCase().includes(q)) ||
        (item.status && item.status.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const total = filteredItems.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">{t('intake_title', 'Intake Capacity Monitoring')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('intake_sub', 'Compare active student enrollments against configured institutional quotas.')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-600">{t('col_year', 'Batch Year')}:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none cursor-pointer"
          >
            <option value={2026}>Academic Year 2026</option>
            <option value={2025}>Academic Year 2025</option>
            <option value={2024}>Academic Year 2024</option>
          </select>
        </div>
      </div>

      {/* Mandatory Regulatory Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">{t('official_notice_short', 'Locally Configured Values, Not Official AICTE Data')}</span>
          <p className="mt-0.5 text-amber-800 m-0">
            {t('official_notice', 'Intake figures shown here are maintained locally for capacity control and sanity checking. Official sanctioned quotas are governed by AICTE approval letters.')}
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Summary Utilization Cards */}
      {intakeData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title={t('kpi_approved_quota', 'Total Approved Intake')}
            value={intakeData.total_approved_intake}
            subtitle={t('kpi_intake_sub', 'Sum of configured course seats')}
            icon={BarChart3}
            colorVariant="blue"
          />
          <MetricCard
            title={t('kpi_active_enrollment', 'Active Enrolled Students')}
            value={intakeData.total_enrolled_students}
            subtitle={`Non-archived records in ${selectedYear}`}
            icon={Users}
            colorVariant="blue"
          />
          <MetricCard
            title={t('kpi_capacity_used', 'Overall Seat Utilization')}
            value={`${intakeData.overall_utilization}%`}
            subtitle={t('chart_aicte_tag', 'AICTE intake capacity metric')}
            icon={TrendingUp}
            colorVariant={
              intakeData.overall_utilization > 100 ? 'rose' :
              intakeData.overall_utilization >= 90 ? 'amber' : 'emerald'
            }
          />
        </div>
      )}

      {/* Search and Status Filters */}
      <Card rounded="2xl" className="p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by course name or code (e.g. Computer Science, BTECH)..."
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

        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          {[
            { id: 'ALL', label: t('all', 'All Courses') },
            { id: 'available', label: 'Within Limit' },
            { id: 'near', label: 'Near Capacity (≥90%)' },
            { id: 'over', label: 'Over Capacity' },
            { id: 'unconfigured', label: 'Unconfigured' },
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

      {/* Intake Table */}
      <Card rounded="2xl" className="border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">{t('col_course', 'Course')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_quota', 'Approved Intake')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_enrolled', 'Enrolled')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_remaining', 'Remaining')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_utilization', 'Utilization')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_status', 'Status')}</th>
                <th className="px-5 py-3.5 font-semibold text-right">{t('col_actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    {t('loading', 'Loading intake capacity records...')}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    {t('empty', 'No intake records found matching your filters.')}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item: any) => (
                  <tr 
                    key={item.course_id} 
                    onClick={() => setExaminingItem(item)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{item.course_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.course_code}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-800">
                      {item.has_config ? item.approved_intake : <span className="text-slate-400 italic">Not Set</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm text-slate-700">
                      {item.current_count}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm">
                      {!item.has_config ? (
                        <span className="text-slate-400">—</span>
                      ) : item.remaining_capacity < 0 ? (
                        <span className="text-rose-600 font-bold">Over by {Math.abs(item.remaining_capacity)}</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">{item.remaining_capacity} available</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {item.has_config ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                item.utilization_percent > 100 ? 'bg-rose-500' :
                                item.utilization_percent >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} 
                              style={{ width: `${Math.min(100, item.utilization_percent)}%` }}
                            ></div>
                          </div>
                          <span>{item.utilization_percent}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={item.status} size="sm" />
                      {(!item.has_config || item.approved_intake <= 0) && (
                        <p className="text-[11px] text-amber-700 mt-1 font-medium leading-tight max-w-[200px]">
                          Intake configuration is missing. Configure the capacity to calculate utilization.
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setExaminingItem(item)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                          title="Examine Course Intake Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>{t('examine', 'Examine')}</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            <span>{t('btn_edit_quota', 'Set Intake')}</span>
                          </button>
                        )}
                      </div>
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
              Showing {startIndex} - {endIndex} of {total} courses
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

      {/* SET INTAKE MODAL (Admin Only) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditingItem(null)}></div>
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 m-0">
                {t('modal_edit_quota_title', 'Configure Quota')}: {editingItem.course_code}
              </h2>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div role="alert" className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 m-0">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveIntake} className="space-y-4" noValidate>
              <div>
                <label htmlFor="intake-approved" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('lbl_approved_seats', 'Approved Annual Intake (Number of Seats)')}
                  <span className="text-rose-500 ml-0.5 font-bold" aria-hidden="true">*</span>
                  <span className="sr-only"> ({t('required', 'required')})</span>
                </label>
                <input
                  id="intake-approved"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  aria-invalid={!!intakeError}
                  aria-describedby={intakeError ? 'intake-approved-error' : undefined}
                  value={newIntake}
                  onChange={(e) => {
                    setNewIntake(e.target.value);
                    if (intakeError) setIntakeError(null);
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 transition ${
                    intakeError
                      ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-300 focus:ring-blue-600'
                  }`}
                />
                {intakeError && (
                  <p id="intake-approved-error" role="alert" className="mt-1 text-xs text-rose-600 font-medium">
                    {intakeError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('intake_ref_notes', 'Reference Approval Notes')}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. AICTE Approval Extension Letter No. 2026/AIT/01"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? t('saving', 'Updating...') : t('save', 'Save Configuration')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXAMINE ROW MODAL */}
      {examiningItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setExaminingItem(null)}></div>
          <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl z-10 border border-slate-200 space-y-5 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900 m-0">
                    {examiningItem.course_name}
                  </h3>
                  <StatusBadge status={examiningItem.status} size="sm" />
                </div>
                <p className="text-xs text-slate-500 font-mono m-0">
                  Code: <span className="font-semibold text-slate-700">{examiningItem.course_code}</span> • Academic Year: <span className="font-semibold text-slate-700">{selectedYear}</span>
                </p>
              </div>
              <button
                onClick={() => setExaminingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Capacity KPI Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Approved Intake</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {examiningItem.has_config ? examiningItem.approved_intake : 'Not Set'}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-[11px] text-blue-700 block">Enrolled Count</span>
                <span className="font-mono text-base font-bold text-blue-900">
                  {examiningItem.current_count}
                </span>
              </div>
              <div className={`p-3 rounded-xl border ${
                examiningItem.remaining_capacity < 0 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <span className="text-[11px] block opacity-80">Remaining Seats</span>
                <span className="font-mono text-base font-bold">
                  {examiningItem.has_config 
                    ? (examiningItem.remaining_capacity < 0 ? `Over by ${Math.abs(examiningItem.remaining_capacity)}` : examiningItem.remaining_capacity) 
                    : '—'}
                </span>
              </div>
            </div>

            {/* Utilization Gauge */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Intake Capacity Utilization</span>
                <span className="font-mono font-bold text-slate-900">
                  {examiningItem.has_config ? `${examiningItem.utilization_percent}%` : 'Configuration Missing'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    examiningItem.utilization_percent > 100 ? 'bg-rose-500' :
                    examiningItem.utilization_percent >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, examiningItem.utilization_percent || 0)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500 m-0">
                {examiningItem.utilization_percent > 100
                  ? 'CRITICAL ALERT: Enrolled students exceed authorized AICTE capacity.'
                  : examiningItem.utilization_percent >= 90
                  ? 'WARNING: Course capacity is above 90% utilization threshold.'
                  : 'Normal institutional enrollment level within authorized ceiling.'}
              </p>
            </div>

            {/* Regulatory Reference & Notes */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                AICTE Regulatory Approval Reference
              </span>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-600 font-mono text-[11px]">
                {examiningItem.notes || 'No administrative approval notes recorded. Default statutory intake applied.'}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={() => handleCopyCourseSummary(examiningItem)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Details' : 'Copy Course Summary'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setExaminingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t('close', 'Close')}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const it = examiningItem;
                      setExaminingItem(null);
                      openEditModal(it);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('btn_edit_quota', 'Configure Intake')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
