export type Role = 'institution_admin' | 'verification_officer';

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
  id: number;
  institution_id: number;
  course_id: number;
  course_name?: string;
  course_code?: string;
  course?: Course;
  academic_year: number;
  approved_intake: number;
  current_count?: number;
  enrolled_count?: number;
  utilization_percent?: number;
  status?: 'Within Capacity' | 'Near Capacity' | 'Exceeds Capacity' | 'Configuration Missing';
  source?: string;
  notes?: string;
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
