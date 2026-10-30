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
  Info
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { StudentListItem, StudentDetail, Course, PaginatedStudents, StudentRevealResponse } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Input, Select, Card } from '../components/ui';
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
  const handleViewDetail = async (student: StudentListItem) => {
    setRevealedApaar(null);
    setRevealWarning(null);
    try {
      const detail = await api.get<StudentDetail>(`/students/${student.id}`);
      setSelectedStudentDetail(detail);
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
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Student Records</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, search, validate, and manage institutional student profiles.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Student Record
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
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
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
              placeholder="Search by name, roll no, or APAAR..."
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
              <option value="">All Courses</option>
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
              <option value="">All Admission Years</option>
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
              <option value="">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Invalid Data">Invalid Data</option>
            </select>
          </div>
        </div>

        {/* Clear Filters indicator */}
        {(search || selectedCourse || selectedYear || selectedStatus) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtering records</span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filters
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
                <th className="px-5 py-3.5 font-semibold">Roll Number</th>
                <th className="px-5 py-3.5 font-semibold">Student Name</th>
                <th className="px-5 py-3.5 font-semibold">APAAR ID (Masked)</th>
                <th className="px-5 py-3.5 font-semibold">Course</th>
                <th className="px-5 py-3.5 font-semibold">Year</th>
                <th className="px-5 py-3.5 font-semibold">Local Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Loading institutional student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No student records matched your search or filters.
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
                        title="View Validation Details"
                      >
                        <Eye className="w-4 h-4" />
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
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-slate-400 ml-2">Total records: {total}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition"
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
                  Roll No: {selectedStudentDetail.roll_number} • Year: {selectedStudentDetail.admission_year}
                </p>
              </div>
              <button onClick={() => setSelectedStudentDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official Verification Boundary Banner */}
            <div className="p-4 bg-amber-50 border-b border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold m-0">{selectedStudentDetail.official_verification_notice}</p>
                <p className="mt-1 text-amber-800 m-0">
                  Local 12-digit format check and duplicate detection do not constitute official UIDAI or DigiLocker verification.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Profile Overview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Academic & Personal Profile</h3>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Course</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.course?.name || selectedStudentDetail.course_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">APAAR Identifier</span>
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
                          {isRevealing ? 'Revealing...' : 'Reveal (Audited)'}
                        </button>
                      )}
                    </div>
                    {revealWarning && (
                      <p className="text-[10px] text-amber-700 mt-1 font-medium">{revealWarning}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Date of Birth</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.date_of_birth || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Gender</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.gender || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Email Address</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.email || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Phone</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetail.phone || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Validation Results Checklist */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Local Validation Rule Results ({selectedStudentDetail.validation_results.length})
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
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                Close Drawer
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
                {editingStudent ? 'Edit Student Record' : 'Add New Student Record'}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 pt-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Roll Number"
                  isRequired
                  placeholder="e.g. 2026-CSE-001"
                  {...register('roll_number')}
                  error={errors.roll_number?.message}
                />

                <Input
                  label="Admission Year"
                  type="number"
                  isRequired
                  min={2000}
                  max={2030}
                  {...register('admission_year', { valueAsNumber: true })}
                  error={errors.admission_year?.message}
                />
              </div>

              <Input
                label="Student Full Name"
                isRequired
                placeholder="e.g. Ramesh Kumar / O'Connor / Jean-Luc"
                {...register('full_name')}
                error={errors.full_name?.message}
              />

              <Input
                label="APAAR ID (12 Digits, optional)"
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="e.g. 012345678901 (leading zero preserved)"
                helperText="Stored as string to preserve leading zeros."
                {...register('apaar_id', {
                  onChange: (e) => {
                    e.target.value = sanitizeDigitsOnly(e.target.value, 12);
                  }
                })}
                error={errors.apaar_id?.message}
              />

              <Select
                label="Course"
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
                  label="Date of Birth"
                  type="date"
                  {...register('date_of_birth')}
                  error={errors.date_of_birth?.message}
                />

                <Select
                  label="Gender"
                  {...register('gender')}
                  error={errors.gender?.message}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="student@institution.edu"
                  {...register('email')}
                  error={errors.email?.message}
                />

                <Input
                  label="Phone (Indian Mobile)"
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
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingStudent ? 'Update & Validate' : 'Create & Validate'}
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
            <h2 className="text-lg font-bold text-slate-900 m-0">Archive Student Record?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to archive record for <span className="font-semibold text-slate-900">{archiveTarget.full_name}</span> (Roll: {archiveTarget.roll_number})?
              The student will be soft-archived from active lists and intake computations.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
