export type Role = 'institution_admin' | 'verification_officer' | 'regulator';

// Student validation status has strictly 3 states (Section 3a)
export type StudentStatus = 'Ready' | 'Invalid Data' | 'Needs Review';

// Review case status has strictly 5 states (Section 3b)
export type ReviewCaseStatus = 
  | 'Pending Review' 
  | 'In Progress' 
  | 'Correction Requested' 
  | 'Resolved' 
  | 'False Positive';

export interface Institution {
  id: number;
  code: string;
  name: string;
  aicte_id?: string;
  state?: string;
  district?: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  institution_id: number;
  institution?: Institution;
  is_active: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  department?: string;
  duration_years: number;
}

export interface StudentListItem {
  id: number;
  institution_id: number;
  course_id?: number;
  course_name?: string;
  course_code?: string;
  masked_apaar_id: string;
  has_apaar: boolean;
  roll_number: string;
  full_name: string;
  date_of_birth?: string;
  gender?: string;
  admission_year: number;
  email?: string;
  phone?: string;
  admission_category?: string;
  is_supernumerary?: boolean;
  status: StudentStatus;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValidationResultItem {
  id: number;
  rule_id: string;
  rule_name: string;
  severity: 'error' | 'warning' | 'info';
  status: 'passed' | 'failed';
  message: string;
  affected_field?: string;
  suggested_action?: string;
  created_at: string;
}

export interface StudentDetail extends StudentListItem {
  institution_name?: string;
  institution_code?: string;
  course?: Course;
  apaar_length: number;
  validation_results: ValidationResultItem[];
  official_verification_notice: string;
}

export interface StudentRevealResponse {
  student_id: number;
  roll_number: string;
  full_name: string;
  apaar_id: string | null;
  warning: string;
}

export interface PaginatedStudents {
  items: StudentListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DuplicateAlert {
  id: number;
  institution_id: number;
  student_id_1: number;
  student_id_2: number;
  alert_type: string;
  matching_fields: string;
  similarity_score: number;
  status: 'open' | 'resolved' | 'false_positive';
  student_1?: StudentListItem;
  student_2?: StudentListItem;
}

export interface ReviewNote {
  id: number;
  review_case_id: number;
  user_id?: number;
  note_text: string;
  action_taken: string;
  created_at: string;
  author_name?: string;
  author?: User;
}

export interface ReviewCase {
  id: number;
  institution_id: number;
  student_id: number;
  student_name?: string;
  roll_number?: string;
  course_code?: string;
  masked_apaar?: string;
  student?: StudentListItem;
  duplicate_alert_id?: number;
  has_duplicate_alert?: boolean;
  fingerprint?: string;
  reopened_from_id?: number;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: ReviewCaseStatus;
  resolution_summary?: string;
  resolved_at?: string;
  created_at: string;
}

export interface IntakeConfig {
  id?: number;
  institution_id?: number;
  course_id: number;
  course_name?: string;
  course_code?: string;
  course?: Course;
  academic_year: number;
  approved_intake: number;
  supernumerary_intake?: number;
  current_count?: number;
  enrolled_count?: number;
  enrolled_regular?: number;
  enrolled_supernumerary?: number;
  remaining_capacity?: number;
  utilization_percent?: number;
  status?: 'Within Capacity' | 'Near Capacity' | 'Exceeds Capacity' | 'Configuration Missing' | string;
  warning?: string | null;
  categories?: Record<string, number>;
  missing_alert?: string | null;
  has_config?: boolean;
  source?: string;
  notes?: string;
  updated_at?: string | null;
}

export interface IntakeMonitoringResponse {
  institution_id: number;
  academic_year: number;
  total_approved_intake: number;
  total_supernumerary_intake: number;
  total_enrolled_students: number;
  total_regular_enrolled: number;
  total_supernumerary_enrolled: number;
  category_totals: Record<string, number>;
  overall_utilization: number;
  items: IntakeConfig[];
  aggregate_alerts: AggregateIntakeAlert[];
  disclaimer: string;
}

export interface AggregateIntakeAlert {
  course_id: number;
  course_code: string;
  course_name: string;
  academic_year: number;
  enrolled_count: number;
  approved_intake: number;
  utilization_percent?: number;
  status: string;
  message: string;
}

export interface AuditLog {
  id: number;
  institution_id?: number;
  user_id?: number;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface RegulatorOverviewData {
  academic_year: number;
  total_institutions: number;
  total_active_students_all_years: number;
  total_active_students: number;
  total_approved_regular_intake: number;
  total_regular_enrolled: number;
  total_supernumerary_intake: number;
  total_supernumerary_enrolled: number;
  overall_regular_utilization: number;
  institutions_exceeding_capacity_count: number;
  courses_exceeding_capacity_count: number;
  admission_categories: Record<string, number>;
  data_quality_summary: {
    ready_count: number;
    needs_review_count: number;
    invalid_data_count: number;
    total_evaluated: number;
  };
  duplicate_review_summary: {
    pending_review_cases: number;
    total_open_duplicate_alerts: number;
    cross_institution_collisions: number;
  };
  disclaimer: string;
}

export interface RegulatorInstitutionItem {
  institution_id: number;
  institution_name: string;
  institution_code: string;
  aicte_id?: string;
  state?: string;
  district?: string;
  active_students_count: number;
  approved_regular_intake: number;
  regular_enrolled: number;
  supernumerary_quota: number;
  supernumerary_enrolled: number;
  regular_utilization: number;
  status: 'Within Capacity' | 'Near Capacity' | 'Exceeds Capacity' | 'Configuration Missing' | string;
  warning?: string | null;
  admission_categories: Record<string, number>;
  pending_review_cases: number;
  open_duplicate_alerts: number;
  courses_count: number;
  courses_exceeding_count: number;
}

export interface RegulatorCourseItem {
  course_id: number;
  course_code: string;
  course_name: string;
  approved_regular_intake: number;
  supernumerary_quota: number;
  regular_enrolled: number;
  supernumerary_enrolled: number;
  total_enrolled: number;
  remaining_regular_capacity: number;
  regular_utilization: number;
  status: string;
  warning?: string | null;
  categories: Record<string, number>;
}

// Phase 6: Student Consent & Privacy Controls
export type ConsentStatus = 'not_recorded' | 'granted' | 'withdrawn';

export interface ConsentEvent {
  id: number;
  previous_status: string;
  new_status: string;
  action: string;
  consent_type: string;
  notice_version: string;
  notes?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  timestamp: string;
}

export interface StudentConsent {
  student_id: number;
  institution_id: number;
  status: ConsentStatus;
  consent_type: string;
  notice_version: string;
  notes?: string | null;
  recorded_by_name?: string | null;
  recorded_by_role?: string | null;
  recorded_at?: string | null;
  history: ConsentEvent[];
  disclaimer: string;
}

export interface ConsentSummary {
  institution_id: number;
  total_students: number;
  granted: number;
  withdrawn: number;
  not_recorded: number;
}
