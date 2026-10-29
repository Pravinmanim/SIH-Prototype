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
import type { Course } from '../types';

export const ReportsPage: React.FC = () => {
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
      title: 'Student Master Summary',
      description: 'Comprehensive roster with roll numbers, courses, admission batches, and masked APAAR IDs.',
      icon: Users
    },
    {
      id: 'validation_issues',
      title: 'Validation Issues & Error Log',
      description: 'All local validation failures, missing fields, and rule violation descriptions across active records.',
      icon: AlertTriangle
    },
    {
      id: 'duplicate_alerts',
      title: 'Duplicate Identifiers Report',
      description: 'Exact duplicate APAAR and roll collisions with matching fields and resolution audit details.',
      icon: FileSpreadsheet
    },
    {
      id: 'intake_utilization',
      title: 'Intake Capacity Audit',
      description: 'Course-wise approved seat capacity versus actual enrollment and utilization metrics.',
      icon: BarChart3
    },
    {
      id: 'review_activity',
      title: 'Verification Activity History',
      description: 'Timeline of officer decisions, notes, corrections requested, and case resolutions.',
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
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Institutional Reports & Data Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export transparent compliance, verification, and audit reports in standard CSV format.
        </p>
      </div>

      {/* Notice */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Privacy & Verification Standard</span>
          <p className="mt-0.5 text-blue-800 m-0 leading-relaxed">
            All student summary exports preserve privacy by masking APAAR IDs (XXXX-XXXX-1234). 
            Reports explicitly denote that local records are not officially verified by UIDAI/DigiLocker.
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider m-0">1. Select Report Type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reportOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = reportType === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold m-0">{opt.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 m-0 leading-normal">{opt.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Export Options */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider m-0">2. Apply Optional Scope Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
            >
              <option value="">All Admission Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Student Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Invalid Data">Invalid Data</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400">File format: Standard CSV (.csv) with metadata headers</span>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Preparing Report...' : 'Download CSV Report'}
          </button>
        </div>
      </div>
    </div>
  );
};
