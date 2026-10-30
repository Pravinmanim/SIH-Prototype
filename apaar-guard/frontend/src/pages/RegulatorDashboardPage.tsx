import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Layers, 
  ShieldAlert, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Search, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, MetricCard } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import type { RegulatorOverviewData, RegulatorInstitutionItem, RegulatorCourseItem } from '../types';

export const RegulatorDashboardPage: React.FC = () => {
  const { isRegulator } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [overview, setOverview] = useState<RegulatorOverviewData | null>(null);
  const [institutions, setInstitutions] = useState<RegulatorInstitutionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination for Institutions Table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Examine Institution Courses Modal
  const [examiningInst, setExaminingInst] = useState<RegulatorInstitutionItem | null>(null);
  const [examiningCourses, setExaminingCourses] = useState<RegulatorCourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const fetchRegulatorData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [ovData, instData] = await Promise.all([
        api.get<RegulatorOverviewData>(`/regulator/overview?academic_year=${selectedYear}`, { useCache: false }),
        api.get<{ items: RegulatorInstitutionItem[] }>(`/regulator/institutions?academic_year=${selectedYear}`, { useCache: false })
      ]);
      setOverview(ovData);
      setInstitutions(instData.items || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load regulator oversight metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegulatorData();
  }, [selectedYear]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  const handleExamineCourses = async (inst: RegulatorInstitutionItem) => {
    setExaminingInst(inst);
    setLoadingCourses(true);
    try {
      const res = await api.get<{ courses: RegulatorCourseItem[] }>(
        `/regulator/institutions/${inst.institution_id}/courses?academic_year=${selectedYear}`
      );
      setExaminingCourses(res.courses || []);
    } catch {
      setExaminingCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleExportCSV = () => {
    const url = `/api/regulator/export?academic_year=${selectedYear}`;
    window.open(url, '_blank');
  };

  // Unauthorized guard
  if (!isRegulator) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Restricted: Regulator Only</h1>
        <p className="text-sm text-slate-600">
          This dashboard contains multi-institutional regulatory oversight data and is accessible exclusively to authorized statutory regulator personnel.
        </p>
      </div>
    );
  }

  const filteredInstitutions = institutions.filter((it) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'over' && it.status !== 'Exceeds Capacity') return false;
      if (statusFilter === 'near' && it.status !== 'Near Capacity') return false;
      if (statusFilter === 'available' && it.status !== 'Within Capacity') return false;
      if (statusFilter === 'unconfigured' && it.status !== 'Configuration Missing') return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        it.institution_name.toLowerCase().includes(q) ||
        it.institution_code.toLowerCase().includes(q) ||
        (it.state && it.state.toLowerCase().includes(q)) ||
        (it.aicte_id && it.aicte_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const total = filteredInstitutions.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const paginatedInstitutions = filteredInstitutions.slice((page - 1) * pageSize, page * pageSize);

  // Pie chart data for data quality
  const qualityChartData = overview ? [
    { name: 'Ready (Verified)', value: overview.data_quality_summary.ready_count, color: '#10B981' },
    { name: 'Needs Review', value: overview.data_quality_summary.needs_review_count, color: '#F59E0B' },
    { name: 'Invalid Data', value: overview.data_quality_summary.invalid_data_count, color: '#EF4444' }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-600" />
              Statutory Regulator View
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight mt-1">
            Regulator Monitoring & Intake Oversight
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            System-wide aggregate intake capacity, cross-institution duplicate monitoring, and data quality across AICTE-approved institutions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs">
            <span className="text-slate-500">Session:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer text-slate-800 font-bold"
            >
              <option value={2026}>Academic Year 2026</option>
              <option value={2025}>Academic Year 2025</option>
              <option value={2024}>Academic Year 2024</option>
            </select>
          </div>

          <button
            onClick={fetchRegulatorData}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Refresh oversight metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Download CSV export of aggregate institutional capacity"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Aggregate CSV
          </button>
        </div>
      </div>

      {/* Statutory Regulatory Privacy Notice */}
      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-indigo-950 text-xs flex items-start space-x-3 shadow-xs">
        <ShieldAlert className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Aggregated Statutory Oversight Mode</span>
          <p className="mt-0.5 text-indigo-900 m-0 leading-relaxed">
            This dashboard provides authorized regulatory authorities with aggregate institutional metrics, intake tracking, and data-quality indicators. In accordance with student data privacy safeguards, student-level personal identification records (names, roll numbers, full APAAR IDs) are not accessible.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 min-h-[120px] flex flex-col justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))
        ) : overview ? (
          <>
            <MetricCard
              title="Institutions"
              value={overview.total_institutions}
              subtitle="Registered AICTE colleges"
              icon={Building2}
              colorVariant="blue"
            />
            <MetricCard
              title="Active Students"
              value={overview.total_active_students}
              subtitle={`Batch ${selectedYear} (${overview.total_active_students_all_years} all cohorts)`}
              icon={Users}
              colorVariant="blue"
            />
            <MetricCard
              title="Approved Intake"
              value={overview.total_approved_regular_intake}
              subtitle="Sanctioned regular quota"
              icon={BarChart3}
              colorVariant="blue"
            />
            <MetricCard
              title="Seat Utilization"
              value={`${overview.overall_regular_utilization}%`}
              subtitle={`${overview.total_regular_enrolled} regular enrolled`}
              icon={TrendingUp}
              colorVariant={
                overview.overall_regular_utilization > 100 ? 'rose' :
                overview.overall_regular_utilization >= 90 ? 'amber' : 'emerald'
              }
            />
            <MetricCard
              title="Supernumerary"
              value={`${overview.total_supernumerary_enrolled} / ${overview.total_supernumerary_intake}`}
              subtitle="Enrolled / Quota capacity"
              icon={Layers}
              colorVariant="amber"
            />
            <MetricCard
              title="Capacity Alerts"
              value={`${overview.institutions_exceeding_capacity_count} Inst`}
              subtitle={`${overview.courses_exceeding_capacity_count} courses exceeding quota`}
              icon={AlertTriangle}
              colorVariant={overview.courses_exceeding_capacity_count > 0 ? 'rose' : 'emerald'}
            />
          </>
        ) : null}
      </div>

      {/* Quality Indicators & Category Breakdown */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Validation Quality Status */}
          <Card rounded="2xl" className="flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div>
                <CardTitle>Data Quality & Validation</CardTitle>
                <CardDescription>Aggregate student data verification status</CardDescription>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                Rule Engine
              </span>
            </CardHeader>
            <CardContent className="pt-4 flex-1">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qualityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {qualityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-900 border border-emerald-100">
                  <span className="text-[10px] block opacity-80">Ready</span>
                  <span className="font-mono font-bold text-sm">{overview.data_quality_summary.ready_count}</span>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-900 border border-amber-100">
                  <span className="text-[10px] block opacity-80">Needs Review</span>
                  <span className="font-mono font-bold text-sm">{overview.data_quality_summary.needs_review_count}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg text-rose-900 border border-rose-100">
                  <span className="text-[10px] block opacity-80">Invalid</span>
                  <span className="font-mono font-bold text-sm">{overview.data_quality_summary.invalid_data_count}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admission Categories Breakdown */}
          <Card rounded="2xl" className="flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div>
                <CardTitle>Admission Category Distribution</CardTitle>
                <CardDescription>Enrolment demographic totals ({selectedYear})</CardDescription>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Phase 4 Standards
              </span>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                {[
                  { key: 'General', label: 'General / Regular', count: overview.admission_categories.General || 0, color: 'bg-blue-500' },
                  { key: 'NRI', label: 'Non-Resident Indian (NRI)', count: overview.admission_categories.NRI || 0, color: 'bg-emerald-500' },
                  { key: 'OCI', label: 'Overseas Citizen of India (OCI)', count: overview.admission_categories.OCI || 0, color: 'bg-purple-500' },
                  { key: 'Foreign National', label: 'Foreign National (FN)', count: overview.admission_categories['Foreign National'] || 0, color: 'bg-amber-500' },
                  { key: 'Other', label: 'Other Reserved Quotas', count: overview.admission_categories.Other || 0, color: 'bg-slate-500' },
                ].map((cat) => {
                  const pct = overview.total_active_students > 0
                    ? Math.round((cat.count / overview.total_active_students) * 100)
                    : 0;
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{cat.label}</span>
                        <span className="font-mono font-bold text-slate-900">{cat.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${cat.color}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 m-0 italic pt-2 border-t border-slate-100">
                Demographic categories are tracked orthogonally to supernumerary seat allocation.
              </p>
            </CardContent>
          </Card>

          {/* Duplicate & Collision Oversight */}
          <Card rounded="2xl" className="flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div>
                <CardTitle>Cross-Institution Collisions</CardTitle>
                <CardDescription>Multi-tenant duplicate identity oversight</CardDescription>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                Phase 3 Engine
              </span>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-purple-900 block">Cross-Institution APAAR Collisions</span>
                    <span className="text-[11px] text-purple-700">Identical APAAR detected across different institutions</span>
                  </div>
                  <span className="text-xl font-mono font-bold text-purple-900">
                    {overview.duplicate_review_summary.cross_institution_collisions}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Total Open Duplicate Alerts</span>
                    <span className="text-[11px] text-slate-600">Pending review cases for duplicate identity</span>
                  </div>
                  <span className="text-xl font-mono font-bold text-slate-800">
                    {overview.duplicate_review_summary.total_open_duplicate_alerts}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">Pending Review Cases</span>
                    <span className="text-[11px] text-amber-800">Awaiting institutional verification officer action</span>
                  </div>
                  <span className="text-xl font-mono font-bold text-amber-900">
                    {overview.duplicate_review_summary.pending_review_cases}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-semibold block text-slate-700">Privacy Safeguard Notice</span>
                <p className="m-0 leading-tight">
                  Cross-institution collisions are detected without exposing confidential student identities across institutional tenant boundaries.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Institution-Level Monitoring Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Institution-Level Capacity Monitoring</h2>
            <p className="text-xs text-slate-500">Aggregate enrollment, approved intake quotas, and data quality by registered institution.</p>
          </div>
        </div>

        {/* Search & Filters */}
        <Card rounded="2xl" className="p-3.5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by institution name, code, state, or AICTE ID..."
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
              { id: 'ALL', label: 'All Institutions' },
              { id: 'over', label: 'Exceeds Capacity' },
              { id: 'near', label: 'Near Capacity (≥90%)' },
              { id: 'available', label: 'Within Limit' },
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

        {/* Table */}
        <Card rounded="2xl" className="border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Institution</th>
                  <th className="px-4 py-3.5 font-semibold">Approved Intake</th>
                  <th className="px-4 py-3.5 font-semibold">Regular Enrolled</th>
                  <th className="px-4 py-3.5 font-semibold">Supernumerary</th>
                  <th className="px-4 py-3.5 font-semibold">Utilization</th>
                  <th className="px-4 py-3.5 font-semibold">Categories</th>
                  <th className="px-4 py-3.5 font-semibold">Pending Reviews</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400 text-xs">
                      Loading aggregate institutional oversight data...
                    </td>
                  </tr>
                ) : filteredInstitutions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-500 text-xs">
                      No institutions found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedInstitutions.map((inst) => (
                    <tr
                      key={inst.institution_id}
                      onClick={() => handleExamineCourses(inst)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {inst.institution_name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {inst.institution_code} • {inst.state || 'N/A'} {inst.aicte_id ? `• AICTE: ${inst.aicte_id}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm font-semibold text-slate-800">
                        {inst.approved_regular_intake > 0 ? (
                          inst.approved_regular_intake
                        ) : (
                          <span className="text-slate-400 italic">Not Configured</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm text-slate-700">
                        {inst.regular_enrolled}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <span className="font-semibold text-slate-800">{inst.supernumerary_enrolled}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-slate-600">{inst.supernumerary_quota}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {inst.approved_regular_intake > 0 ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  inst.regular_utilization > 100 ? 'bg-rose-500' :
                                  inst.regular_utilization >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, inst.regular_utilization)}%` }}
                              ></div>
                            </div>
                            <span className="font-semibold">{inst.regular_utilization}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 text-[11px] max-w-[170px]">
                          {inst.admission_categories.NRI > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">NRI: {inst.admission_categories.NRI}</span>
                          )}
                          {inst.admission_categories.OCI > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium">OCI: {inst.admission_categories.OCI}</span>
                          )}
                          {inst.admission_categories['Foreign National'] > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">FN: {inst.admission_categories['Foreign National']}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">Gen: {inst.admission_categories.General || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {inst.pending_review_cases > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            {inst.pending_review_cases} pending
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={inst.status} size="sm" />
                        {inst.warning && (
                          <p className="text-[11px] text-rose-700 mt-1 font-medium leading-tight max-w-[190px]">
                            {inst.warning}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleExamineCourses(inst)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>Examine</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <div className="flex items-center space-x-2">
              <span>Rows per page:</span>
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
              </select>
              <span className="text-slate-400 ml-2">
                Showing {startIndex} - {endIndex} of {total} institutions
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="font-medium text-slate-600">
                Page {page} of {totalPages}
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
      </div>

      {/* EXAMINE INSTITUTION COURSES MODAL */}
      {examiningInst && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setExaminingInst(null)}></div>
          <div className="relative bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl z-10 border border-slate-200 space-y-4 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900 m-0">
                    {examiningInst.institution_name}
                  </h3>
                  <StatusBadge status={examiningInst.status} size="sm" />
                </div>
                <p className="text-xs text-slate-500 font-mono m-0">
                  Code: <span className="font-semibold text-slate-700">{examiningInst.institution_code}</span> • State: <span className="font-semibold text-slate-700">{examiningInst.state}</span> • Academic Session: <span className="font-semibold text-slate-700">{selectedYear}</span>
                </p>
              </div>
              <button
                onClick={() => setExaminingInst(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Institution Capacity Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Total Approved Regular</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {examiningInst.approved_regular_intake || 'Not Configured'}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-[11px] text-blue-700 block">Regular Enrolled</span>
                <span className="font-mono text-base font-bold text-blue-900">
                  {examiningInst.regular_enrolled}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[11px] text-amber-800 block">Supernumerary (Enr/Quota)</span>
                <span className="font-mono text-base font-bold text-amber-900">
                  {examiningInst.supernumerary_enrolled} / {examiningInst.supernumerary_quota}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Seat Utilization</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {examiningInst.regular_utilization}%
                </span>
              </div>
            </div>

            {/* Course-level Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Course-by-Course Capacity Breakdown ({examiningCourses.length} courses)
              </span>
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Course</th>
                      <th className="px-3.5 py-2.5 font-semibold">Approved</th>
                      <th className="px-3.5 py-2.5 font-semibold">Regular</th>
                      <th className="px-3.5 py-2.5 font-semibold">Supernumerary</th>
                      <th className="px-3.5 py-2.5 font-semibold">Remaining</th>
                      <th className="px-3.5 py-2.5 font-semibold">Utilization</th>
                      <th className="px-3.5 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingCourses ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Loading course breakdown...
                        </td>
                      </tr>
                    ) : examiningCourses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No course capacity records found.
                        </td>
                      </tr>
                    ) : (
                      examiningCourses.map((c) => (
                        <tr key={c.course_id} className="hover:bg-slate-50/60">
                          <td className="px-3.5 py-2">
                            <span className="font-semibold text-slate-900 block">{c.course_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.course_code}</span>
                          </td>
                          <td className="px-3.5 py-2 font-mono font-semibold text-slate-800">
                            {c.approved_regular_intake || '—'}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-slate-700">
                            {c.regular_enrolled}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-slate-600">
                            {c.supernumerary_enrolled} / {c.supernumerary_quota}
                          </td>
                          <td className="px-3.5 py-2 font-mono">
                            {c.approved_regular_intake > 0 ? (
                              c.remaining_regular_capacity < 0 ? (
                                <span className="text-rose-600 font-bold">Over by {Math.abs(c.remaining_regular_capacity)}</span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">{c.remaining_regular_capacity}</span>
                              )
                            ) : '—'}
                          </td>
                          <td className="px-3.5 py-2 font-mono">
                            {c.approved_regular_intake > 0 ? `${c.regular_utilization}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2">
                            <StatusBadge status={c.status} size="sm" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-[11px] text-slate-400 italic">
                Statutory regulatory view. Zero student personal data disclosed.
              </span>
              <button
                onClick={() => setExaminingInst(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
