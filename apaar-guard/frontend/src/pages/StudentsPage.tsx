import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert,
  Info,
  CreditCard,
  ShieldCheck,
  History,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';
import { api } from '../services/api';
import type { StudentListItem, StudentDetail, Course, PaginatedStudents, StudentRevealResponse, StudentConsent } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Input, Select, Card } from '../components/ui';
import { StudentIDCardModal } from '../components/students/StudentIDCardModal';
import {
  studentNameSchema,
  indianPhoneSchema,
  apaarIdSchema,
  emailSchema,
  dobSchema,
  rollNumberSchema,
  academicYearSchema,
  courseIdSchema,
  sanitizeDigitsOnly,
} from '../utils/validation';

const studentSchema = z.object({
  roll_number: rollNumberSchema,
  full_name: studentNameSchema,
  apaar_id: apaarIdSchema,
  course_id: courseIdSchema,
  admission_year: academicYearSchema,
  date_of_birth: dobSchema,
  gender: z.string().optional(),
  email: emailSchema,
  phone: indianPhoneSchema,
});

type StudentFormData = z.infer<typeof studentSchema>;

export const StudentsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  
  // Data state
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter & Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [sortBy] = useState('created_at');
  const [sortOrder] = useState('desc');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentListItem | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentDetail | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<StudentListItem | null>(null);
  const [revealedApaar, setRevealedApaar] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealWarning, setRevealWarning] = useState<string | null>(null);
  const [cardStudent, setCardStudent] = useState<StudentDetail | null>(null);
  
  // Phase 6: Student Consent Drawer State
  const [studentConsent, setStudentConsent] = useState<StudentConsent | null>(null);
  const [consentLoading, setConsentLoading] = useState<boolean>(false);
  const [consentActionNotes, setConsentActionNotes] = useState<string>('');
  const [consentSubmitting, setConsentSubmitting] = useState<boolean>(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [showConsentHistory, setShowConsentHistory] = useState<boolean>(false);
  
  // Feedback toasts/alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load courses for dropdown
  useEffect(() => {
    api.get<Course[]>('/courses')
      .then(setCourses)
      .catch(() => {});
  }, []);

  // Fetch student records
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCourse) params.append('course_id', selectedCourse);
      if (selectedYear) params.append('admission_year', selectedYear);
      if (selectedStatus) params.append('status', selectedStatus);

      const res = await api.get<PaginatedStudents>(`/students?${params.toString()}`);
      setStudents(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch student records.' });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedCourse, selectedYear, selectedStatus, sortBy, sortOrder]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedCourse('');
    setSelectedYear('');
    setSelectedStatus('');
    setPage(1);
  };

  // View Details Drawer
  const fetchStudentConsent = useCallback(async (studentId: number) => {
    setConsentLoading(true);
    setConsentError(null);
    try {
      const res = await api.get<StudentConsent>(`/students/${studentId}/consent`);
      setStudentConsent(res);
    } catch (err: any) {
      setConsentError(err.message || 'Unable to fetch consent records.');
    } finally {
      setConsentLoading(false);
    }
  }, []);

  const handleUpdateConsent = async (newStatus: 'granted' | 'withdrawn') => {
    if (!selectedStudentDetail) return;
    setConsentSubmitting(true);
    setConsentError(null);
    try {
      const res = await api.post<StudentConsent>(`/students/${selectedStudentDetail.id}/consent`, {
        status: newStatus,
        notice_version: 'v1.0',
        notes: consentActionNotes.trim() || undefined
      });
      setStudentConsent(res);
      setConsentActionNotes('');
    } catch (err: any) {
      setConsentError(err.message || 'Unable to record consent status change.');
    } finally {
      setConsentSubmitting(false);
    }
  };

  const handleViewDetail = async (student: StudentListItem) => {
    setRevealedApaar(null);
    setRevealWarning(null);
    setStudentConsent(null);
    setConsentActionNotes('');
    setConsentError(null);
    setShowConsentHistory(false);
    try {
      const detail = await api.get<StudentDetail>(`/students/${student.id}`);
      setSelectedStudentDetail(detail);
      fetchStudentConsent(student.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Could not load student details.' });
    }
  };

  const handleRevealApaar = async (studentId: number) => {
    setIsRevealing(true);
    try {
      const res = await api.post<StudentRevealResponse>(`/students/${studentId}/reveal-apaar`);
      setRevealedApaar(res.apaar_id || 'Not Assigned');
      setRevealWarning(res.warning);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reveal confidential APAAR ID.' });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleOpenIdCard = async (studentId: number) => {
    try {
      const detail = await api.get<StudentDetail>(`/students/${studentId}`);
      setCardStudent(detail);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Could not load student ID card data.' });
    }
  };

  // Forms setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema) as any,
    mode: 'onTouched',
    shouldFocusError: true,
  });

  const openAddModal = () => {
    reset({
      roll_number: '',
      full_name: '',
      apaar_id: '',
      course_id: courses[0]?.id || 1,
      admission_year: 2026,
      date_of_birth: '',
      gender: 'Male',
      email: '',
      phone: '',
    });
    setEditingStudent(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (s: StudentListItem) => {
    setEditingStudent(s);
    setValue('roll_number', s.roll_number);
    setValue('full_name', s.full_name);
    setValue('apaar_id', ''); // Keep empty unless admin deliberately modifies
    setValue('course_id', s.course_id || courses[0]?.id || 1);
    setValue('admission_year', s.admission_year);
    setValue('date_of_birth', s.date_of_birth || '');
    setValue('gender', s.gender || 'Male');
    setValue('email', s.email || '');
    setValue('phone', s.phone || '');
    setIsAddModalOpen(true);
  };

  const onSubmitForm = async (data: StudentFormData) => {
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, {
          ...data,
          version: editingStudent.version
        });
        setFeedback({ type: 'success', message: `Student '${data.full_name}' updated and validation re-evaluated.` });
      } else {
        await api.post('/students', data);
        setFeedback({ type: 'success', message: `Student '${data.full_name}' created and local validation completed.` });
      }
      setIsAddModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      if (err.status === 409) {
        setFeedback({ type: 'error', message: 'This record was changed by someone else. Reload and try again.' });
      } else {
        setFeedback({ type: 'error', message: err.message || 'Operation failed.' });
      }
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    try {
      await api.del(`/students/${archiveTarget.id}`);
      setFeedback({ type: 'success', message: `Student '${archiveTarget.full_name}' archived successfully.` });
      setArchiveTarget(null);
      fetchStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to archive student record.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">{t('students_title', 'Student Records')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('students_subtitle', 'Browse, search, validate, and manage institutional student profiles.')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('students_btn_add', 'Add Student Record')}
          </button>
        )}
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <Card rounded="2xl" className="p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder={t('students_search_placeholder', 'Search by name, roll no, or APAAR...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition"
            />
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="">{t('filter_all_courses', 'All Courses')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id.toString()}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          {/* Admission Year Filter */}
          <div>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="">{t('filter_all_years', 'All Admission Years')}</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="">{t('filter_all_status', 'All Statuses')}</option>
              <option value="Ready">{t('status_ready', 'Ready')}</option>
              <option value="Needs Review">{t('status_review', 'Needs Review')}</option>
              <option value="Invalid Data">{t('status_invalid', 'Invalid Data')}</option>
            </select>
          </div>
        </div>

        {/* Clear Filters indicator */}
        {(search || selectedCourse || selectedYear || selectedStatus) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>{t('filter_active', 'Filtering records')}</span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {t('btn_reset', 'Reset Filters')}
            </button>
          </div>
        )}
      </Card>

      {/* Student Table */}
      <Card rounded="2xl" className="border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">{t('col_roll_number', 'Roll Number')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_full_name', 'Student Name')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_apaar_id', 'APAAR ID (Masked)')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_course', 'Course')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_year', 'Year')}</th>
                <th className="px-5 py-3.5 font-semibold">{t('col_status', 'Local Status')}</th>
                <th className="px-5 py-3.5 font-semibold text-right">{t('col_actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    {t('loading', 'Loading institutional student records...')}
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    {t('students_empty', 'No student records matched your search or filters.')}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {student.roll_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{student.full_name}</div>
                      <div className="text-xs text-slate-400">{student.email || 'No email registered'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {student.masked_apaar_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="font-medium">{student.course_code || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">
                      {student.admission_year}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={student.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleViewDetail(student)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title={t('tooltip_view_detail', 'View Validation Details')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenIdCard(student.id)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title={t('btn_view_id_card', 'Student ID & APAAR Card')}
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(student)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Edit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setArchiveTarget(student)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Archive Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-3">
          <div className="flex items-center space-x-2">
            <span>{t('rows_per_page', 'Rows per page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-slate-400 ml-2">{t('total_records', 'Total records')}: {total}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>{t('page_of', 'Page')} {page} of {totalPages}</span>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* DETAIL DRAWER */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setSelectedStudentDetail(null)}></div>
          <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900 m-0">{selectedStudentDetail.full_name}</h2>
                  <StatusBadge status={selectedStudentDetail.status} />
                </div>
                <p className="text-sm text-slate-500 mt-1 font-mono">
                  {t('col_roll_number', 'Roll Number')}: {selectedStudentDetail.roll_number} • {t('col_year', 'Year')}: {selectedStudentDetail.admission_year}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCardStudent(selectedStudentDetail)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition cursor-pointer"
                  title="Preview & print Student ID Card"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{t('btn_id_card', 'Student ID Card')}</span>
                </button>
                <button onClick={() => setSelectedStudentDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Verification Boundary Banner */}
            <div className="p-4 bg-amber-50 border-b border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold m-0">{t('official_notice', selectedStudentDetail.official_verification_notice)}</p>
                <p className="mt-1 text-amber-800 m-0">
                  {t('official_notice_short', 'Local 12-digit format check and duplicate detection do not constitute official UIDAI or DigiLocker verification.')}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Profile Overview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('drawer_student_profile', 'Academic & Personal Profile')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">{t('col_course', 'Course')}</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.course?.name || selectedStudentDetail.course_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t('col_apaar_id', 'APAAR Identifier')}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-medium text-slate-800">
                        {revealedApaar !== null ? revealedApaar : selectedStudentDetail.masked_apaar_id}
                      </span>
                      {isAdmin && selectedStudentDetail.has_apaar && revealedApaar === null && (
                        <button
                          onClick={() => handleRevealApaar(selectedStudentDetail.id)}
                          disabled={isRevealing}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition"
                          title="View complete 12-digit APAAR ID (creates an immutable audit log entry)"
                        >
                          <Eye className="w-3 h-3" />
                          {isRevealing ? t('loading', 'Revealing...') : t('drawer_reveal_apaar', 'Reveal (Audited)')}
                        </button>
                      )}
                    </div>
                    {revealWarning && (
                      <p className="text-[10px] text-amber-700 mt-1 font-medium">{revealWarning}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t('field_dob', 'Date of Birth')}</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.date_of_birth || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t('field_gender', 'Gender')}</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.gender || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t('field_email', 'Email Address')}</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.email || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t('field_phone', 'Phone')}</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.phone || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Validation Results Checklist */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {t('drawer_validation_rules', 'Local Validation Rule Results')} ({selectedStudentDetail.validation_results.length})
                </h3>
                <div className="space-y-2.5">
                  {selectedStudentDetail.validation_results.map((res) => {
                    const isPassed = res.status === 'passed';
                    return (
                      <div
                        key={res.id}
                        className={`p-3.5 rounded-xl border text-xs ${
                          isPassed
                            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                            : res.severity === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center space-x-1.5">
                            {isPassed ? (
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            ) : res.severity === 'error' ? (
                              <XCircle className="w-4 h-4 text-rose-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            )}
                            <span>{res.rule_name}</span>
                          </span>
                          <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-white/70">
                            {res.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700 m-0 leading-relaxed">{res.message}</p>
                        {res.suggested_action && (
                          <p className="mt-1.5 text-blue-800 font-medium m-0 flex items-center space-x-1">
                            <Info className="w-3.5 h-3.5" />
                            <span>Action: {res.suggested_action}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Student Consent & Privacy Controls (Phase 6) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 m-0">
                      Student Consent & Privacy Control (Workflow Record)
                    </h3>
                  </div>
                  {studentConsent && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      studentConsent.status === 'granted' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : studentConsent.status === 'withdrawn'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {studentConsent.status === 'granted' ? 'Consent Granted' : studentConsent.status === 'withdrawn' ? 'Consent Withdrawn' : 'Not Recorded'}
                    </span>
                  )}
                </div>

                {/* Disclaimer Banner */}
                <div className="text-[11px] bg-blue-50/70 border border-blue-200 text-blue-900 rounded-lg p-2.5 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold m-0">Staff-Recorded Workflow Status Only</p>
                    <p className="text-blue-800 mt-0.5 m-0 leading-tight">
                      Consent records in this prototype are workflow records documented by authorized institutional staff. They do not independently prove legal compliance or direct student signature.
                    </p>
                  </div>
                </div>

                {consentLoading ? (
                  <div className="text-xs text-slate-500 py-2">Loading consent status...</div>
                ) : studentConsent ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Notice / Purpose Version:</span>
                        <span className="font-medium text-slate-800">{studentConsent.notice_version}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Latest Action Timestamp:</span>
                        <span className="font-medium text-slate-800">
                          {studentConsent.recorded_at ? new Date(studentConsent.recorded_at).toLocaleString() : 'Not yet recorded'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Recorded By Staff:</span>
                        <span className="font-medium text-slate-800">
                          {studentConsent.recorded_by_name ? `${studentConsent.recorded_by_name} (${studentConsent.recorded_by_role})` : 'Not recorded'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Workflow Type:</span>
                        <span className="font-medium text-slate-800">Institutional Staff Entry</span>
                      </div>
                      {studentConsent.notes && (
                        <div className="col-span-2 pt-1 border-t border-slate-100">
                          <span className="text-slate-500 block text-[11px]">Recorded Notes / Reason:</span>
                          <span className="text-slate-700 italic">{studentConsent.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Controlled Action to Record / Update Consent */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Record / Change Consent Decision:
                      </label>
                      <input
                        type="text"
                        placeholder="Optional safe reason notes (max 500 chars)"
                        value={consentActionNotes}
                        onChange={(e) => setConsentActionNotes(e.target.value.slice(0, 500))}
                        maxLength={500}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={consentSubmitting}
                      />
                      {consentError && (
                        <p className="text-[11px] text-rose-600 font-medium m-0">{consentError}</p>
                      )}
                      <div className="flex items-center space-x-2 pt-1">
                        {studentConsent.status !== 'granted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateConsent('granted')}
                            disabled={consentSubmitting}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Record Granted</span>
                          </button>
                        )}
                        {studentConsent.status === 'granted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateConsent('withdrawn')}
                            disabled={consentSubmitting}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Record Withdrawal</span>
                          </button>
                        )}
                        {studentConsent.status === 'withdrawn' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateConsent('granted')}
                            disabled={consentSubmitting}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Re-affirm Consent</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* History Timeline Toggle */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowConsentHistory(!showConsentHistory)}
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>{showConsentHistory ? 'Hide Consent Audit History' : `View Consent Audit History (${studentConsent.history.length})`}</span>
                      </button>

                      {showConsentHistory && (
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                          {studentConsent.history.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic p-2 bg-white rounded border border-slate-200">
                              No previous consent history events recorded.
                            </p>
                          ) : (
                            studentConsent.history.map((ev) => (
                              <div key={ev.id} className="p-2 bg-white rounded border border-slate-200 text-[11px]">
                                <div className="flex items-center justify-between font-medium">
                                  <span className="text-slate-800">
                                    {ev.action} ({ev.previous_status} → {ev.new_status})
                                  </span>
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    {new Date(ev.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  Recorded by: {ev.actor_name || 'Staff'} ({ev.actor_role || 'Staff'}) • Notice: {ev.notice_version}
                                </div>
                                {ev.notes && (
                                  <div className="text-slate-600 italic mt-0.5">Notes: {ev.notes}</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCardStudent(selectedStudentDetail)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('btn_print_id_card', 'Print Student ID Card')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-300 cursor-pointer"
              >
                {t('btn_close', 'Close Drawer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl z-10 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 m-0">
                {editingStudent ? t('modal_edit_student', 'Edit Student Record') : t('modal_add_student', 'Add New Student Record')}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 pt-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('field_roll_number', 'Roll Number')}
                  isRequired
                  placeholder="e.g. 2026-CSE-001"
                  {...register('roll_number')}
                  error={errors.roll_number?.message}
                />

                <Input
                  label={t('field_admission_year', 'Admission Year')}
                  type="number"
                  isRequired
                  min={2000}
                  max={2030}
                  {...register('admission_year', { valueAsNumber: true })}
                  error={errors.admission_year?.message}
                />
              </div>

              <Input
                label={t('field_full_name', 'Student Full Name')}
                isRequired
                placeholder="e.g. Ramesh Kumar"
                {...register('full_name')}
                error={errors.full_name?.message}
              />

              <Input
                label={t('field_apaar_id', 'APAAR ID (12 Digits, optional)')}
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="e.g. 012345678901"
                helperText="Stored as string to preserve leading zeros."
                {...register('apaar_id', {
                  onChange: (e) => {
                    e.target.value = sanitizeDigitsOnly(e.target.value, 12);
                  }
                })}
                error={errors.apaar_id?.message}
              />

              <Select
                label={t('field_course', 'Course')}
                isRequired
                {...register('course_id', { valueAsNumber: true })}
                error={errors.course_id?.message}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('field_dob', 'Date of Birth')}
                  type="date"
                  {...register('date_of_birth')}
                  error={errors.date_of_birth?.message}
                />

                <Select
                  label={t('field_gender', 'Gender')}
                  {...register('gender')}
                  error={errors.gender?.message}
                >
                  <option value="Male">{t('gender_male', 'Male')}</option>
                  <option value="Female">{t('gender_female', 'Female')}</option>
                  <option value="Other">{t('gender_other', 'Other')}</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('field_email', 'Email Address')}
                  type="email"
                  placeholder="student@institution.edu"
                  {...register('email')}
                  error={errors.email?.message}
                />

                <Input
                  label={t('field_phone', 'Phone (Indian Mobile)')}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  helperText="10 digits starting with 6, 7, 8, or 9"
                  {...register('phone', {
                    onChange: (e) => {
                      e.target.value = sanitizeDigitsOnly(e.target.value, 10);
                    }
                  })}
                  error={errors.phone?.message}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t('saving', 'Saving...') : editingStudent ? t('btn_update_validate', 'Update & Validate') : t('btn_create_validate', 'Create & Validate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setArchiveTarget(null)}></div>
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 m-0">{t('modal_archive_title', 'Archive Student Record?')}</h2>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to archive record for <span className="font-semibold text-slate-900">{archiveTarget.full_name}</span> (Roll: {archiveTarget.roll_number})?
              The student will be soft-archived from active lists and intake computations.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleArchiveConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer"
              >
                {t('btn_confirm_archive', 'Confirm Archive')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT ID & APAAR CARD MODAL */}
      {cardStudent && (
        <StudentIDCardModal
          student={cardStudent}
          onClose={() => setCardStudent(null)}
          revealedApaar={revealedApaar}
          onRevealApaar={handleRevealApaar}
          isRevealing={isRevealing}
        />
      )}
    </div>
  );
};
