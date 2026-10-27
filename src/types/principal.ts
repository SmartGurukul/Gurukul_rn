import type {
  Admission,
  Assessment,
  CallProvider,
  ClassSection,
  Employee,
  FeeAssessment,
  FeePayment,
  FeeStructure,
  GeneratedQuizQuestion,
  LedgerTransaction,
  ResourceBook,
  ResourceChapter,
  ResourceSubject,
  SalaryStructure,
  Student,
  TutorSessionView,
} from '../api/types';
import type { InfraExpenseRequest, Vendor } from '../api/expenseTypes';

export type FeatureId =
  | 'students'
  | 'employees'
  | 'vendors'
  | 'fees'
  | 'payroll'
  | 'infraExpenses'
  | 'classes'
  | 'resources'
  | 'calls'
  | 'gamification'
  | 'houses'
  | 'events'
  | 'academicHelper'
  | 'teacherTools'
  | 'reportCard'
  | 'gradingScale'
  | 'markMyAttendance'
  | 'staffAttendance'
  | 'myAttendance'
  | 'registrationInbox'
  | 'attendanceDevices'
  | 'activityLog'
  | 'aiMisuseLog'
  | 'attendanceExport'
  | 'admissions'
  | 'idCards'
  | 'myTimetable'
  | 'timetableEditor'
  | 'bellSchedule'
  | 'substitutions'
  | 'rooms'
  | 'schoolLocation'
  | 'attendance'
  | 'vendorsExpenses'
  | 'academics'
  | 'reports'
  | 'arena'
  | 'aiQuizGenerator'
  | 'transport'
  | 'schoolBus'
  | 'holidays';

/** A group of admin screens behind one dashboard tile - see SectionHubScreen. */
export type HubSection = 'students' | 'attendance' | 'vendorsExpenses' | 'academics' | 'reports';

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export type PrincipalStackParamList = {
  /** School bus: a family's live view, the admin hub and trip detail, and the driver's screens. */
  MyBus: undefined;
  Holidays: undefined;
  AcademicTerms: undefined;
  TransportHub: undefined;
  BusTripDetail: { tripId: string };
  DriverHome: undefined;
  DriverTrip: { tripId: string };
  DriverPastTrips: undefined;
  PrincipalDashboard: undefined;
  Profile: undefined;
  PushDebug: undefined;
  // AI Tutor (parent)
  /** A parent's (or admin's) AI Tutor report for one child; studentName shows until the report loads. */
  TutorParentReport: { studentId: string; studentName?: string };
  /** One tutor session read back; role-neutral, the server decides who may read it. */
  TutorTranscript: { sessionId: string };
  // end AI Tutor (parent)
  SwitchChild: undefined;
  ConnectGoogleAccount: undefined;
  GlobalSearch: undefined;
  StudentsList: undefined;
  Classmates: undefined;
  MyStudents: undefined;
  StudentDetail: { student: Student };
  StudentForm: { student?: Student };
  EmployeesList: undefined;
  EmployeeDetail: { employee: Employee };
  EmployeeForm: { employee?: Employee };
  /** Only id and name: a driver opens their own payslips without being able to read their employee record. */
  SalaryHistory: { employee: Pick<Employee, 'id' | 'name'> };
  VendorsList: undefined;
  /** `vendor`: the copy to show while the latest is fetched. */
  VendorDetail: { vendorId: string; vendor?: Vendor };
  VendorForm: { vendor?: Vendor };
  FeesHub: undefined;
  FeeCategoriesList: undefined;
  FeeStructuresList: undefined;
  /** No params: create a structure. `feeStructure`: edit its lines (the section and year stay fixed). */
  FeeStructureForm: { feeStructure?: FeeStructure } | undefined;
  FeeStructureDetail: { feeStructure: FeeStructure };
  FeeAssessmentsList: undefined;
  MyFees: undefined;
  /** `assessment` is only the first paint: the screen fetches the bill (with its adjustments) on focus. */
  FeeAssessmentDetail: { assessment: FeeAssessment };
  PayFees: { assessment: FeeAssessment };
  FeePaymentSettings: undefined;
  /** The payment itself (after recording, or from a history list), or just its id; fetched again on focus. */
  PaymentReceipt: { payment?: FeePayment; paymentId?: string };
  RecordPayment: { assessment: FeeAssessment };
  ReversePayment: { payment: FeePayment };
  /** Every payment on every bill of one student. */
  StudentFeePayments: { student: { id: string; name?: string } };
  /** The school ledger: day book, filtered entries and the receipt lookup (admin, from the Fees hub). */
  Ledger: undefined;
  LedgerEntryDetail: { transaction: LedgerTransaction };
  PayrollHub: undefined;
  SalaryStructuresList: undefined;
  /** No params: add a structure. `structure`: edit it. `employee`: add one for that employee. */
  SalaryStructureForm: { structure?: SalaryStructure; employee?: { id: string; name: string } } | undefined;
  PayrollRunsList: undefined;
  /** No runId: pick a month and create its run. */
  PayrollRun: { runId?: string } | undefined;
  PayslipDetail: { payrollLineId: string; employeeName?: string };
  PayrollOverview: undefined;
  MyClassFees: { classSection: ClassSection };
  InfraExpensesList: undefined;
  /** `request`: the copy to show while the latest (with its history) is fetched. */
  InfraExpenseDetail: { requestId: string; request?: InfraExpenseRequest };
  InfraExpenseForm: undefined;
  InfraCategories: undefined;
  /** `homeroom`: a class teacher's own section, pinned above the class list. */
  ClassesList: { homeroom?: ClassSection } | undefined;
  SectionsList: { className: string };
  SectionDetail: { classSection: ClassSection };
  SectionStudentsList: { classSection: ClassSection };
  SectionSubjectsList: { classSection: ClassSection };
  SectionAssessmentsList: { classSection: ClassSection };
  AssessmentForm: { classSection: ClassSection; assessment?: Assessment };
  AssessmentDetail: { assessment: Assessment; classSection: ClassSection };
  /** `readOnly`: a teacher who may read this assessment's marks but not change them. */
  AssessmentResults: { assessment: Assessment; readOnly?: boolean };
  AttendanceTake: { classSection: ClassSection };
  AttendanceHistory: { student: Pick<Student, 'id' | 'name'> };
  RegistrationInbox: undefined;
  ParentHome: undefined;
  ChildDashboard: { student: Pick<Student, 'id' | 'name' | 'classSectionId'> };
  ChildFees: { student: Pick<Student, 'id' | 'name'> };
  /**
   * `defaultSectionId`: the class the term was published for (an earlier class after promotion).
   * `student.classSectionId`: the student's current class, for staff draft previews; looked up when left out.
   */
  ReportCard: {
    student: Pick<Student, 'id' | 'name'> & { classSectionId?: string | null };
    defaultTerm?: string;
    defaultSectionId?: string;
  };
  /**
   * Every chart the student's published terms support - opened from the report card.
   *
   * `term` / `sectionId`: the card that was on screen, so the subject charts describe the same
   * term the chips were showing. Left out, or naming a term with nothing published, the charts
   * fall back to the newest term and say which one they are describing.
   */
  OverallStatus: {
    student: Pick<Student, 'id' | 'name'>;
    term?: string;
    sectionId?: string;
  };
  PublishReportCards: { classSection: ClassSection };
  SectionReportCardsGrid: { classSection: ClassSection };
  GradingScale: undefined;
  MarkMyAttendance: undefined;
  SchoolLocationSettings: undefined;
  /** The home-screen setup checklist's screens (spec school-onboarding-tunnel). */
  ClassSetup: undefined;
  StudentImport: undefined;
  TeacherSetup: undefined;
  StaffAttendance: undefined;
  EmployeeAttendanceHistory: { employee: Pick<Employee, 'id' | 'name'> };
  AttendanceDevices: undefined;
  ActivityLog: undefined;
  /**
   * Admin: refused AI messages, who is paused now (and lifting a pause), and the bot's data lookups.
   * `pauseId`: opened from an AI_MISUSE_PAUSED push or alert - it shows "Paused now", and a new one
   * reloads it when the log is already open (navigating to the screen on show only changes params).
   */
  AiMisuseLog: { pauseId?: string } | undefined;
  AttendanceExport: undefined;
  SchoolLogoSettings: undefined;
  /** `mode: 'edit'` shows only the details form (opened from Profile's Edit button). */
  IdCard: { kind: 'STUDENT' | 'EMPLOYEE'; id: string; name: string; mode?: 'edit' };
  IdCardSheets: undefined;
  ConversationsList: undefined;
  NewConversation: undefined;
  /** `isBot`: the helpdesk bot's chat (cards, "typing…"), set by HelpdeskBotScreen. */
  ConversationThread: { conversationId: string; title: string; isBot?: boolean };
  Announcements: undefined;
  Notifications: undefined;
  HelpdeskBot: undefined;
  VideoCallHub: undefined;
  PickCallTarget: undefined;
  ScheduleCall: undefined;
  ScheduledCalls: undefined;
  CallHistory: undefined;
  InCall: { roomName: string; provider: CallProvider; displayName: string; callLogId?: string; scheduledCallId?: string };
  GamificationHub: undefined;
  Leaderboard: undefined;
  HouseWars: undefined;
  AwardRecognition: undefined;
  Arena: undefined;
  NewChallenge: undefined;
  ChallengeDetail: { challengeId: string };
  // Undefined = add a new question; questionId = edit that saved question.
  QuestionAuthor: { questionId?: string } | undefined;
  MyQuestions: undefined;
  QuizResults: { classSection: ClassSection };
  QuestionStats: { subjectId: string; subjectName?: string; className: string; classSection?: ClassSection };
  BattleRoomMatch: undefined;
  BattleRoom: { roomId: string };
  PracticeStart: undefined;
  PracticeSession: { sessionId: string };
  EventsList: undefined;
  EventDetail: { eventId: string };
  EventForm: undefined;
  AcademicHelper: undefined;
  TeacherPerformance: { employee: Employee };
  TeacherToolsHub: undefined;
  SectionHub: { section: HubSection };
  // Undefined = a teacher generating for themselves (from their dashboard tile); set = a principal
  // acting for a teacher from the Teacher Tools hub.
  ResourceGenerator: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string } | undefined;
  // storedDraft: the stored AI draft the questions came from (its key + savedAt), to record them as saved on it.
  QuizBankReview: {
    subjectId: string;
    subjectName: string;
    className: string;
    questions: GeneratedQuizQuestion[];
    storedDraft?: { key: string; savedAt: string };
  };
  NewAdmission: { admission?: Admission } | undefined;
  AdmissionsList: undefined;
  AdmissionDetail: { admissionId: string };
  ResourceUpload: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string };
  /**
   * No params: the caller's own timetable. classSection: that section's. student: a parent's child.
   * teacher: any teacher's (admin only). date: open on that date (YYYY-MM-DD) rather than today.
   */
  MyTimetable:
    | { classSection?: ClassSection; student?: Pick<Student, 'id' | 'name'>; date?: string; teacher?: { id: string; name: string } }
    | undefined;
  TimetableEditor: { classSection?: ClassSection } | undefined;
  PeriodSetup: undefined;
  /** Admin: cover periods for a date (YYYY-MM-DD; today when left out). */
  Substitutions: { date?: string } | undefined;
  /** Admin: the school's classrooms and labs. */
  Rooms: undefined;
  /** Resource Hub: a section's subjects, NCERT chapters, topics and videos (inside My Class). */
  Resources: { classSection: ClassSection };
  /** One chapter of the journey: video, textbook and topics. Data comes by params; no refetch. */
  Chapter: { classSection: ClassSection; subject: ResourceSubject; book: ResourceBook; chapter: ResourceChapter };
  /** Admin: link each school subject to its NCERT subject. */
  CurriculumMapping: undefined;
  /** Opens a web document (an NCERT chapter PDF) in-app; iOS renders PDFs, Android opens them outside. */
  WebDocument: { url: string; title: string };
  // AI Tutor (student)
  /** The student's chapters and access state; the entry point from the home tile. */
  TutorChapters: undefined;
  /** A live session. `session` is the view the start call returned; left out, the screen fetches it. */
  TutorSession: { sessionId: string; session?: TutorSessionView };
  /** The student's past sessions. */
  TutorSessions: undefined;
  /** This week's five-question quiz. */
  TutorQuiz: undefined;
  /** A past session's full transcript (screen owned by the parent side). */
  TutorTranscript: { sessionId: string };
};
