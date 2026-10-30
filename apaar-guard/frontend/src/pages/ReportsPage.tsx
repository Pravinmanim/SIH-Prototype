import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CheckCircle2, 
  ShieldAlert, 
  FileSpreadsheet,
  Users,
  AlertTriangle,
  History,
  BarChart3
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';
import type { Course } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState('student_summary');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<Course[]>('/courses').then(setCourses).catch(() => {});
  }, []);

  const reportOptions = [
    {
      id: 'student_summary',
      title: t('report_opt_students', 'Student Master Summary'),
      description: t('report_opt_students_desc', 'Comprehensive roster with roll numbers, courses, admission batches, and masked APAAR IDs.'),
      icon: Users
    },
    {
      id: 'validation_issues',
      title: t('report_opt_errors', 'Validation Issues & Error Log'),
      description: t('report_opt_errors_desc', 'All local validation failures, missing fields, and rule violation descriptions across active records.'),
      icon: AlertTriangle
    },
    {
      id: 'duplicate_alerts',
      title: t('report_opt_summary', 'Duplicate Identifiers Report'),
      description: t('report_opt_summary_desc', 'Exact duplicate APAAR and roll collisions with matching fields and resolution audit details.'),
      icon: FileSpreadsheet
    },
    {
      id: 'intake_utilization',
      title: t('report_opt_intake', 'Intake Capacity Audit'),
      description: t('report_opt_intake_desc', 'Course-wise approved seat capacity versus actual enrollment and utilization metrics.'),
      icon: BarChart3
    },
    {
      id: 'review_activity',
      title: t('dash_recent_audit', 'Verification Activity History'),
      description: t('dash_audit_sub', 'Timeline of officer decisions, notes, corrections requested, and case resolutions.'),
      icon: History
    },
  ];

  const handleDownload = () => {
    setDownloading(true);
    setDownloadNotice(null);

    const params = new URLSearchParams({ report_type: reportType });
    if (selectedCourse) params.append('course_id', selectedCourse);
    if (selectedYear) params.append('admission_year', selectedYear);
    if (selectedStatus) params.append('status', selectedStatus);

    const url = `/api/reports/export?${params.toString()}`;
    
    // Trigger download via window location
    window.location.href = url;
    
    setTimeout(() => {
      setDownloading(false);
      setDownloadNotice(`Report export triggered: ${reportType}.csv`);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">{t('reports_title', 'Institutional Reports & Data Export')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('reports_sub', 'Export transparent compliance, verification, and audit reports in standard CSV format.')}
        </p>
      </div>

      {/* Notice */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">{t('official_notice_short', 'Privacy & Verification Standard')}</span>
          <p className="mt-0.5 text-blue-800 m-0 leading-relaxed">
            {t('official_notice', 'All student summary exports preserve privacy by masking APAAR IDs (XXXX-XXXX-1234). Reports explicitly denote that local records are not officially verified by UIDAI/DigiLocker.')}
          </p>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{downloadNotice}</span>
          </div>
          <button onClick={() => setDownloadNotice(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Select Report Type Cards */}
      <Card rounded="2xl" className="border border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div>
            <CardTitle>1. {t('report_type_title', 'Select Report Type')}</CardTitle>
            <CardDescription>{t('report_type_desc', 'Choose the institutional dataset and compliance format to export')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {reportOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = reportType === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setReportType(opt.id)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setReportType(opt.id);
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-xs ring-1 ring-blue-600' 
                      : 'border-slate-200/80 hover:border-slate-300 bg-white text-slate-700 hover:shadow-xs'
                  }`}
                >
                  <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold m-0">{opt.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 m-0 leading-relaxed">{opt.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters & Export Options */}
      <Card rounded="2xl" className="border border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div>
            <CardTitle>2. {t('report_filters_title', 'Apply Optional Scope Filters')}</CardTitle>
            <CardDescription>{t('report_filters_desc', 'Filter exported records by course catalog, admission year, or validation status')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('col_course', 'Course')}</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
              >
                <option value="">{t('filter_all_courses', 'All Courses')}</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('col_year', 'Batch Year')}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
              >
                <option value="">{t('filter_all_years', 'All Admission Years')}</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('col_status', 'Student Status')}</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
              >
                <option value="">{t('filter_all_status', 'All Statuses')}</option>
                <option value="Ready">{t('status_ready', 'Ready')}</option>
                <option value="Needs Review">{t('status_review', 'Needs Review')}</option>
                <option value="Invalid Data">{t('status_invalid', 'Invalid Data')}</option>
                <option value="Resolved">{t('tab_resolved', 'Resolved')}</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-400">File format: Standard CSV (.csv) with boundary metadata headers</span>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? t('loading', 'Preparing Report...') : t('btn_export_csv', 'Download CSV Report')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
