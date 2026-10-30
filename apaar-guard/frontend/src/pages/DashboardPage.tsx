import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  TrendingUp, 
  UploadCloud, 
  RefreshCw, 
  FileSpreadsheet, 
  History, 
  ShieldAlert 
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { api } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  MetricCard 
} from '../components/ui/Card';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningValidation, setRunningValidation] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const data = await api.get<any>('/dashboard/metrics');
      setMetrics(data);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRunValidation = async () => {
    setRunningValidation(true);
    setValidationSuccess(null);
    try {
      const res = await api.post<any>('/validation/run');
      setValidationSuccess(res.message);
      await fetchMetrics();
    } catch {
      // Handled gracefully
    } finally {
      setRunningValidation(false);
    }
  };

  const kpis = metrics?.kpis || {};

  return (
    <div className="space-y-6">
      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
              {t('portal_title', 'Institutional Overview')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight mt-1">
            {t('dash_title', 'Institutional Records & Verification')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('dash_subtitle', 'Real-time validation metrics, duplicate monitoring, and AICTE intake capacity tracking.')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunValidation}
            disabled={runningValidation}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 text-blue-600 ${runningValidation ? 'animate-spin' : ''}`} />
            {runningValidation ? t('dash_btn_rerunning', 'Evaluating Rules...') : t('dash_btn_rerun', 'Re-Run All Checks')}
          </button>
          <button
            onClick={() => navigate('/import')}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            {t('dash_btn_import', 'Bulk Import CSV')}
          </button>
        </div>
      </div>

      {/* Official Verification Boundary Banner */}
      <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold">
            {t('official_notice', 'Official verification unavailable. Local checks are not official verification.')}
          </span>
        </div>
        <span className="text-[11px] text-amber-700 hidden md:inline font-medium">
          {t('official_notice_short', 'Local 12-digit format check and duplicate detection do not constitute official UIDAI or DigiLocker verification.')}
        </span>
      </div>

      {/* Validation rerun toast */}
      {validationSuccess && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-medium">{validationSuccess}</span>
          </div>
          <button onClick={() => setValidationSuccess(null)} className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer">✕</button>
        </div>
      )}

      {/* KPI Cards Grid (Instant Skeletons if loading) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 min-h-[135px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))
        ) : (
          <>
            {/* Total Records */}
            <MetricCard
              title={t('kpi_total_records', 'Total Records')}
              value={kpis.total_students || 0}
              subtitle={t('kpi_total_sub', 'Active student records')}
              icon={Users}
              colorVariant="blue"
              onClick={() => navigate('/students')}
              ariaLabel={`${t('kpi_total_records', 'Total Records')}: ${kpis.total_students || 0}`}
            />

            {/* Ready */}
            <MetricCard
              title={t('status_ready', 'Ready')}
              value={kpis.ready_count || 0}
              subtitle={t('kpi_ready_sub', 'Passed local rules')}
              icon={CheckCircle2}
              colorVariant="emerald"
              badgeText={t('kpi_ready_badge', 'Valid')}
              onClick={() => navigate('/students?status=Ready')}
              ariaLabel={`${t('status_ready', 'Ready')}: ${kpis.ready_count || 0}`}
            />

            {/* Invalid Data */}
            <MetricCard
              title={t('status_invalid', 'Invalid Data')}
              value={kpis.invalid_count || 0}
              subtitle={t('kpi_invalid_sub', 'Fatal format / errors')}
              icon={XCircle}
              colorVariant="rose"
              onClick={() => navigate('/students?status=Invalid Data')}
              ariaLabel={`${t('status_invalid', 'Invalid Data')}: ${kpis.invalid_count || 0}`}
            />

            {/* Needs Review */}
            <MetricCard
              title={t('status_review', 'Needs Review')}
              value={kpis.needs_review_count || 0}
              subtitle={t('kpi_review_sub', 'Duplicates / missing')}
              icon={AlertTriangle}
              colorVariant="amber"
              onClick={() => navigate('/students?status=Needs Review')}
              ariaLabel={`${t('status_review', 'Needs Review')}: ${kpis.needs_review_count || 0}`}
            />

            {/* Duplicates */}
            <MetricCard
              title={t('kpi_duplicates', 'Duplicates')}
              value={kpis.potential_duplicates || 0}
              subtitle={`${kpis.open_alert_count || 0} ${t('kpi_duplicates_sub', 'open match alerts')}`}
              icon={Copy}
              colorVariant="purple"
              onClick={() => navigate('/verification')}
              ariaLabel={`${t('kpi_duplicates', 'Duplicates')}: ${kpis.potential_duplicates || 0}`}
            />

            {/* Intake Utilization */}
            <MetricCard
              title={t('kpi_intake', 'Intake')}
              value={`${kpis.intake_utilization || 0}%`}
              subtitle={kpis.total_supernumerary_enrolled ? `Regular Quota (${kpis.total_supernumerary_enrolled} supernumerary)` : t('kpi_intake_sub', 'Of approved quota')}
              icon={TrendingUp}
              colorVariant="indigo"
              onClick={() => navigate('/intake')}
              ariaLabel={`${t('kpi_intake', 'Intake')}: ${kpis.intake_utilization || 0}%`}
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <Card rounded="2xl" className="flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div>
              <CardTitle>{t('chart_status_title', 'Student Status Distribution')}</CardTitle>
              <CardDescription>{t('chart_status_desc', 'Categorization across institution records')}</CardDescription>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
              {t('chart_local_tag', 'Local Checks')}
            </span>
          </CardHeader>

          <CardContent className="pt-4 flex-1">
            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-44 w-44 rounded-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics?.status_distribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(metrics?.status_distribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Course Capacity Bar Chart */}
        <Card rounded="2xl" className="flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div>
              <CardTitle>{t('chart_intake_title', 'Course Enrollment vs Approved Intake')}</CardTitle>
              <CardDescription>{t('chart_intake_desc', 'Capacity monitoring for current batch')}</CardDescription>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              {t('chart_aicte_tag', 'AICTE Quotas')}
            </span>
          </CardHeader>

          <CardContent className="pt-4 flex-1">
            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics?.course_breakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="course_code" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="enrolled_count" name={t('col_enrolled', 'Enrolled')} fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="approved_intake" name={t('col_approved_intake', 'AICTE Approved')} fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Recent Imports & Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Imports */}
        <Card rounded="2xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>{t('dash_recent_imports', 'Recent Bulk Imports')}</CardTitle>
                <CardDescription>{t('dash_imports_sub', 'File upload ingestion history')}</CardDescription>
              </div>
            </div>
            <button
              onClick={() => navigate('/import')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              {t('dash_new_import', 'New Import →')}
            </button>
          </CardHeader>

          <CardContent className="pt-2">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (metrics?.recent_imports || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">{t('dash_no_imports', 'No recent import batches recorded.')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(metrics?.recent_imports || []).map((job: any) => (
                  <div key={job.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">{job.filename}</span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(job.created_at).toLocaleDateString()} • {job.total_rows} {t('records', 'total rows')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 text-[11px]">
                        {job.created_rows} {t('created', 'created')}
                      </span>
                      {job.invalid_rows > 0 && (
                        <span className="text-rose-600 block text-[11px] mt-1 font-medium">{job.invalid_rows} {t('invalid', 'invalid')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit & Review Activity */}
        <Card rounded="2xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>{t('dash_recent_audit', 'Recent Review Audit Trail')}</CardTitle>
                <CardDescription>{t('dash_audit_sub', 'Officer determinations and verification notes')}</CardDescription>
              </div>
            </div>
            <button
              onClick={() => navigate('/audit')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              {t('dash_view_all_audit', 'View Full Log →')}
            </button>
          </CardHeader>

          <CardContent className="pt-2">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (metrics?.recent_activity || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">{t('dash_no_audit', 'No recent officer review activity recorded.')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(metrics?.recent_activity || []).map((act: any) => (
                  <div key={act.id} className="py-3 flex items-start justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block capitalize">
                        {act.action.replace('_', ' ')}: <span className="font-mono text-slate-600">{act.student_roll}</span>
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5 m-0 line-clamp-1">{act.note}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-slate-600 block font-medium">{act.actor}</span>
                      <span className="text-slate-400 text-[10px]">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
