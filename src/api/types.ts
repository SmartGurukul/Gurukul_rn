import type { DayOfWeek } from './timetable';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

export interface School {
  id: string;
  name: string;
  /** Null for a school that signed up in the app and has not filled its profile in. */
  address: string | null;
  city: string;
  state: string;
  pincode: string;
  contactEmail: string | null;
  contactPhone: string;
  principalName: string;
  directorName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankAccountHolderName: string | null;
  upiVpaOverride: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  /** Staff may self check-in from phones whose fake-GPS device checks the app could not run (Expo Go). Off by default. */
  allowUnverifiedSelfMark?: boolean;
  /** Short-lived presigned URL, null if no logo was uploaded (or storage isn't configured). */
  logoUrl: string | null;
  studentCount: number;
  classSectionCount: number;
  teacherCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolUpdateRequest {
  name: string;
  address?: string | null;
  city: string;
  state: string;
  pincode: string;
  contactEmail?: string | null;
  contactPhone: string;
  principalName: string;
  directorName?: string | null;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountHolderName?: string;
  upiVpaOverride?: string;
}

export interface SchoolLocationUpdateRequest {
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  /** Leave out to keep the school's current value. */
  allowUnverifiedSelfMark?: boolean;
}

export interface SchoolRegistrationRequest {
  name: string;
  city: string;
  state: string;
  pincode: string;
  principalName: string;
  /** The principal's mobile: the OTP login for the first ADMIN account. */
  principalPhone: string;
  /** From verifySignupOtp for that same mobile; the server requires it in production. Single use. */
  signupToken?: string;
  /** Everything below is optional - the in-app sign-up sends only the six fields above. */
  address?: string;
  contactEmail?: string;
  /** Defaults to principalPhone on the server. */
  contactPhone?: string;
  directorName?: string;
  /** A second, different phone creates a second ADMIN login (director/office). */
  adminPhone?: string;
  adminUsername?: string;
  adminPassword?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
}

export interface SignupOtpVerifyResponse {
  signupToken: string;
  expiresAt: string;
}

export interface SchoolSearchResult {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface SchoolRegistrationResponse {
  school: School;
  /** The ADMIN session on the principal's phone - the one the sign-up signs in with. */
  principal: LoginResponse;
  /** Null when the registration gave no second (admin) phone. */
  admin: LoginResponse | null;
}

export interface ClassSection {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  academicYear: string;
  displayLabel: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
}

export interface ClassSectionRequest {
  className: string;
  section: string;
  academicYear: string;
}

export interface Student {
  id: string;
  schoolId: string;
  rollNumber: string;
  /** Only populated for the ADMIN caller; null for anyone else (teacher, student, parent, unauthenticated). */
  registrationNumber: string | null;
  name: string;
  dob: string;
  gender: string;
  address: string;
  parentName: string;
  parentContact: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  classSectionLabel: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
  admissionDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRequest {
  name: string;
  dob: string;
  gender: string;
  address: string;
  parentName: string;
  parentContact: string;
  classSectionId: string;
  admissionDate: string;
  status?: string;
}

export interface StudentBulkImportRowResult {
  index: number;
  name: string;
  success: boolean;
  studentId: string | null;
  error: string | null;
}

export interface StudentBulkImportResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: StudentBulkImportRowResult[];
}

export interface StudentClassSectionUpdateRequest {
  classSectionId: string;
}

/**
 * A staff record. The backend shapes it per viewer and sends hidden fields as null: an admin or the
 * employee themself gets every field; a teacher viewing a colleague gets name, designation, phone
 * and email, with `role` set only when the colleague is an ADMIN; a student or parent gets only
 * id, name, designation and status.
 */
export interface Employee {
  id: string;
  schoolId: string;
  name: string;
  designation: string;
  joinDate: string | null;
  /** Optional - for the staff birthday wish. */
  dob: string | null;
  bankAccount: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  employeeType: EmployeeType | null;
  role: UserRole | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type EmployeeType = 'TEACHING' | 'NON_TEACHING';

export interface EmployeeRequest {
  name: string;
  designation: string;
  joinDate: string;
  /** Left out keeps the saved date of birth. */
  dob?: string;
  bankAccount?: string;
  contactPhone?: string;
  /** '' clears a saved email; left out keeps it. */
  contactEmail?: string;
  status?: string;
  /** Left out keeps the saved type (it can't be cleared once set). */
  employeeType?: EmployeeType;
}

export interface FeeCategory {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  /** False once retired: it can't go on a new fee structure line, but lines that have it keep working. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeCategoryRequest {
  /** The server trims and upper-cases it and turns spaces/hyphens into _ (" tuition fee " -> TUITION_FEE). */
  code: string;
  name: string;
}

/** The code never changes. `active` left out keeps it as it is. */
export interface FeeCategoryUpdateRequest {
  name: string;
  active?: boolean;
}

export interface FeeStructureLine {
  id: string;
  feeCategoryId: string;
  feeCategoryCode: string;
  feeCategoryName: string;
  amount: number;
}

export interface FeeStructureLineRequest {
  feeCategoryId: string;
  amount: number;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  classSectionId: string;
  className: string;
  section: string;
  /** Always the canonical "2026-27" form. */
  academicYear: string;
  lines: FeeStructureLine[];
  /** The due date chosen at the last Generate; null until bills are first generated. */
  dueDate: string | null;
  totalPerStudent: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureRequest {
  classSectionId: string;
  /** Left out: the server uses the class-section's own year (a different year is refused). */
  academicYear?: string;
  /** Amounts may be 0 (a fee this class doesn't charge). */
  lines: FeeStructureLineRequest[];
}

export interface FeeStructureUpdateRequest {
  lines: FeeStructureLineRequest[];
  /** Also re-price this structure's bills that have no payments and no adjustments. */
  repriceBills: boolean;
}

export type FeeBillLeftAloneReason = 'HAS_PAYMENTS' | 'HAS_ADJUSTMENTS' | 'NOT_REQUESTED';

export interface FeeBillLeftAlone {
  assessmentId: string;
  studentId: string;
  studentName: string;
  totalDue: number;
  reason: FeeBillLeftAloneReason;
}

export interface FeeStructureUpdateResult {
  structure: FeeStructure;
  repricedCount: number;
  leftAloneCount: number;
  /** At most 100 of the bills whose amount now differs from the structure's total. */
  leftAlone: FeeBillLeftAlone[];
}

export interface FeeBillDifferentTotal {
  assessmentId: string;
  studentId: string;
  studentName: string;
  totalDue: number;
}

/** What Generate would do, shown before the admin confirms. */
export interface GeneratePreview {
  structureId: string;
  academicYear: string;
  totalPerStudent: number;
  activeStudentCount: number;
  toCreateCount: number;
  alreadyBilledCount: number;
  alreadyBilledDifferentTotal: FeeBillDifferentTotal[];
  inactiveStudentCount: number;
  structureDueDate: string | null;
  suggestedDueDate: string;
}

export interface GenerateBillsResult {
  academicYear: string;
  dueDate: string;
  createdCount: number;
  alreadyBilledCount: number;
  inactiveSkippedCount: number;
  alreadyBilledDifferentTotal: FeeBillDifferentTotal[];
  created: FeeAssessment[];
}

/**
 * A bill's status, worked out by the server from its due date (India time) on every read: OVERDUE
 * as soon as the due date has passed with money still owed, without waiting for a payment.
 */
export type FeeBillStatus = 'UNPAID' | 'PARTIAL' | 'OVERDUE' | 'PAID' | 'CANCELLED';

export type FeeAdjustmentType = 'CONCESSION' | 'WAIVER' | 'LATE_FEE' | 'CORRECTION';

export interface FeeAdjustment {
  id: string;
  type: FeeAdjustmentType;
  /** Signed: a concession or waiver is negative, a late fee positive, a correction either. */
  amount: number;
  reason: string;
  /** Only sent to an admin; null for a student or parent. */
  createdByName: string | null;
  createdAt: string;
}

export interface FeeAdjustmentRequest {
  type: FeeAdjustmentType;
  amount: number;
  reason: string;
}

export interface FeeAssessment {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  /** ACTIVE, or ALUMNI / WITHDRAWN for a student who has left. */
  studentStatus: string;
  /** The student's current class-section. */
  classSectionId: string | null;
  classSectionLabel: string | null;
  academicYear: string;
  /** The structure's total when the bill was made; totalDue = baseAmount + adjustmentsTotal. */
  baseAmount: number;
  adjustmentsTotal: number;
  totalDue: number;
  totalPaid: number;
  /** 0 for a cancelled bill. */
  remainingDue: number;
  status: FeeBillStatus;
  overdue: boolean;
  /** Days past the due date while OVERDUE, else 0. */
  daysOverdue: number;
  dueDate: string | null;
  cancelled: boolean;
  cancelledAt: string | null;
  /** Only sent to an admin. */
  cancelledByName: string | null;
  cancelReason: string | null;
  /**
   * Oldest first, on a single bill, a student's bills and every bill a write returns. Null on paged
   * lists, class fee status, the dues report and generate results.
   */
  adjustments: FeeAdjustment[] | null;
  createdAt: string;
  updatedAt: string;
}

/** Filters for the admin's bill list and summary. Left out: the server's default. */
export interface FeeAssessmentFilters {
  status?: FeeBillStatus;
  classSectionId?: string;
  /** Default: the current academic year. 'ALL' for every year; "2026-27" or "2026-2027". */
  academicYear?: string;
  /** Name contains / roll number starts with, ignoring case. */
  q?: string;
  /** Default false: only ACTIVE students' bills. */
  includeInactive?: boolean;
}

/** Server totals over the non-cancelled bills matching the filters (cancelledCount aside). */
export interface FeeAssessmentSummary {
  /** The year the filters resolved to, or 'ALL'. */
  academicYear: string;
  classSectionId: string | null;
  includeInactive: boolean;
  billCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  cancelledCount: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalOverdue: number;
  /** Years with bills in the school, newest first. */
  availableAcademicYears: string[];
}

/** The backend's payment methods (finance PaymentMethod enum). */
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

/** POST /fee-payments (ADMIN). Send an Idempotency-Key header with it - see recordFeePayment. */
export interface FeePaymentRequest {
  assessmentId: string;
  /** Rupees, at most 2 decimals (more is a 400, never rounded). */
  amount: number;
  paymentMethod: PaymentMethod;
  /** UTR, cheque number or transaction ID. Required for everything but CASH. */
  paymentReference?: string;
  /** YYYY-MM-DD; the server defaults it to today in IST. No future dates, none over 400 days back. */
  transactionDate?: string;
  /** True to record it although the reference is already on another live payment (after a DUPLICATE_REFERENCE 409). */
  confirmDuplicateReference?: boolean;
}

export type ReversalType = 'CORRECTION' | 'BOUNCED' | 'REFUND';

/**
 * How and why a payment was reversed. The refund fields are null unless `type` is REFUND. The payment's
 * own ledger entry is never changed (it stays completed); a compensating entry is posted against it on
 * the day of the reversal - `reversalTransactionId`, for every type.
 */
export interface FeePaymentReversal {
  type: ReversalType;
  reason: string;
  reversedAt: string;
  reversedByName: string | null;
  refundMethod: PaymentMethod | null;
  refundReference: string | null;
  /** The day the refund was entered in the books (the day it was reversed, IST). */
  refundDate: string | null;
  refundTransactionId: string | null;
  /** The compensating ledger entry; may be missing from a server older than this field. */
  reversalTransactionId?: string | null;
}

/**
 * One fee payment, and everything its receipt shows. The same shape from record, get, both history
 * lists and reverse; `schoolLogoUrl` is filled only on single-payment responses (null in lists).
 */
export interface FeePayment {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  amount: number;
  transactionId: string;
  receiptNumber: string | null;
  studentName: string;
  rollNumber: string | null;
  /** The student's current class ("Grade 8 - A"), not the class at the time of payment. */
  classSectionLabel: string | null;
  /** The fee bill's academic year. */
  academicYear: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  transactionDate: string;
  /** Null for payments recorded before receipts kept who recorded them. */
  recordedByName: string | null;
  /** The bill's remaining due right after this payment; null for older payments. */
  balanceAfter: number | null;
  reversed: boolean;
  reversal: FeePaymentReversal | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /fee-payments/{id}/reverse (ADMIN). The refund fields are used only for a REFUND. */
export interface FeePaymentReversalRequest {
  type: ReversalType;
  /** At least 10 characters once trimmed, at most 500. */
  reason: string;
  refundMethod?: PaymentMethod;
  refundReference?: string;
  // No refund date: a refund is entered in the books on the day it's reversed, like every reversal.
}

/** The `data` of a 409 DUPLICATE_REFERENCE: the most recent live payment that has the same reference. */
export interface DuplicateReferenceData {
  existingPaymentId: string;
  existingReceiptNumber: string | null;
  existingStudentName: string;
  existingAmount: number;
  existingTransactionDate: string;
}

/** What Send reminder did for one bill. */
export interface FeeReminderResult {
  /** Family members newly reminded: the linked parents, or the student's own login when none is linked. */
  notifiedCount: number;
  /** They were all already reminded about this bill today, so nothing new went out. */
  alreadyRemindedToday: boolean;
}

/** Active students' open bills for one academic year (or 'ALL'); cancelled bills never count. */
export interface DuesReport {
  academicYear: string;
  unpaidAssessments: FeeAssessment[];
  totalUnpaid: number;
  unpaidCount: number;
  overdueAssessments: FeeAssessment[];
  totalOverdue: number;
  overdueCount: number;
  /** Open bills of students who have left (ALUMNI / WITHDRAWN), for the admin to cancel. */
  inactiveStudentsUnpaidCount: number;
  inactiveStudentsTotalUnpaid: number;
}

export interface PayrollRunSummary {
  /** The run to open. Missing from servers older than specs/payroll-runs. */
  runId?: string;
  month: number;
  year: number;
  status: string;
  employeeCount: number;
  totalNet: number;
}

export interface PayrollOverview {
  paidEmployeeCount: number;
  pendingEmployeeCount: number;
  paidAmount: number;
  pendingAmount: number;
  runs: PayrollRunSummary[];
}

export interface FeePaymentRequestResponse {
  assessmentId: string;
  studentName: string;
  amount: number;
  payeeName: string;
  /** Admin only; null for a student or parent. The UPI link doesn't use it. */
  accountNumber: string | null;
  /** Admin only; null for a student or parent. */
  ifsc: string | null;
  /** The school's configured UPI ID (never guessed). */
  payeeVpa: string;
  upiUri: string;
  referenceId: string;
  generatedAt: string;
}

export type PaymentAttemptStatus =
  | 'INITIATED'
  | 'RESPONSE_SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'VERIFIED';

export interface PaymentAttempt {
  id: string;
  assessmentId: string;
  transactionRef: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  upiTransactionId: string | null;
  approvalRefNo: string | null;
  responseCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The outcomes a payer may report for a payment attempt. VERIFIED is set only when an admin records
 * the payment, and INITIATED is the starting state, so the backend refuses both with a 400.
 */
export type PayerReportableStatus = 'RESPONSE_SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';

export interface PaymentAttemptResultRequest {
  status: PayerReportableStatus;
  upiTransactionId?: string;
  approvalRefNo?: string;
  responseCode?: string;
  rawResponse?: string;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  employeeName: string;
  basic: number;
  allowances: number;
  deductions: number;
  effectiveFrom: string;
  /** basic + allowances - deductions, worked out by the server. */
  net: number;
  /** The structure in force today for this employee. */
  current: boolean;
  /** False once salary was paid for a month on or after effectiveFrom's month: add a later one instead. */
  editable: boolean;
  createdAt: string;
}

/** POST and PUT /salary-structures. PUT is a full replace; null allowances or deductions mean 0. */
export interface SalaryStructureRequest {
  employeeId: string;
  basic: number;
  allowances?: number | null;
  deductions?: number | null;
  effectiveFrom: string;
}

/** PROCESSED: ready to pay. PARTIALLY_PAID: some lines paid, some held or added since. */
export type PayrollRunStatus = 'DRAFT' | 'PROCESSED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PayrollLineStatus = 'PAID' | 'PENDING' | 'ON_HOLD';
/** The backend's PaymentMethod enum. Salaries aren't paid by card. */
export type PayrollPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type PayrollLineWarningCode =
  | 'STRUCTURE_STARTS_MID_MONTH'
  | 'STRUCTURE_CHANGED_MID_MONTH'
  | 'JOINED_MID_MONTH'
  | 'JOINED_AFTER_MONTH'
  | 'NEGATIVE_COMPONENT';
export type PayrollSkipReason = 'NO_STRUCTURE' | 'STRUCTURE_STARTS_AFTER_MONTH' | 'NET_NOT_POSITIVE' | 'NOT_IN_RUN';

/** A month's run as listed (GET /payroll/runs). Held lines are unpaid and on hold; payable ones are unpaid and not. */
export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  lineCount: number;
  paidLineCount: number;
  heldLineCount: number;
  payableLineCount: number;
  totalNet: number;
  paidNet: number;
  heldNet: number;
  payableNet: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /payroll/runs/{id}, and what every run action returns. */
export interface PayrollRunDetail extends PayrollRun {
  /** Ordered by employee name. */
  lines: PayrollLine[];
  /** Active staff left out of the run and why, ordered by name. Empty for a cancelled run. */
  skipped: PayrollSkippedEmployee[];
  /** The earliest payment date: the run month's 1st. */
  paymentDateMin: string;
  /** The latest payment date: today in India. Before paymentDateMin for a future-month run. */
  paymentDateMax: string;
}

export interface PayrollLineWarning {
  code: PayrollLineWarningCode;
  date: string | null;
}

export interface PayrollLine {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string | null;
  /** Null on lines made before specs/payroll-runs. */
  basic: number | null;
  allowances: number | null;
  gross: number;
  deductions: number;
  net: number;
  status: PayrollLineStatus;
  held: boolean;
  paidOn: string | null;
  paymentMethod: PayrollPaymentMethod | null;
  paymentReference: string | null;
  warnings: PayrollLineWarning[];
}

export interface PayrollSkippedEmployee {
  employeeId: string;
  employeeName: string;
  designation: string | null;
  reason: PayrollSkipReason;
  /** STRUCTURE_STARTS_AFTER_MONTH: when their earliest structure starts. */
  date: string | null;
  /** NET_NOT_POSITIVE only. */
  net: number | null;
  /** STRUCTURE_STARTS_AFTER_MONTH and NET_NOT_POSITIVE: the structure to fix. */
  structureId: string | null;
}

export interface PayrollRunRequest {
  month: number;
  year: number;
}

/**
 * POST /payroll/runs/{id}/pay. transactionDate defaults to today in India. The expected* values are
 * what the confirmation showed: the server refuses with 409 PAYROLL_RUN_CHANGED when they no longer match.
 */
export interface PayrollPayRequest {
  paymentMethod: PayrollPaymentMethod;
  paymentReference?: string | null;
  transactionDate?: string | null;
  expectedPayableLineCount?: number | null;
  expectedPayableNet?: number | null;
}

/** GET /payroll/lines/{id}/payslip: any line, paid or not. */
export interface Payslip {
  payrollLineId: string;
  employeeId: string;
  employeeName: string;
  net: number;
  /** The payslip's reference once paid, else null. */
  documentRef: string | null;
  runId: string;
  month: number;
  year: number;
  runStatus: PayrollRunStatus;
  designation: string | null;
  basic: number | null;
  allowances: number | null;
  gross: number;
  deductions: number;
  status: PayrollLineStatus;
  paidOn: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  /** Null until paid, and on payslips issued before specs/payroll-runs. */
  payslipNumber: string | null;
}

export interface SalaryHistoryEntry {
  payrollLineId: string;
  month: number;
  year: number;
  net: number;
  runStatus: PayrollRunStatus;
  gross: number;
  deductions: number;
  status: PayrollLineStatus;
  paidOn: string | null;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface SubjectRequest {
  code: string;
  name: string;
  description?: string;
}

export interface SubjectAssignment {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
}

export interface TeacherSubjectAssignment {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

export interface SectionSubjectRequest {
  subjectId: string;
  teacherId: string;
}

export type AssessmentType = 'ASSIGNMENT' | 'QUIZ' | 'TEST' | 'EXAM';

export interface Assessment {
  id: string;
  schoolId: string;
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  type: AssessmentType;
  title: string;
  /** The subject and creator are null on old assessments saved without them. */
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  assessmentDate: string;
  maxMarks: number;
  description: string;
  createdByTeacherId: string | null;
  createdByTeacherName: string | null;
  term: string | null;
  /**
   * ACTIVE students in the section with a mark or Absent saved, and ACTIVE students in the section.
   * Only sent to ADMIN and TEACHER callers (null for STUDENT and PARENT), and missing from older servers.
   */
  marksEnteredCount?: number | null;
  marksExpectedCount?: number | null;
}

export interface CreateAssessmentRequest {
  title: string;
  type: AssessmentType;
  subjectId: string;
  assessmentDate: string;
  maxMarks: number;
  description?: string;
  /**
   * Who is recorded as the creator. Only an ADMIN can choose: the server ignores it from a TEACHER
   * (the creator is them). Older servers clear the creator when it's left out - see
   * utils/assessmentPermissions creatorTeacherId.
   */
  teacherId?: string;
  term?: string;
}

/** PUT /assessments/{id}: a field left out keeps its current value. `description: ""` clears it. */
export type UpdateAssessmentRequest = Partial<CreateAssessmentRequest>;

export interface AssessmentResultEntry {
  studentId: string;
  marksObtained?: number;
  absent: boolean;
  /**
   * Left out of both marks obtained and max marks on the report card. Only sent to a server that
   * sends it back (see utils/assessmentResults supportsExcused): left out, the server keeps what's saved.
   */
  excused?: boolean;
  remarks?: string;
}

export interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marksObtained: number | null;
  absent: boolean;
  /** Missing from older servers, which have no Excused. */
  excused?: boolean;
  remarks: string | null;
}

export interface AssessmentResults {
  assessmentId: string;
  assessmentTitle: string;
  maxMarks: number;
  results: StudentResult[];
  /** Missing from older servers. */
  term?: string | null;
  /** True when the term's report cards are published, so marks can't be saved. Missing from older servers. */
  locked?: boolean;
  /**
   * Results saved for students who have since moved to another class: they can only be cleared
   * here. Missing from older servers.
   */
  movedStudents?: StudentResult[];
}

export interface GradingBand {
  id: string | null;
  minPercentage: number;
  maxPercentage: number;
  label: string;
}

export type ReportCardAssessmentStatus = 'MARKED' | 'ABSENT' | 'EXCUSED' | 'MISSING';

/** One assessment of a subject in the card's section and term. */
export interface ReportCardAssessment {
  assessmentId: string;
  title: string;
  type: AssessmentType;
  assessmentDate: string;
  maxMarks: number;
  /** Only when MARKED. */
  marksObtained: number | null;
  status: ReportCardAssessmentStatus;
  /** Trimmed; null when blank. Can be set for any status, including MISSING. */
  remarks: string | null;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  /** Over marked and absent results: an excused one is left out of both sums. */
  maxMarks: number;
  marksObtained: number;
  /** Null only when every result in the subject is excused (never on older servers). */
  percentage: number | null;
  grade: string | null;
  /** Missing from older servers: read as 0. */
  absentCount?: number;
  excusedCount?: number;
  /** By date, then title. Missing from older servers: the per-assessment list is hidden. */
  assessments?: ReportCardAssessment[];
  /**
   * Mean percentage across classmates with a result in this subject. Null when this student is
   * the only one, and missing from older servers - either way, no comparison is shown.
   */
  classAveragePercentage?: number | null;
  /** This student minus the class mean, in percentage points. Null alongside a null average. */
  deltaFromClassAverage?: number | null;
}

/** TERM: just the term's dates (attendanceFrom/To). TO_DATE: every record so far. */
export type AttendanceBasis = 'TERM' | 'TO_DATE';

export interface ReportCard {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  academicYear: string;
  term: string;
  subjects: SubjectResult[];
  totalMaxMarks: number;
  totalMarksObtained: number;
  /** Null when the student has no marks for the term (none entered, none marked absent). */
  overallPercentage: number | null;
  overallGrade: string | null;
  /** Assessments in this term with no mark for the student (blank and not marked absent). */
  missingMarksCount: number;
  attendancePercentage: number | null;
  /** Class mean overall percentage. Null with no classmates; missing from older servers. */
  classAveragePercentage?: number | null;
  published: boolean;
  publishedAt: string | null;
  // Missing from older servers.
  /** The section the card is worked out for - an earlier class after promotion or transfer. */
  classSectionId?: string;
  /** The student's current section isn't the card's section. */
  movedOut?: boolean;
  /** Missing reads as TO_DATE. */
  attendanceBasis?: AttendanceBasis;
  attendanceFrom?: string | null;
  attendanceTo?: string | null;
  /** True when this is the card as it was saved at publish (what students and parents see). */
  frozen?: boolean;
}

export interface ReportCardPublication {
  classSectionId: string;
  term: string;
  publishedAt: string;
  publishedByEmployeeName: string;
  /** Students with a snapshot for this publication after the call. Missing from older servers. */
  frozenCardCount?: number;
}

/** POST /class-sections/{id}/report-cards/unpublish */
export interface ReportCardUnpublish {
  classSectionId: string;
  term: string;
  unpublishedAt: string;
  unpublishedByName: string;
  reason: string;
  discardedSnapshotCount: number;
}

/** GET /class-sections/{id}/report-cards/publish-check - what publishing this term would do. */
export interface ReportCardPublishCheck {
  /** The section's own spelling of the term. */
  term: string;
  assessmentCount: number;
  /** Assessments in the section with no term, which no report card includes. */
  untermedAssessmentCount: number;
  studentCount: number;
  studentsWithMissingMarks: number;
  missingMarksCount: number;
  alreadyPublished: boolean;
  publishedAt: string | null;
  /** The latest unpublish of this section and term. Missing from older servers. */
  lastUnpublishedAt?: string | null;
  lastUnpublishedByName?: string | null;
  lastUnpublishReason?: string | null;
}

export interface PublishedTerm {
  term: string;
  publishedAt: string;
  // Missing from older servers, which list only the current section's publications.
  classSectionId?: string;
  className?: string;
  section?: string;
  academicYear?: string;
  /** This is the student's current section. */
  current?: boolean;
  /** From the school's listed term matching ignoring case. */
  startDate?: string | null;
  endDate?: string | null;
}

export interface TermSummary {
  term: string;
  published: boolean;
  // Missing from older servers.
  publishedAt?: string | null;
  /** From the school's listed term matching ignoring case. */
  startDate?: string | null;
  endDate?: string | null;
  inTermList?: boolean;
}

/** One of the school's terms (GET /academic-terms). */
export interface AcademicTerm {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  /** Free text, e.g. "2026-27". */
  academicYear: string | null;
  /** Null for students and parents. */
  assessmentCount: number | null;
  publishedSectionCount: number | null;
}

/** POST and PUT /academic-terms. PUT is a full replace: a null date or year clears it. */
export interface AcademicTermRequest {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  academicYear?: string | null;
}

/** A term the school's assessments already use that isn't on its list. */
export interface UnlistedTerm {
  term: string;
  assessmentCount: number;
}

export interface BackfillTermResult {
  assessmentsUpdated: number;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

export interface AttendanceEntryRequest {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface BulkAttendanceRequest {
  date: string;
  teacherId: string;
  records: AttendanceEntryRequest[];
}

export type AttendanceMethod = 'RFID' | 'FINGERPRINT' | 'FACE';

export interface StudentAttendanceEntry {
  studentId: string;
  rollNumber: string;
  studentName: string;
  status: AttendanceStatus;
  remarks: string;
  method: AttendanceMethod | null;
}

export interface SectionAttendance {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  date: string;
  entries: StudentAttendanceEntry[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  sectionId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  markedByTeacherId: string | null;
  markedByTeacherName: string | null;
  remarks: string;
  method: AttendanceMethod | null;
}

export interface StudentAttendanceHistory {
  studentId: string;
  studentName: string;
  rollNumber: string;
  from: string;
  to: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  records: AttendanceRecord[];
}

export interface SectionStudentAttendanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
}

export interface SectionAttendanceHistory {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  from: string | null;
  to: string | null;
  students: SectionStudentAttendanceSummary[];
}

export interface StaffAttendanceEntryRequest {
  employeeId: string;
  status: AttendanceStatus;
  remarks?: string;
}

/** An admin marking (or correcting) staff attendance for one day; re-sending a day overwrites it. */
export interface BulkStaffAttendanceRequest {
  date: string;
  /** Defaults to the logged-in admin when left out. */
  markedByEmployeeId?: string;
  records: StaffAttendanceEntryRequest[];
}

export interface SelfMarkAttendanceRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  /** True when Android reports the fix came from a mock-location app; the server refuses it. */
  mocked?: boolean;
  /** When the device took the fix, epoch ms; the server refuses stale fixes. */
  fixTimestamp?: number;
  /** Developer options / root / cloner-app checks from the native module; the server refuses any that are true. */
  deviceChecks?: {
    developerOptionsEnabled: boolean;
    rooted: boolean;
    appCloned: boolean;
  };
  /** The server treats a missing platform as Android (older builds don't send it). */
  platform?: 'android' | 'ios';
  /** Android: Play Integrity token requested with `integrityNonce`; required when the server enforces it. */
  integrityToken?: string;
  integrityNonce?: string;
  /** REPORT mode only: why this phone couldn't get a token (ERR_INTEGRITY_* code), so it isn't logged as an old build. */
  integrityClientError?: string;
}

/** How the server treats Play Integrity on Android self check-in: ignored, logged only, or required. */
export type IntegrityMode = 'OFF' | 'REPORT' | 'ENFORCE';

/** A single-use nonce for one self check-in; a newer one replaces it. */
export interface SelfMarkNonce {
  nonce: string;
  expiresAt: string;
  integrityMode: IntegrityMode;
}

export interface StaffAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  markedByEmployeeId: string | null;
  markedByEmployeeName: string | null;
  remarks: string | null;
  selfMarked: boolean;
  method: AttendanceMethod | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAttendanceEntry {
  employeeId: string;
  employeeName: string;
  designation: string;
  status: AttendanceStatus | null;
  remarks: string | null;
  selfMarked: boolean;
  method: AttendanceMethod | null;
}

export interface StaffAttendanceRoster {
  date: string;
  entries: StaffAttendanceEntry[];
}

export interface EmployeeAttendanceHistory {
  employeeId: string;
  employeeName: string;
  from: string | null;
  to: string | null;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  records: StaffAttendanceRecord[];
}

export interface PagedResponse<T> {
  content: T[];
  hasNext: boolean;
  totalElements: number;
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'DRIVER';
export type OwnerType = 'EMPLOYEE' | 'STUDENT' | 'PARENT';

export interface AttendanceDevice {
  id: string;
  name: string;
  deviceType: AttendanceMethod;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AttendanceDeviceKey {
  id: string;
  name: string;
  deviceType: AttendanceMethod;
  /** Only ever present in the create/rotate-key response - never shown again after that. */
  apiKey: string;
}

export interface AttendanceIdentifier {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  method: AttendanceMethod;
  externalId: string;
  active: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  ownerType: OwnerType;
  ownerId: string;
  role: UserRole;
  schoolId: string;
  username: string;
  // Absent on sessions saved by app builds from before refresh tokens existed - those keep working
  // until their access token's first 401, then send the user to login once.
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

export interface RegistrationSubmittedResponse {
  entityId: string;
  message: string;
}

// Claim-by-reference-key model: admin already created the underlying record (student at
// enrollment, employee at hiring) - self-registration just proves who you are with a reference
// key and sets credentials, instead of re-entering data admin already has on file. The exact
// field name/format for each reference key is pending confirmation from backend - update here
// once known, screens just bind to these types.
export interface RegisterStudentRequest {
  registrationNumber: string;
  username: string;
  password: string;
}

export type RegisterStudentGoogleRequest = Omit<RegisterStudentRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface StudentInviteResponse {
  code: string;
  expiresAt: string;
}

export interface RegisterStudentInviteRequest {
  inviteCode: string;
  username: string;
  password: string;
}

export type RegisterStudentInviteGoogleRequest = Omit<RegisterStudentInviteRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface TeacherInviteResponse {
  code: string;
  expiresAt: string;
}

export interface RegisterTeacherRequest {
  inviteCode: string;
  username: string;
  password: string;
}

export type RegisterTeacherGoogleRequest = Omit<RegisterTeacherRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface RegisterParentRequest {
  studentRegistrationNumber: string;
  parentContact: string;
  username: string;
  password: string;
}

export type RegisterParentGoogleRequest = Omit<RegisterParentRequest, 'username' | 'password'> & {
  idToken: string;
};

export type RegistrationEntityType = 'STUDENT_REGISTRATION' | 'EMPLOYEE_REGISTRATION' | 'PARENT_REGISTRATION';

export interface RegistrationInboxEntry {
  entityId: string;
  entityType: RegistrationEntityType;
  displayName: string;
  submittedBy: string;
  submittedAt: string;
}

export interface RegistrationDecisionRequest {
  comment?: string;
}

export interface LinkChildRequest {
  studentRegistrationNumber: string;
}

export interface OtpRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}

// Public (schoolless) student self-signup at the virtual Open School. An unknown phone creates a
// student at the chosen grade; a known one just logs in. See the backend /auth/public/* endpoints.
export interface PublicSignupRequest {
  phone: string;
  otp: string;
  name: string;
  grade: number;
}

export interface ChangeClassRequest {
  grade: number;
}

// A phone number shared by siblings (or a teacher who is also a parent) resolves to more than one
// profile - verify/select-profile/switch all use this same shape so the UI can render one card
// component across the pre-login picker and the post-login "switch child" screen.
export type AuthProfileOwnerType = 'STUDENT' | 'EMPLOYEE';
export type AuthProfileRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'DRIVER';
export type AuthProfileStatus = 'ACTIVE' | 'ALUMNI' | 'WITHDRAWN';

export interface AuthProfile {
  ownerType: AuthProfileOwnerType;
  ownerId: string;
  name: string;
  role: AuthProfileRole;
  className: string | null;
  section: string | null;
  rollNumber: string | null;
  status: AuthProfileStatus | null;
  current: boolean;
}

// `token` and the other login fields are only meaningful when profileSelectionRequired is false -
// otherwise they're a login for profiles[0], kept only so an app build without the picker still
// works (see PR #110 on the backend).
export interface OtpVerifyResponse extends LoginResponse {
  profileSelectionRequired: boolean;
  selectionToken?: string;
  profiles?: AuthProfile[];
}

export interface SelectProfileRequest {
  selectionToken: string;
  ownerType: AuthProfileOwnerType;
  ownerId: string;
}

export interface SwitchProfileRequest {
  ownerType: AuthProfileOwnerType;
  ownerId: string;
  refreshToken?: string;
}

export interface CredentialRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface Credential {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  username: string;
  role: UserRole;
}

export type ConversationType = 'STAFF_STAFF' | 'STAFF_STUDENT' | 'PARENT_STAFF' | 'BOT';

export interface ConversationParticipant {
  ownerType: OwnerType;
  ownerId: string;
  /** Resolved by the backend; null if that person no longer exists. */
  name?: string | null;
}

/** Someone the caller may start a parent-staff chat with (GET /api/v1/chat/contacts). */
export interface ChatContact {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  /** Staff contact: a school admin. */
  admin: boolean;
  /** Staff contact: sections (e.g. "5 - A") they are class teacher of, among the parent's children's. */
  classTeacherOf: string[];
  /** Staff contact: "Subject (section)" they teach the parent's children. */
  subjects: string[];
  /** Parent contact: "Child (section)" for each of their children the caller teaches. */
  children: string[];
}

/** One inbox entry - a copy of a push the caller was sent (GET /api/v1/notifications). */
export interface AppNotification {
  id: string;
  /** The push's data.type, e.g. ABSENCE_ALERT, FEE_DUE, ANNOUNCEMENT, NEW_MESSAGE. */
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  hasMore: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
}

export interface CreateConversationRequest {
  otherPartyOwnerType: OwnerType;
  otherPartyOwnerId: string;
}

/** The server sends HUMAN for a person's message and BOT for the helpdesk bot's. */
export type SenderKind = 'HUMAN' | 'BOT';

/** Effective status of a helpdesk-bot proposal: a PENDING one past its expiry is sent as EXPIRED. */
export type BotActionStatus = 'PENDING' | 'EXECUTED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'SUPERSEDED';
export type BotActionItemKind = 'SUBSTITUTE' | 'CANCEL' | 'EXTRA' | 'UNDO' | 'SET' | 'CLEAR';

/** One period as a card shows it, before or after a proposed change. Strings are server-cleaned. */
export interface BotCellState {
  subjectName: string | null;
  teacherName: string | null;
  /** Set only when another employee shares this teacher's name: their designation and classes. */
  teacherDetail: string | null;
  /** Set only on `after` of SUBSTITUTE and EXTRA; false means "no app login - won't be notified". */
  teacherHasLogin: boolean | null;
  roomName: string | null;
}

/** One change of a bot proposal, in execution order. Built by the server from validated data. */
export interface BotActionItem {
  index: number;
  kind: BotActionItemKind | string;
  /** A SUBSTITUTE or EXTRA that updates the change already on that period. */
  replacesExisting: boolean;
  /** UNDO only: the kind being undone (SUBSTITUTE, CANCELLED or EXTRA). */
  undoesKind: string | null;
  /** YYYY-MM-DD for the dated kinds; null for SET and CLEAR. */
  date: string | null;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  periodLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  /** "Grade 7 - A", with the year added when the school has two sections with that label. */
  classLabel: string;
  /** A dated change for a period that is already over today. */
  periodEnded: boolean;
  before: BotCellState | null;
  after: BotCellState | null;
  regularTeacherName: string | null;
  /** SET only: the teacher also gets assigned to the class, which gives them access to it. */
  assignsTeacher: boolean;
  /** One English sentence from the server - the fallback for anything the app can't format. */
  summary: string;
}

/** A proposal the helpdesk bot made for an admin to confirm (the card under a bot message). */
export interface BotAction {
  id: string;
  messageId: string;
  conversationId: string;
  code: string;
  type: string;
  status: BotActionStatus | string;
  changeCount: number;
  /** English, e.g. "3 timetable changes"; the app shows its own translated title. */
  title: string;
  items: BotActionItem[];
  /** Written by the bot, cleaned by the server, and shown to the teachers involved. */
  reason: string | null;
  requestedByOwnerType: OwnerType;
  requestedByOwnerId: string;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  /** The exact plain-text suffix the server appended to the message's content, for older apps. */
  footer: string;
  /** Grows on every stored change; the higher one wins when frames race. */
  version: number;
  /** The server clock when this was sent, to correct the phone's clock for the countdown. */
  serverTime: string;
}

export interface Message {
  id: string;
  senderKind: SenderKind;
  senderOwnerType: OwnerType | null;
  senderOwnerId: string | null;
  content: string | null;
  sentAt: string;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  attachmentFileName: string | null;
  /**
   * A bot proposal's card. A server with bot actions always sends this key (null when there is no
   * card); an older server leaves it out, which is how the app knows not to subscribe to updates.
   */
  action?: BotAction | null;
  /**
   * Set only on the live broadcast of a helpdesk-bot guard reply (a refusal, a pause, a limit...).
   * REST history always has null (it isn't stored), and older servers leave the key out.
   */
  aiNotice?: AiNotice | null;
}

/**
 * Why a fixed AI guard reply was sent instead of an answer. Unknown kinds from a newer server are
 * treated like 'REFUSED' (see noticeKind in src/utils/aiGuard.ts).
 */
export type AiNoticeKind = 'REFUSED' | 'PAUSED' | 'SCHOOL_LIMIT' | 'USER_LIMIT' | 'TOO_LONG' | 'CHECK_FAILED' | 'OFF';

/**
 * `pausedUntil` non-null means the user's AI help is now paused until then: the reply that starts a
 * pause (the 5th refused message) has kind 'PAUSED' and carries it, so the app locks the composer
 * on that reply itself rather than on the next send.
 */
export interface AiNotice {
  kind: AiNoticeKind;
  pausedUntil: string | null;
}

/** BOT = the helpdesk bot, ASSISTANT = the Academic Helper. */
export type AiFeature = 'BOT' | 'ASSISTANT';

/** Why the AI guard refused a message. MODEL_REFUSAL: the model's own safety check (cyber/bio). */
export type AiVerdict = 'OFF_TOPIC' | 'OTHERS_DATA' | 'PROMPT_ATTACK' | 'UNSAFE' | 'MODEL_REFUSAL';

/** A frame on /topic/conversations/{id}/updates. Unknown types are ignored. */
export interface ChatUpdateFrame {
  type: 'MESSAGE_UPDATED' | string;
  message: Message;
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface PresignChatAttachmentRequest {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface PresignChatAttachmentResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export type AnnouncementScope = 'SCHOOL' | 'CLASS' | 'GRADE';

export interface Announcement {
  id: string;
  scope: AnnouncementScope;
  sectionId: string | null;
  className: string | null;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  scope: AnnouncementScope;
  sectionId?: string;
  className?: string;
  title: string;
  body: string;
}

export interface GameProfileResponse {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'GURUKUL_MASTER';

export interface LeaderboardEntryResponse {
  rank: number;
  studentId: string;
  name: string;
  weeklyXp: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  tier: LeagueTier;
  classSectionLabel: string;
  entries: LeaderboardEntryResponse[];
  yourRank: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface HouseResponse {
  id: string;
  name: string;
  colorHex: string;
}

export interface CreateHouseRequest {
  name: string;
  colorHex: string;
}

export interface AwardSpotRecognitionRequest {
  studentId: string;
  amount: number;
  reason: string;
}

export interface HouseStandingResponse {
  houseId: string;
  name: string;
  colorHex: string;
  totalPoints: number;
  memberCount: number;
}

export interface SpotRecognitionFeedItem {
  studentName: string;
  houseName: string;
  amount: number;
  reason: string;
  occurredAt: string;
}

export interface HouseWarsResponse {
  standings: HouseStandingResponse[];
  recentFeed: SpotRecognitionFeedItem[];
  yourHouseId: string | null;
}

export type QuizOption = 'A' | 'B' | 'C' | 'D';
export type ChallengeStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface CreateQuizQuestionRequest {
  subjectId: string;
  className: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOption;
  /** Why the answer is right; students see it only in the review after they answer. Max 1000. */
  explanation?: string;
}

/** Question-bank answer kinds. Only MCQ is used by Arena games; NUMERIC/SHORT_WORD are marked automatically. */
export type QuizQuestionType = 'MCQ' | 'NUMERIC' | 'SHORT_WORD';

/** Where a bank question came from: typed by staff, or saved from the AI quiz generator. */
export type QuizQuestionSource = 'MANUAL' | 'AI';

/**
 * The staff view of a bank question, answer key included. The optional fields are absent from
 * servers older than the question-bank-and-games change - treat them as empty / false.
 */
export interface QuizQuestionResponse {
  id: string;
  subjectId?: string;
  subjectName?: string;
  className: string;
  questionText: string;
  /** Options and correctOption are null for NUMERIC / SHORT_WORD questions. */
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: QuizOption | null;
  createdByEmployeeId: string;
  createdByEmployeeName: string;
  /** Absent from older servers - treat as MCQ. */
  questionType?: QuizQuestionType;
  answerText?: string | null;
  explanation?: string | null;
  source?: QuizQuestionSource;
  /** Retired questions are never drawn into new games; Restore brings them back. */
  retired?: boolean;
  /** Distinct students with an open "wrong answer" report on this question. */
  openReportCount?: number;
  /** Up to 5 newest non-blank comments from open reports, newest first, without student names. */
  openReportComments?: string[];
  /** The caller is an ADMIN or wrote this question, so may edit, retire, restore and dismiss reports. */
  canEdit?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Edits a saved question - a full replacement of these fields. Subject, grade, type and source
 * can't change, and fields that don't fit the stored type are ignored. A null or blank explanation
 * clears it.
 */
export interface UpdateQuizQuestionRequest {
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: QuizOption;
  answerText?: string;
  explanation?: string | null;
}

/** `alreadyReported` is true when this student already had an open report on the question. */
export interface QuizQuestionReportResponse {
  questionId: string;
  alreadyReported: boolean;
}

/** One question of a finished Arena challenge or Practice session, with the answer key revealed. */
export interface QuizReviewItem {
  questionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOption;
  explanation: string | null;
  /** Null when the student didn't answer it. */
  selectedOption: QuizOption | null;
  correct: boolean;
  /**
   * Why each option is right or wrong. Practice review only, and null there too until the
   * question's four have been written - ask for them with explainPracticeQuestion.
   */
  rationales?: OptionRationales | null;
}

/** One line per option saying why it is right or wrong. All four arrive together or not at all. */
export interface OptionRationales {
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface BankQuestionInput {
  questionType: QuizQuestionType;
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: QuizOption;
  answerText?: string;
  explanation?: string;
}

export interface BulkCreateQuizQuestionsRequest {
  subjectId: string;
  className: string;
  /** Applies to the whole batch; the server defaults it to MANUAL. */
  source?: QuizQuestionSource;
  questions: BankQuestionInput[];
}

export interface PublicQuizQuestionResponse {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface CreateChallengeRequest {
  opponentStudentId: string;
  subjectId: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  selectedOption: QuizOption;
}

/** Right or wrong only - the correct option is revealed in the review once the challenge ends. */
export interface SubmitAnswerResponse {
  correct: boolean;
  challengeCompleted: boolean;
}

export interface ChallengeSummaryResponse {
  id: string;
  subjectName: string;
  opponentName: string;
  /** The effective status: an ACTIVE challenge past expiresAt is reported as EXPIRED. */
  status: ChallengeStatus;
  totalQuestions: number;
  myAnsweredCount: number;
  opponentAnsweredCount: number;
  youWon: boolean | null;
  draw: boolean;
  /** When answers stop being accepted (created + the server's challenge-expiry-hours). */
  expiresAt?: string;
  /** XP the winner got: 0 for a draw, an expired or active challenge, or once the pair's daily limit is reached. */
  xpAwarded?: number;
  /** True only for a COMPLETED challenge with a winner that gave no XP because the pair hit today's limit. */
  xpLimitReached?: boolean;
}

export interface ChallengeDetailResponse {
  summary: ChallengeSummaryResponse;
  questions: PublicQuizQuestionResponse[];
  myAnsweredQuestionIds: string[];
  /** Null while ACTIVE; one item per question, from the caller's own answers, once COMPLETED or EXPIRED. */
  review?: QuizReviewItem[] | null;
}

export type PracticeSessionStatus = 'ACTIVE' | 'COMPLETED';

export interface CreatePracticeSessionRequest {
  subjectId: string;
}

export interface PracticeSessionResponse {
  id: string;
  subjectName: string;
  status: PracticeSessionStatus;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  questions: PublicQuizQuestionResponse[];
  myAnsweredQuestionIds: string[];
  /** Null while ACTIVE; filled once the session is COMPLETED. */
  review?: QuizReviewItem[] | null;
}

export interface ChapterBreakdown {
  chapterId: string;
  chapterNumber: number;
  /** "12. Friction" */
  chapterLabel: string;
  answered: number;
  correct: number;
  percentCorrect: number;
  /**
   * Too few answers here to read anything into the percentage - show the count, not a verdict.
   * Two questions make 50% out of a single slip.
   */
  lowConfidence: boolean;
}

export interface MissedQuestion {
  questionId: string;
  questionText: string;
  chapterLabel: string | null;
  selectedAnswer: string | null;
  correctAnswer: string | null;
}

export interface PracticeAnalysis {
  sessionId: string;
  subjectName: string;
  completed: boolean;
  answered: number;
  correct: number;
  percentCorrect: number;
  /** Every chapter answered in, strongest first. */
  chapters: ChapterBreakdown[];
  strengths: ChapterBreakdown[];
  focusAreas: ChapterBreakdown[];
  missedQuestions: MissedQuestion[];
  /** Answered questions with no chapter: counted in the score, absent from the breakdown. */
  untaggedAnswered: number;
}

export interface RoadmapStep {
  order: number;
  chapterId: string;
  chapterNumber: number;
  chapterLabel: string;
  /** Null when the student has not been tested on this chapter yet. */
  percentCorrect: number | null;
  reason: string;
  /** Groundwork for a later chapter the student is finding hard. */
  prerequisite: boolean;
}

export interface StudyNote {
  chapterId: string;
  chapterLabel: string;
  guidance: string;
  suggestedActions: string[];
}

export interface PracticeStudyPlan {
  sessionId: string;
  subjectName: string;
  roadmap: RoadmapStep[];
  /** Empty when the AI assistant is unavailable; the roadmap above still stands. */
  studyNotes: StudyNote[];
  /** Why the notes are missing, when they are. Null when everything is present. */
  notesUnavailableReason: string | null;
}

export interface SubmitPracticeAnswerRequest {
  questionId: string;
  selectedOption: QuizOption;
}

/** Right or wrong only - the correct options are revealed in the review once the session ends. */
export interface SubmitPracticeAnswerResponse {
  correct: boolean;
  sessionCompleted: boolean;
}

export type BattleRoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface BattleRoomParticipant {
  studentId: string;
  name: string;
  /** Total score: each correct answer earns 1-10 by speed, wrong answers 0. */
  points: number;
  correctCount: number;
  /** Whether they've locked in an answer to currentQuestion - never whether it's right. */
  answeredCurrentQuestion: boolean;
}

export interface BattleRoomQuestion {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

/** One participant's outcome on a closed question. `selectedOption`/`responseMs` are null when they didn't answer in time. */
export interface BattlePlayerResult {
  studentId: string;
  name: string;
  answered: boolean;
  selectedOption: QuizOption | null;
  correct: boolean;
  points: number;
  responseMs: number | null;
}

/** Revealed once a question closes, for every participant - never sent for the question still in play. */
export interface BattleQuestionResult {
  questionIndex: number;
  questionId: string;
  correctOption: QuizOption;
  /** Why the correct option is right, when the question has an explanation. */
  explanation?: string | null;
  /** One row per participant, fastest correct answer first. */
  results: BattlePlayerResult[];
}

export interface BattleRoomState {
  id: string;
  roomCode: string;
  className: string;
  subjectName: string;
  status: BattleRoomStatus;
  minPlayers: number;
  maxPlayers: number;
  joinWindowSeconds: number;
  joinWindowEndsAt: string;
  questionCount: number;
  currentQuestionIndex: number;
  /** Ordered by points, highest first. */
  participants: BattleRoomParticipant[];
  currentQuestion: BattleRoomQuestion | null;
  /**
   * When answering opens for currentQuestion. While this is in the future (the reveal pause after
   * the previous question), hide currentQuestion, show lastResult, and count down to this instead -
   * the server rejects answers until then.
   */
  currentQuestionStartsAt: string | null;
  /** When answering closes for currentQuestion - the question closes earlier if everyone answers. */
  currentQuestionEndsAt: string | null;
  lastResult: BattleQuestionResult | null;
  /** Null on a draw, and until the room is COMPLETED. */
  winnerStudentId: string | null;
  winnerName: string | null;
  /** True when the room is COMPLETED with no winner: a level tie, or nobody scored. */
  draw?: boolean;
}

export interface BattleRoomSummary {
  id: string;
  roomCode: string;
  subjectName: string;
  className: string;
  status: 'WAITING' | 'ACTIVE';
  participantCount: number;
  maxPlayers: number;
}

export interface CreateBattleRoomRequest {
  subjectId: string;
}

export interface SubmitBattleAnswerRequest {
  selectedOption: QuizOption;
}

export type CallStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type RsvpStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type CallOutcome = 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'DECLINED' | 'BUSY' | 'CANCELLED';

export interface ScheduleCallRequest {
  title: string;
  inviteeOwnerType: OwnerType;
  inviteeOwnerIds: string[];
  scheduledAt: string;
}

export interface RsvpRequest {
  status: RsvpStatus;
}

export interface StartImmediateCallRequest {
  calleeOwnerType: OwnerType;
  calleeOwnerId: string;
}

export interface CallInviteeResponse {
  ownerType: OwnerType;
  ownerId: string;
  rsvpStatus: RsvpStatus;
}

export type CallProvider = 'JITSI' | 'GOOGLE_MEET';

export interface GoogleMeetStatusResponse {
  connected: boolean;
  googleEmail: string | null;
}

export interface ScheduledCallResponse {
  id: string;
  title: string;
  hostOwnerType: OwnerType;
  hostOwnerId: string;
  scheduledAt: string;
  roomName: string;
  provider: CallProvider;
  status: CallStatus;
  invitees: CallInviteeResponse[];
}

export interface MyInviteResponse {
  scheduledCallId: string;
  title: string;
  hostOwnerType: OwnerType;
  hostOwnerId: string;
  scheduledAt: string;
  status: CallStatus;
  myRsvpStatus: RsvpStatus;
}

export interface CallSessionResponse {
  callLogId: string;
  roomName: string;
  provider: CallProvider;
  outcome: CallOutcome;
}

export interface CallLogResponse {
  id: string;
  scheduledCallId: string | null;
  callerOwnerType: OwnerType;
  callerOwnerId: string;
  calleeOwnerType: OwnerType | null;
  calleeOwnerId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: CallOutcome;
}

export type CallEventType =
  | 'INCOMING_CALL'
  | 'CALL_ACCEPTED'
  | 'CALL_DECLINED'
  | 'CALL_BUSY'
  | 'CALL_MISSED'
  | 'CALL_CANCELLED'
  | 'CALL_ENDED'
  | 'SCHEDULED_CALL_STARTED'
  | 'SCHEDULED_CALL_REMINDER';

export interface CallEvent {
  type: CallEventType;
  callLogId: string | null;
  scheduledCallId: string | null;
  roomName: string | null;
  provider: CallProvider | null;
  counterpartOwnerType: OwnerType | null;
  counterpartOwnerId: string | null;
  title: string | null;
  scheduledAt: string | null;
}

export type EventCategory = 'SPORTS' | 'CULTURAL' | 'ACADEMIC' | 'OTHER';
export type EventScope = 'SCHOOL' | 'CLASS' | 'GRADE';
// Old finance lifecycle - unrelated to participation, kept separate per backend's note.
export type EventFinanceStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type EventParticipationStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type EventParticipationType = 'RSVP' | 'REGISTRATION' | 'POLL' | 'NONE';
export type EventRsvpStatus = 'ACCEPTED' | 'DECLINED' | 'MAYBE';

export interface EventRegistrationField {
  key: string;
  label: string;
  required: boolean;
}

export interface SchoolEvent {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  eventDate: string;
  status: EventFinanceStatus;
  inflowEnabled: boolean;
  outflowEnabled: boolean;
  category: EventCategory | null;
  scope: EventScope | null;
  sectionId: string | null;
  className: string | null;
  venue: string | null;
  startAt: string | null;
  endAt: string | null;
  participationStatus: EventParticipationStatus | null;
  participationType: EventParticipationType | null;
  registrationFields: EventRegistrationField[] | null;
  myRsvpStatus: EventRsvpStatus | null;
  myRegistrationAnswers: Record<string, string> | null;
  createdByEmployeeId: string;
  createdByEmployeeName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  name: string;
  description: string;
  eventDate: string;
  category?: EventCategory;
  scope?: EventScope;
  sectionId?: string;
  className?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  participationType?: EventParticipationType;
  registrationFields?: EventRegistrationField[];
}

export interface EventRsvpRequest {
  status: EventRsvpStatus;
}

export interface EventRsvpEntry {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  status: EventRsvpStatus;
}

export interface EventRegistrationRequest {
  answers: Record<string, string>;
}

export interface EventRegistrationEntry {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  answers: Record<string, string>;
  submittedAt: string;
}

export interface CreateEventPollOptionsRequest {
  options: string[];
}

export interface EventPollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface EventPollResponse {
  options: EventPollOption[];
  myVoteOptionId: string | null;
}

export interface EventPollVoteRequest {
  optionId: string;
}

export interface AssessmentResultResponse {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentDate: string;
  subjectName: string | null;
  studentId: string;
  studentName: string;
  rollNumber: string;
  marksObtained: number | null;
  maxMarks: number;
  percentage: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCategory =
  | 'TEACHING_QUALITY'
  | 'DISCIPLINE'
  | 'PUNCTUALITY'
  | 'PARENT_FEEDBACK'
  | 'PEER_REVIEW'
  | 'OTHER';

export interface EmployeeFeedbackRequest {
  rating: number;
  category: FeedbackCategory;
  comment?: string;
  feedbackDate: string;
  submittedBy?: string;
}

export interface EmployeeFeedbackResponse {
  id: string;
  employeeId: string;
  rating: number;
  category: FeedbackCategory;
  comment: string | null;
  feedbackDate: string;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TypeBreakdown {
  type: AssessmentType;
  averagePercentage: number;
  count: number;
}

export interface AttendanceSummary {
  totalDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  attendancePercentage: number;
}

export interface MonthAttendance {
  month: string;
  percentage: number;
}

export interface StudentPerformanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  overallPerformancePercentage: number;
  examWeightedAveragePercentage: number;
  byAssessmentType: TypeBreakdown[];
  examHistory: AssessmentResultResponse[];
  attendance: AttendanceSummary;
  attendanceByMonth: MonthAttendance[];
}

export interface SectionResultBreakdown {
  sectionId: string;
  className: string;
  section: string;
  averagePercentage: number;
}

export interface CategoryBreakdown {
  category: FeedbackCategory;
  averageRating: number;
  count: number;
}

export interface EmployeePerformanceSummary {
  employeeId: string;
  employeeName: string;
  overallResultPercentage: number;
  byClassSection: SectionResultBreakdown[];
  averageFeedbackRating: number;
  feedbackByCategory: CategoryBreakdown[];
  feedbackHistory: EmployeeFeedbackResponse[];
}

export interface Teacher {
  id: string;
  schoolId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type TeacherResourceType = 'BOOK' | 'NOTES' | 'WORKSHEET' | 'PRESENTATION' | 'VIDEO' | 'LINK' | 'OTHER';

export interface TeacherResourceRequest {
  classSectionId: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  resourceUrl: string;
  availableOffline: boolean;
}

export interface TeacherResourceUploadFields {
  classSectionId: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  availableOffline: boolean;
}

export interface TeacherResourceResponse {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  classSectionLabel: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  resourceUrl: string;
  availableOffline: boolean;
  fileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export type TeacherAssessmentType = 'QUIZ' | 'TEST' | 'EXAM' | 'ASSIGNMENT_CHECK';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'TRUE_FALSE' | 'NUMERIC' | 'SHORT_WORD';

export interface AiQuizGenerationRequest {
  classSectionId: string;
  /** Required when a teacher generates for themselves; the server checks their assignment against it. */
  subjectId?: string;
  subjectName: string;
  assessmentType: TeacherAssessmentType;
  title: string;
  syllabus: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  maxMarks: number;
  questionTypes?: QuestionType[];
  additionalInstructions?: string;
}

export interface GeneratedQuizQuestion {
  number: number;
  questionType: QuestionType;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
}

export interface AiQuizGenerationResponse {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionId: string;
  classSectionLabel: string;
  /** Grade of the section, e.g. "Grade 8" - what the question bank is scoped to. Always sent. */
  className: string;
  subjectId?: string | null;
  subjectName: string;
  assessmentType: TeacherAssessmentType;
  title: string;
  syllabus: string;
  difficulty: QuizDifficulty;
  maxMarks: number;
  questionCount: number;
  generatorMode: string;
  reviewNote: string;
  model?: string;
  questions: GeneratedQuizQuestion[];
}

/** `data` of a 429 AI_RATE_LIMITED: the shared hourly AI quota (quiz generator + Academic Helper) is used up. */
export interface AiRateLimitDetails {
  retryAfterSeconds: number;
  limitPerHour: number;
}

// --- Admissions (admin-only)

export type AdmissionStage = 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENROLLED';

export type AdmissionDocumentType =
  | 'BIRTH_CERTIFICATE'
  | 'TRANSFER_CERTIFICATE'
  | 'PREVIOUS_MARKSHEET'
  | 'AADHAAR'
  | 'PHOTO'
  | 'OTHER';

export interface AdmissionRequest {
  studentName: string;
  dob: string;
  gender: string;
  address: string;
  previousSchoolName?: string;
  parentName: string;
  parentContact: string;
  parentEmail?: string;
  /** A class name from GET /class-sections/classes - the section is picked later, at enrolment. */
  appliedClassName: string;
  notes?: string;
}

export interface AdmissionDocument {
  id: string;
  documentType: AdmissionDocumentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  /** Time-limited link; null when document storage isn't configured on the server. */
  downloadUrl: string | null;
  createdAt: string;
}

export interface AdmissionDuplicateStudent {
  id: string;
  name: string;
  rollNumber: string;
  classSectionLabel: string;
}

export interface Admission {
  id: string;
  stage: AdmissionStage;
  studentName: string;
  dob: string;
  gender: string;
  address: string;
  previousSchoolName: string | null;
  parentName: string;
  parentContact: string;
  parentEmail: string | null;
  appliedClassName: string;
  assignedClassSectionId: string | null;
  notes: string | null;
  studentId: string | null;
  decidedAt: string | null;
  enrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Detail responses only (null in lists). */
  documents: AdmissionDocument[] | null;
  possibleDuplicates: AdmissionDuplicateStudent[] | null;
  documentUploadsEnabled: boolean | null;
}

export interface PresignAdmissionDocumentRequest {
  documentType: AdmissionDocumentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface PresignAdmissionDocumentResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface RegisterAdmissionDocumentRequest extends PresignAdmissionDocumentRequest {
  objectKey: string;
}

export interface ConvertAdmissionRequest {
  classSectionId: string;
  admissionDate?: string;
  sendParentInvite?: boolean;
  allowDuplicate?: boolean;
}

export interface ConvertAdmissionResponse {
  application: Admission;
  studentId: string | null;
  studentName: string | null;
  /** Server-assigned (alphabetical rank in the section). */
  rollNumber: string | null;
  registrationNumber: string | null;
  classSectionLabel: string | null;
  alreadyEnrolled: boolean;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
}

// ---------------------------------------------------------------- school bus (transport)

export type TripDirection = 'MORNING' | 'RETURN';
export type TripStatus = 'CHECKLIST' | 'ACTIVE' | 'ENDED';
export type BoardingStatus = 'BOARDED' | 'NOT_BOARDED';
export type NotBoardedReason = 'PICKED_UP_BY_PARENT' | 'LEFT_EARLY' | 'OTHER_BUS' | 'OTHER';

export interface Bus {
  id: string;
  name: string;
  registrationNumber: string | null;
  capacity: number | null;
  defaultDriverId: string | null;
  defaultDriverName: string | null;
  active: boolean;
}

export interface BusRequest {
  name: string;
  registrationNumber?: string;
  capacity?: number;
  defaultDriverId?: string | null;
  active?: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

/** A bus's latest known position - also the payload on /topic/transport/trips/{id}. */
export interface BusLocation {
  tripId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  at: string;
}

export interface TripStudent {
  studentId: string;
  name: string;
  className: string;
  section: string;
  /** Null on a return checklist row nobody has marked yet. */
  status: BoardingStatus | null;
  reason: NotBoardedReason | null;
  note: string | null;
  extra: boolean;
  markedAt: string | null;
  /** Trip home: when the driver marked the child dropped at their stop. */
  droppedAt: string | null;
}

export interface BusTrip {
  id: string;
  busId: string;
  busName: string;
  busRegistrationNumber: string | null;
  driverId: string;
  driverName: string | null;
  direction: TripDirection;
  status: TripStatus;
  serviceDate: string;
  startedAt: string | null;
  endedAt: string | null;
  endedAutomatically: boolean;
  lastLocation: BusLocation | null;
  students: TripStudent[];
  morningTripIds: string[];
}

export interface MorningTripOption {
  tripId: string;
  busId: string;
  busName: string;
  driverName: string | null;
  endedAt: string | null;
  boardedCount: number;
}

export interface DriverHome {
  buses: Bus[];
  currentTrip: BusTrip | null;
  returnableMorningTrips: MorningTripOption[];
}

export interface TripSummary {
  id: string;
  busName: string;
  busRegistrationNumber: string | null;
  direction: TripDirection;
  status: TripStatus;
  serviceDate: string;
  startedAt: string | null;
  endedAt: string | null;
  endedAutomatically: boolean;
  boardedCount: number;
  notBoardedCount: number;
  droppedCount: number;
}

export interface TripHistoryPage {
  trips: TripSummary[];
  hasMore: boolean;
}

export interface DriverStudentResult {
  studentId: string;
  name: string;
  className: string;
  section: string;
}

export interface MyChildTrip {
  studentId: string;
  studentName: string;
  tripId: string;
  busName: string;
  busRegistrationNumber: string | null;
  driverName: string | null;
  direction: TripDirection;
  startedAt: string | null;
  lastLocation: BusLocation | null;
}

/** What a WhatsApp tracking link shows (public, no login). */
export interface PublicTracking {
  state: 'ON_BUS' | 'DROPPED' | 'ENDED' | 'INVALID';
  childName?: string;
  busName?: string;
  busRegistrationNumber?: string | null;
  direction?: TripDirection;
  schoolName?: string | null;
  location?: BusLocation | null;
  path?: [number, number][];
  droppedAt?: string | null;
  endedAt?: string | null;
}

export interface LocationFix {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  at: string;
}

// ---------------------------------------------------------------- holidays & festivals

export type HolidayKind = 'FESTIVAL' | 'HOLIDAY';

export interface HolidayRequest {
  name: string;
  date: string;
  kind: HolidayKind;
  greetingEnabled?: boolean;
  /** Blank: the ready-written / default text. */
  greetingTitle?: string;
  greetingMessage?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  kind: HolidayKind;
  /** Set on national days / festivals pre-filled from the built-in list. */
  festivalKey: string | null;
  greetingEnabled: boolean;
  /** What will be sent. */
  greetingTitle: string;
  greetingMessage: string;
}

// ---------------------------------------------------------------- ledger & receipts (specs/ledger-and-receipts)
// Payment methods are the fee payments' PaymentMethod above (the backend's one enum).

export type LedgerDirection = 'INFLOW' | 'OUTFLOW';
export type LedgerSourceType = 'FEE_PAYMENT' | 'EVENT_COLLECTION' | 'SPONSORSHIP' | 'SALARY' | 'VENDOR_PAYMENT' | 'MANUAL';
/** REVERSED is never set: a reversed entry stays COMPLETED and gets a linked reversal entry. */
export type LedgerStatus = 'PENDING' | 'COMPLETED' | 'REVERSED';
/** The first four are money in, the last three money out. */
export type ManualCategory =
  | 'OPENING_BALANCE'
  | 'DONATION'
  | 'OTHER_INCOME'
  | 'BANK_INTEREST'
  | 'PETTY_EXPENSE'
  | 'BANK_CHARGES'
  | 'OTHER_EXPENSE';
/** The exact record a ledger entry came from (`documentId` is that record's id; null for MANUAL_ENTRY). */
export type LedgerDocumentType =
  | 'FEE_PAYMENT'
  | 'PAYROLL_LINE'
  | 'INFRA_EXPENSE_REQUEST'
  | 'EVENT_EXPENSE_REQUEST'
  | 'SPONSORSHIP_PAYMENT'
  | 'EVENT_COLLECTION_PAYMENT'
  | 'MANUAL_ENTRY';
export type SponsorshipStatus = 'PLEDGED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

/** One row of the school ledger (money in or out). */
export interface LedgerTransaction {
  id: string;
  schoolId: string;
  direction: LedgerDirection;
  sourceType: LedgerSourceType;
  sourceId: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  transactionDate: string;
  /** Receipt number, money in only. */
  receiptNumber: string | null;
  status: LedgerStatus;
  /** Deprecated, never shown. */
  fundAccountId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Payment voucher number, money out recorded after this change. */
  voucherNumber: string | null;
  manualCategory: ManualCategory | null;
  /** Null on entries recorded before documents were linked. */
  documentType: LedgerDocumentType | null;
  documentId: string | null;
  /**
   * Reversal works one way for every entry, fee payments reversed from their bill included: the
   * original stays COMPLETED and is stamped reversed (these fields), and one compensating entry the
   * opposite way, with `reversalOfId`, cancels it out.
   */
  reversed: boolean;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
  /**
   * Set on every reversed entry. Fee payments carry the type the admin chose; the generic reverse
   * route always books CORRECTION, so show it only for FEE_PAYMENT (see `reversalTypeLabel`). Null on
   * unreversed and compensating entries; missing from older servers.
   */
  reversalType?: ReversalType | null;
  /** On a reversed entry: the entry that reversed it. */
  reversalTransactionId: string | null;
  /** On a reversal entry: the entry it reverses. */
  reversalOfId: string | null;
  /** Whether the server will accept POST .../reverse for this entry. */
  reversible: boolean;
}

/** Query filters shared by the ledger list and the summary. Use an academic year or from/to, not both. */
export interface LedgerFilter {
  from?: string;
  to?: string;
  /** e.g. "2026-27" (April to March). */
  academicYear?: string;
  sourceType?: LedgerSourceType;
  manualCategory?: ManualCategory;
  paymentMethod?: PaymentMethod;
  direction?: LedgerDirection;
  documentType?: LedgerDocumentType;
  documentId?: string;
}

export interface MethodTotals {
  inflow: number;
  outflow: number;
  net: number;
}

export interface FundSummary {
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  from: string | null;
  to: string | null;
  academicYear: string | null;
  /** Net of matching entries dated before `from`; null when there is no `from`. */
  openingBalance: number | null;
  closingBalance: number;
  entryCount: number;
  cash: MethodTotals;
  bank: MethodTotals;
  unspecified: MethodTotals;
  byPaymentMethod: { paymentMethod: PaymentMethod | null; inflow: number; outflow: number; net: number }[];
  bySource: {
    sourceType: LedgerSourceType;
    manualCategory: ManualCategory | null;
    inflow: number;
    outflow: number;
    net: number;
  }[];
}

export interface DayBookBucket {
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
}

export interface DayBook {
  date: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  closingBalance: number;
  cash: DayBookBucket;
  bank: DayBookBucket;
  unspecified: DayBookBucket;
  /** Every entry dated `date`, oldest first, at most 1000. */
  entries: LedgerTransaction[];
  entriesTruncated: boolean;
}

export interface ReceiptView {
  number: string;
  kind: 'RECEIPT' | 'PAYMENT_VOUCHER';
  /** CANCELLED once the entry is reversed. */
  status: 'VALID' | 'CANCELLED';
  label: string;
  schoolName: string;
  transaction: LedgerTransaction;
}

export interface ReversalResult {
  original: LedgerTransaction;
  reversal: LedgerTransaction;
}

// ---------------------------------------------------------------------------------------------
// Resource Hub: a class section's subjects with their NCERT books, chapters, topics and videos.
// Served by GET /api/v1/class-sections/{id}/resources; see the Student Resource Hub PRD.
// ---------------------------------------------------------------------------------------------

export interface ResourceVideo {
  mediaId: string;
  /** Plain https link on the curriculum media bucket, playable as is. */
  url: string;
  language: string;
  durationSec: number | null;
  posterUrl: string | null;
}

export interface ResourceTopic {
  topicId: string;
  /** The printed section number ("1.2"), or null for books whose headings are not numbered. */
  number: string | null;
  title: string;
  video: ResourceVideo | null;
}

export interface ResourceChapter {
  chapterId: string;
  /** The school's own row for this chapter (the hide flag lives there); null until pre-filled. */
  syllabusChapterId: string | null;
  number: number;
  title: string;
  /** Group label inside readers, e.g. "Prose" / "Poetry". */
  section: string | null;
  /** Hidden by the school. Students never receive hidden chapters; staff see them flagged. */
  hidden: boolean;
  pdfUrl: string | null;
  questionCount: number;
  /** A whole-chapter video, when one is published. */
  video: ResourceVideo | null;
  topics: ResourceTopic[];
}

export type CurriculumEdition = 'ncf2023' | 'current' | 'legacy';

export interface ResourceBook {
  bookCode: string;
  bookTitle: string;
  edition: CurriculumEdition;
  chapters: ResourceChapter[];
}

export interface ResourceSubject {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string | null;
  /** Null until an admin links this school subject to an NCERT subject; books are then empty. */
  curriculumSubjectKey: string | null;
  curriculumSubjectName: string | null;
  books: ResourceBook[];
}

export interface SectionResources {
  classSectionId: string;
  className: string;
  section: string;
  grade: number | null;
  generatedAt: string;
  subjects: ResourceSubject[];
}

export interface CurriculumSubjectRef {
  key: string;
  nameEn: string;
}

export interface CurriculumSuggestion extends CurriculumSubjectRef {
  nameHi: string | null;
  /** 0 to 1, best first. */
  score: number;
}

export interface CurriculumSuggestions {
  current: CurriculumSubjectRef | null;
  suggestions: CurriculumSuggestion[];
  allSubjects: CurriculumSubjectRef[];
}

export interface SubjectCurriculumResult {
  subjectId: string;
  curriculumSubjectKey: string | null;
  chaptersPrefilled: number;
}

export interface SyllabusChapterHidden {
  id: string;
  chapterNumber: number;
  title: string;
  hidden: boolean;
}

// ---------------------------------------------------------------------------------------------
// AI Tutor (workspace specs/ai-tutor-preview/contract.md)
// ---------------------------------------------------------------------------------------------

export type TutorPlan = 'TRIAL' | 'YEARLY' | 'GRANT';
export type TutorSessionMode = 'TEXT' | 'VOICE';
export type TutorSessionStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ABANDONED';
export type TutorStage = 'RECAP' | 'TEACH' | 'PRACTICE' | 'CLOSE';

export interface TutorEntitlement {
  id: string;
  studentId: string;
  plan: TutorPlan;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  sessionsTotal: number | null;
  sessionsUsed: number;
  /** Null when unlimited. */
  sessionsRemaining: number | null;
  startsAt: string;
  expiresAt: string | null;
  source: 'ADMIN_GRANT' | 'PAYMENT';
  note: string | null;
  usable: boolean;
}

export interface TutorAccess {
  studentId: string;
  allowed: boolean;
  /** no_entitlement, no_sessions_left, not_active; null when allowed. */
  reason: 'no_entitlement' | 'no_sessions_left' | 'not_active' | null;
  entitlement: TutorEntitlement | null;
  history: TutorEntitlement[];
}

export interface TutorChapterOption {
  chapterId: string;
  bookCode: string;
  bookTitle: string;
  subjectKey: string;
  subjectName: string;
  chapterNumber: number;
  title: string;
  topicCount: number;
  /** False until ops has ingested the chapter's textbook; a session cannot start on it. */
  ingested: boolean;
  /** 0 to 1 over the chapter's topics the student has attempted; null before any. */
  mastery: number | null;
  lastSessionAt: string | null;
}

export interface TutorChaptersResponse {
  grade: number | null;
  chapters: TutorChapterOption[];
}

export interface TutorCitation {
  chunkId: string;
  /** Ready to show: "Chapter 1 Chemical Reactions and Equations, section 1.1 ..., p. 6". */
  citation: string;
  chapterId: string;
  topicId: string | null;
  pageFrom: number | null;
}

export interface TutorTurnView {
  id: string;
  seq: number;
  role: 'STUDENT' | 'TUTOR' | 'SYSTEM';
  stage: TutorStage | null;
  content: string;
  citations: TutorCitation[];
  topicId: string | null;
  createdAt: string;
  latencyMs: number | null;
}

export interface TutorPlanView {
  focusTopicId: string | null;
  focusTopicTitle: string | null;
  recapQuestions: string[];
  steps: string[];
  practice: string[];
}

export interface TutorSessionView {
  id: string;
  studentId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  bookTitle: string;
  mode: TutorSessionMode;
  status: TutorSessionStatus;
  stage: TutorStage | null;
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number;
  plan: TutorPlanView | null;
  turns: TutorTurnView[];
  summary: string | null;
  parentNote: string | null;
  xpAwarded: number | null;
  flaggedReason: string | null;
}

export interface TutorTurnResult {
  turn: TutorTurnView;
  stage: TutorStage;
  status: TutorSessionStatus;
  /** Guard or syllabus notice to show above the reply, when there is one. */
  notice: string | null;
  /** True when the tutor closed the session with this reply. */
  sessionEnded: boolean;
}

export interface TutorSessionSummary {
  id: string;
  chapterId: string;
  chapterTitle: string;
  bookTitle: string;
  mode: TutorSessionMode;
  status: TutorSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number;
  minutes: number | null;
  summary: string | null;
  parentNote: string | null;
}

export interface TutorSessionList {
  sessions: TutorSessionSummary[];
}

export interface TutorTranscription {
  text: string;
  provider: string;
}

export interface TutorQuizOption {
  id: string;
  text: string;
}

export interface TutorQuizQuestion {
  id: string;
  text: string;
  options: TutorQuizOption[];
}

export interface TutorQuizWeekly {
  quizId: string;
  chapterId: string;
  chapterTitle: string;
  /** True when this week's quiz was already answered; then score and total are set and questions is empty. */
  answered: boolean;
  score: number | null;
  total: number | null;
  questions: TutorQuizQuestion[];
}

export interface TutorQuizAnswersRequest {
  quizId: string;
  answers: { questionId: string; optionId: string }[];
}

export interface TutorQuizResult {
  score: number;
  total: number;
  perTopic: { topicId: string; title: string; correct: number; total: number }[];
  masteryUpdated: boolean;
}

export interface TutorTopicMastery {
  topicId: string;
  topicNumber: string | null;
  title: string;
  mastery: number | null;
  attempts: number;
  lastSeenAt: string | null;
}

export interface TutorChapterMastery {
  chapterId: string;
  chapterNumber: number;
  title: string;
  bookTitle: string;
  mastery: number | null;
  sessions: number;
  topics: TutorTopicMastery[];
}

export interface TutorReport {
  studentId: string;
  studentName: string;
  access: {
    allowed: boolean;
    reason: string | null;
    plan: TutorPlan | null;
    sessionsRemaining: number | null;
    expiresAt: string | null;
  };
  week: {
    start: string;
    end: string;
    sessions: number;
    minutes: number;
    quizScore: { score: number; total: number } | null;
  };
  total: { sessions: number; minutes: number; firstSessionAt: string | null };
  conceptsThisWeek: { topicId: string; title: string; chapterTitle: string; mastery: number | null }[];
  strengths: { topicId: string; title: string; mastery: number }[];
  gaps: { topicId: string; title: string; mastery: number }[];
  nextPlan: string | null;
  chapters: TutorChapterMastery[];
  quizTrend: { weekStart: string; score: number; total: number }[];
  recentSessions: TutorSessionSummary[];
  profileSummary: string | null;
}
