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
import { Skeleton } from '../components/ui/Skeleton';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningValidation, setRunningValidation] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const data = await api.get<any>('/dashboard/metrics');
      setMetrics(data);
    } catch {
      // Handled
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
      // Handled
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
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Institutional Records Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time validation metrics, duplicate monitoring, and AICTE intake capacity tracking.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunValidation}
            disabled={runningValidation}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-indigo-600 ${runningValidation ? 'animate-spin' : ''}`} />
            {runningValidation ? 'Evaluating Rules...' : 'Re-Run All Checks'}
          </button>
          <button
            onClick={() => navigate('/import')}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Bulk Import CSV
          </button>
        </div>
      </div>

      {/* Official Verification Boundary Banner */}
      <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            Official verification unavailable. Local checks are not official verification.
          </span>
        </div>
        <span className="text-[11px] text-amber-700 hidden md:inline">
          Local 12-digit checks do not prove ID ownership.
        </span>
      </div>

      {/* Validation rerun toast */}
      {validationSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{validationSuccess}</span>
          </div>
          <button onClick={() => setValidationSuccess(null)} className="text-slate-400 hover:text-slate-600 font-semibold">✕</button>
        </div>
      )}

      {/* KPI Cards Grid (Instant Skeletons if loading) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))
        ) : (
          <>
            {/* Total Students */}
            <div
              onClick={() => navigate('/students')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <Users className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2 m-0">{kpis.total_students || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">Active student records</p>
            </div>

            {/* Ready */}
            <div
              onClick={() => navigate('/students?status=Ready')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Ready</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 mt-2 m-0">{kpis.ready_count || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">Passed local rules</p>
            </div>

            {/* Invalid Data */}
            <div
              onClick={() => navigate('/students?status=Invalid Data')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-rose-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Invalid</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-extrabold text-rose-700 mt-2 m-0">{kpis.invalid_count || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">Fatal format / errors</p>
            </div>

            {/* Needs Review */}
            <div
              onClick={() => navigate('/students?status=Needs Review')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Review</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-extrabold text-amber-700 mt-2 m-0">{kpis.needs_review_count || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">Duplicates / missing APAAR</p>
            </div>

            {/* Duplicates (Distinct Students + Open Alerts) */}
            <div
              onClick={() => navigate('/verification')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-purple-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Duplicates</span>
                <Copy className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-extrabold text-purple-700 mt-2 m-0">{kpis.potential_duplicates || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">
                {kpis.open_alert_count || 0} open match alerts
              </p>
            </div>

            {/* Intake Utilization */}
            <div
              onClick={() => navigate('/intake')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Intake</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-extrabold text-indigo-700 mt-2 m-0">{kpis.intake_utilization || 0}%</p>
              <p className="text-[11px] text-slate-400 mt-1 m-0">Of approved capacity</p>
            </div>
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Student Status Distribution</h2>
              <p className="text-xs text-slate-500 mt-0.5">Categorization across institution records</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Local Checks</span>
          </div>

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
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Course Capacity Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Course Enrollment vs Approved Intake</h2>
              <p className="text-xs text-slate-500 mt-0.5">Capacity monitoring for current 2026 batch</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">AICTE Quotas</span>
          </div>

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
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="enrolled_count" name="Enrolled" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved_intake" name="AICTE Approved" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Imports & Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Imports */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 m-0 flex items-center">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-indigo-600" />
              Recent Bulk Imports
            </h2>
            <button
              onClick={() => navigate('/import')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              New Import
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (metrics?.recent_imports || []).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No recent import batches recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(metrics?.recent_imports || []).map((job: any) => (
                <div key={job.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{job.filename}</span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      {new Date(job.created_at).toLocaleDateString()} • {job.total_rows} total rows
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-emerald-700">{job.created_rows} created</span>
                    {job.invalid_rows > 0 && (
                      <span className="text-rose-600 block text-[11px]">{job.invalid_rows} invalid</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit & Review Activity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 m-0 flex items-center">
              <History className="w-4 h-4 mr-2 text-indigo-600" />
              Recent Review Audit Trail
            </h2>
            <button
              onClick={() => navigate('/audit')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View Full Log
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (metrics?.recent_activity || []).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No recent officer review activity recorded.</p>
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
        </div>
      </div>
    </div>
  );
};
