import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Edit3, 
  X, 
  ShieldAlert,
  Users,
  TrendingUp,
  BarChart3
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
                {isAdmin && <th className="px-5 py-3.5 font-semibold text-right">{t('col_actions', 'Action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    {t('loading', 'Loading intake capacity records...')}
                  </td>
                </tr>
              ) : !intakeData || intakeData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    {t('empty', 'No intake records found for this year.')}
                  </td>
                </tr>
              ) : (
                intakeData.items.map((item: any) => (
                  <tr key={item.course_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{item.course_name}</div>
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
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          {t('btn_edit_quota', 'Set Intake')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  );
};
