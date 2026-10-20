/**
 * "Playful Blocks" theme (Oct 2026 redesign, workspace spec `app-ui-redesign-deep-violet`, direction C).
 * Paper ground everywhere with a light header; content lives in tinted blocks (`tints`), each tint
 * owning a meaning; solid Violet 700 only on the primary button and the selected day/tab. No
 * gradients, no borders, no drop shadows (the game hub keeps its own `gameColors` surfaces on purpose).
 */
export const colors = {
  primary: '#6D28D9', // Violet 700: headers, primary buttons, active tab
  primaryBright: '#7C3AED', // Violet 600: the decorative circle on a violet surface, progress fills
  primaryDeep: '#3B1782', // Violet 900: wordmark, the "Ask AI" bar
  primaryLight: '#EDE4FE', // Violet 100: icon tiles, soft chips, secondary text on violet
  primarySoft: '#F5F0FF', // Violet 50: row icon backgrounds
  background: '#FAF8FD', // Paper
  surface: '#FFFFFF',
  surfaceMuted: '#F5F0FF',
  textPrimary: '#1E1633', // Ink 900
  textSecondary: '#564E6B', // Ink 600
  textMuted: '#8C85A0', // Ink 400
  success: '#1E9E5A',
  successLight: '#E3F6EA',
  warning: '#A86A00', // Marigold 700 (text on marigold 100)
  warningLight: '#FFF1D0', // Marigold 100
  marigold: '#F5A70A', // Marigold 500: badges, the progress bar on violet
  error: '#D6453D',
  errorLight: '#FBE3E1',
  accent: '#6D28D9',
  border: '#E6E1EF', // Line (inputs)
  hairline: '#F1EDF7', // dividers inside a white list block
  white: '#FFFFFF',
  /** Text colours for use on a `colors.primary` surface. */
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#EDE4FE',
  onPrimaryWarning: '#FFE7A8',
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
  lg: 16, // buttons, inputs, round header buttons, small tiles
  xl: 20, // tiles, period cards
  xxl: 24, // hero blocks, list blocks
  pill: 999,
} as const;

/**
 * The four block tints. `bg` is the block, `fg` the text and icon colour on it. Meaning:
 * violet = primary / AI, marigold = money / attention, mint = attendance / present, sky = timetable / info.
 */
export const tints = {
  violet: { bg: '#EDE4FE', fg: '#6D28D9' },
  marigold: { bg: '#FFF1D0', fg: '#A86A00' },
  mint: { bg: '#DDF5E8', fg: '#157A45' },
  sky: { bg: '#DDEEFF', fg: '#1B5FA8' },
} as const;

export type TintKey = keyof typeof tints;

/** Cycles the four tints for a grid of tiles. */
export function tintAt(index: number): TintKey {
  return (['violet', 'marigold', 'mint', 'sky'] as const)[index % 4];
}

/** Playful Blocks has no drop shadows; kept as a no-op so older call sites compile. */
export const heroShadow = {} as const;

/** Existing cards keep a faint violet-tinted lift until they are restyled with a 1 px border. */
export const shadow = {
  shadowColor: '#3B1782',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

/** Cards below the hero use a 1 px `colors.border` instead of a shadow; this stays for callers not yet restyled. */
export const softShadow = {
  shadowColor: '#3B1782',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
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
