export const colors = {
  primary: '#7C3AED',
  primaryLight: '#EFE8FC',
  background: '#F6F3FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EAFA',
  textPrimary: '#201A2B',
  textSecondary: '#5B5468',
  textMuted: '#9A93A8',
  success: '#2E7D32',
  warning: '#B45309',
  error: '#C62828',
  accent: '#7C3AED',
  border: '#E5DEF5',
  white: '#FFFFFF',
} as const;

export const gradients = {
  header: ['#7C3AED', '#C026D3'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: '#0F1E3D',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export const softShadow = {
  shadowColor: '#0F1E3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
} as const;

export type AccentKey =
  | 'students'
  | 'employees'
  | 'vendors'
  | 'fees'
  | 'payroll'
  | 'infraExpenses'
  | 'classes'
  | 'myClassSection'
  | 'chat'
  | 'calls'
  | 'gamification'
  | 'houses'
  | 'arena'
  | 'events'
  | 'academicHelper'
  | 'helpdeskBot'
  | 'teacherTools'
  | 'aiQuizGenerator'
  | 'reportCard'
  | 'gradingScale'
  | 'markMyAttendance'
  | 'staffAttendance'
  | 'myAttendance'
  | 'registrationInbox'
  | 'myClassFees'
  | 'attendanceDevices'
  | 'activityLog'
  | 'aiMisuseLog'
  | 'attendanceExport'
  | 'newAdmission'
  | 'admissions'
  | 'idCards'
  | 'announcements'
  | 'alerts'
  | 'myTimetable'
  | 'timetableEditor'
  | 'bellSchedule'
  | 'substitutions'
  | 'rooms'
  | 'schoolLogo'
  | 'schoolLocation'
  | 'attendance'
  | 'vendorsExpenses'
  | 'academics'
  | 'reports'
  | 'transport'
  | 'schoolBus'
  | 'holidays'
  | 'resources';

export const accents: Record<AccentKey, { base: string; light: string }> = {
  transport: { base: '#D97706', light: '#FEF3C7' },
  holidays: { base: '#E11D48', light: '#FFE4E6' },
  schoolBus: { base: '#D97706', light: '#FEF3C7' },
  students: { base: '#2563EB', light: '#E3ECFD' },
  employees: { base: '#7C3AED', light: '#EDE7FC' },
  vendors: { base: '#EA580C', light: '#FDEBE0' },
  fees: { base: '#059669', light: '#DFF5EC' },
  payroll: { base: '#DB2777', light: '#FBE5EF' },
  infraExpenses: { base: '#0891B2', light: '#DEF3F7' },
  classes: { base: '#CA8A04', light: '#FBF1D2' },
  myClassSection: { base: '#CA8A04', light: '#FBF1D2' },
  chat: { base: '#0D9488', light: '#DAF3F0' },
  calls: { base: '#4338CA', light: '#E5E3FB' },
  gamification: { base: '#FFB020', light: '#FFF1D6' },
  houses: { base: '#E85D3C', light: '#FCE6DE' },
  arena: { base: '#7C2D92', light: '#F1E3F5' },
  events: { base: '#0369A1', light: '#DCEEFB' },
  academicHelper: { base: '#0891B2', light: '#DFF4F8' },
  helpdeskBot: { base: '#0EA5E9', light: '#E0F2FE' },
  teacherTools: { base: '#4F46E5', light: '#E8E6FC' },
  aiQuizGenerator: { base: '#4F46E5', light: '#E8E6FC' },
  reportCard: { base: '#B45309', light: '#FCEEDB' },
  gradingScale: { base: '#475569', light: '#E7EAEE' },
  markMyAttendance: { base: '#16A34A', light: '#DCFCE7' },
  myAttendance: { base: '#16A34A', light: '#DCFCE7' },
  staffAttendance: { base: '#9333EA', light: '#F1E4FC' },
  registrationInbox: { base: '#0F766E', light: '#DBF0EC' },
  myClassFees: { base: '#059669', light: '#DFF5EC' },
  attendanceDevices: { base: '#1D4ED8', light: '#E1EAFB' },
  activityLog: { base: '#334155', light: '#E2E8F0' },
  aiMisuseLog: { base: '#B91C1C', light: '#FEE2E2' },
  attendanceExport: { base: '#15803D', light: '#DCFCE7' },
  newAdmission: { base: '#C2410C', light: '#FFEDD5' },
  admissions: { base: '#BE185D', light: '#FCE7F3' },
  announcements: { base: '#C026D3', light: '#FAE8FC' },
  alerts: { base: '#DC2626', light: '#FDE4E4' },
  myTimetable: { base: '#0E7490', light: '#DDF2F7' },
  timetableEditor: { base: '#0E7490', light: '#DDF2F7' },
  bellSchedule: { base: '#475569', light: '#E7EAEE' },
  substitutions: { base: '#C2410C', light: '#FFEDD5' },
  rooms: { base: '#0F766E', light: '#DBF0EC' },
  schoolLogo: { base: '#7C3AED', light: '#EDE9FE' },
  schoolLocation: { base: '#0F766E', light: '#CCFBF1' },
  idCards: { base: '#0E7490', light: '#CFFAFE' },
  attendance: { base: '#9333EA', light: '#F1E4FC' },
  vendorsExpenses: { base: '#EA580C', light: '#FDEBE0' },
  academics: { base: '#CA8A04', light: '#FBF1D2' },
  reports: { base: '#334155', light: '#E2E8F0' },
  resources: { base: '#0F766E', light: '#CCFBF1' },
};

/**
 * The "game accent" set used only by the gamification screens - deliberately distinct from the
 * app's violet brand color rather than reusing it, so XP/streak/level feel like a game surface
 * (gold currency, ember streak fire, jade success) instead of another purple dashboard card. See
 * specs/gamification/execution-plan.md and the UI prototype it links for the design rationale.
 */
export const gameColors = {
  ink: '#171334',
  inkSoft: '#2A2350',
  gold: '#FFB020',
  goldSoft: '#FFD685',
  ember: '#FF5A3C',
  jade: '#2FE0A0',
} as const;
