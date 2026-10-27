import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../i18n/useLanguage';

import { getClassSection, listClassSections } from '../../api/classSections';
import { getEmployee, isActiveEmployee, listAllEmployees } from '../../api/employees';
import { getSchool } from '../../api/schools';
import { getStudent, listStudents } from '../../api/students';
import { getDayBook } from '../../api/ledger';
import { getStaffAttendanceRoster } from '../../api/staffAttendance';
import { getUncoveredPeriods } from '../../api/timetable';
import type { ClassSection, Employee, School } from '../../api/types';
import { listVendors } from '../../api/vendors';
import { FeatureTile } from '../../components/FeatureTile';
import { HeroCard, type HeroStat } from '../../components/HeroCard';
import { HomeTabBar, type HomeTab } from '../../components/HomeTabBar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { NotificationPermissionPrompt } from '../../components/NotificationPermissionPrompt';
import { ScreenHeader, headerButtonStyle } from '../../components/ScreenHeader';
import { SetupChecklistCard } from '../../components/SetupChecklistCard';
import { TutorTile } from '../../components/TutorTile';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { isPublicSchool } from '../../config/publicSchool';
import { colors, radius, spacing, tintAt, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { FeatureAction, FeatureId, HubSection, PrincipalStackParamList } from '../../types/principal';
import { compactInr, longDate, staffPresentCount } from '../../utils/homeSummary';
import { setupComplete, setupSteps, type SetupStepId } from '../../utils/setupChecklist';
import { coverCount } from '../../utils/substitutions';
import { todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PrincipalDashboard'>;

// Game Hub is a student-only concept (there is no "my XP" for an admin/teacher account), so it's
// filtered out of the grid below rather than being one more tile everyone sees but can't use.
// Arena is the reverse: students now reach it from inside Game Hub, so its own tile is only
// needed for teachers, who use it to author quiz questions rather than play.
const STUDENT_ONLY_FEATURES: FeatureId[] = ['gamification', 'reportCard', 'myAttendance', 'schoolBus', 'resources'];
// Arena (question authoring) and self-mark check-in are teacher-only concepts - a principal/admin
// self-marking isn't part of this tile's intent even though the backend also permits it for ADMIN.
// AI Quiz Generator is the teacher's own entry to the generator (for their assigned classes).
const TEACHER_ONLY_FEATURES: FeatureId[] = ['arena', 'markMyAttendance', 'aiQuizGenerator'];
// Hidden from teachers and students - the backend rejects them anyway. Admins don't go through
// this filter at all: they get the fixed ADMIN_HOME_FEATURES list below.
const ADMIN_ONLY_FEATURES: FeatureId[] = [
  'transport',
  'holidays',
  'activityLog',
  'aiMisuseLog',
  'attendanceExport',
  'timetableEditor',
  'bellSchedule',
  'substitutions',
  'rooms',
  'schoolLocation',
  'idCards',
  'admissions',
  'attendance',
  'vendorsExpenses',
  'academics',
  'reports',
];
// A school admin gets exactly these tiles, in this order. Everything else they manage sits one tap
// down, in the section screen a tile opens (ADMIN_SECTIONS) - keeping the home grid short.
const ADMIN_HOME_FEATURES: FeatureId[] = [
  'students',
  'admissions',
  'employees',
  'attendance',
  'fees',
  'payroll',
  'vendorsExpenses',
  'academics',
  'events',
  'holidays',
  'transport',
  'reports',
];
// Admin tiles that open a SectionHub listing several screens, rather than one screen directly.
const ADMIN_SECTIONS: Partial<Record<FeatureId, HubSection>> = {
  students: 'students',
  attendance: 'attendance',
  vendorsExpenses: 'vendorsExpenses',
  academics: 'academics',
  reports: 'reports',
};
// A teacher's own periods / a student's class timetable. An admin edits timetables instead.
const TEACHER_AND_STUDENT_FEATURES: FeatureId[] = ['myTimetable'];
// Vendors/Payroll/Infra Expenses are purely school-admin/procurement concerns - a student account
// has no legitimate use for any of them, so they're hidden outright rather than scoped down.
// Teacher Tools is a principal-driven workflow (principal picks a teacher to act on behalf of),
// not something a student would ever use either. Registration Approvals is an admin-only inbox -
// no legitimate use for a student either. Classmates are reached from inside My Class
// (SectionDetail) rather than a tile of their own, and so are their teachers (the Subjects row lists
// each subject's teacher).
const STUDENT_HIDDEN_FEATURES: FeatureId[] = [
  'students',
  'employees',
  'vendors',
  'payroll',
  'infraExpenses',
  'teacherTools',
  'gradingScale',
  'staffAttendance',
  'registrationInbox',
  'attendanceDevices',
];
// Managing other staff, vendors, fees, and infra requests are school-admin concerns a teacher has
// no business in - Payroll stays visible but is rerouted to just their own payslip history below.
// Teacher Tools is principal-only for the same reason as above - a teacher acting "as" another
// teacher doesn't fit the feature's design. Registration Approvals is admin-only for the same reason.
// Their own payslips are under Profile, not a tile.
const TEACHER_HIDDEN_FEATURES: FeatureId[] = [
  'payroll',
  'employees',
  'vendors',
  'fees',
  'infraExpenses',
  'teacherTools',
  'gradingScale',
  'staffAttendance',
  'registrationInbox',
  'attendanceDevices',
];

const featureRoutes: Record<FeatureId, keyof PrincipalStackParamList> = {
  students: 'StudentsList',
  employees: 'EmployeesList',
  vendors: 'VendorsList',
  fees: 'FeesHub',
  payroll: 'PayrollHub',
  infraExpenses: 'InfraExpensesList',
  classes: 'ClassesList',
  resources: 'Resources',
  calls: 'VideoCallHub',
  gamification: 'GamificationHub',
  houses: 'HouseWars',
  events: 'EventsList',
  academicHelper: 'AcademicHelper',
  teacherTools: 'TeacherToolsHub',
  reportCard: 'ReportCard',
  gradingScale: 'GradingScale',
  markMyAttendance: 'MarkMyAttendance',
  staffAttendance: 'StaffAttendance',
  registrationInbox: 'RegistrationInbox',
  myAttendance: 'AttendanceHistory',
  attendanceDevices: 'AttendanceDevices',
  activityLog: 'ActivityLog',
  aiMisuseLog: 'AiMisuseLog',
  attendanceExport: 'AttendanceExport',
  admissions: 'AdmissionsList',
  myTimetable: 'MyTimetable',
  timetableEditor: 'TimetableEditor',
  bellSchedule: 'PeriodSetup',
  substitutions: 'Substitutions',
  rooms: 'Rooms',
  schoolLocation: 'SchoolLocationSettings',
  idCards: 'IdCardSheets',
  attendance: 'SectionHub',
  vendorsExpenses: 'SectionHub',
  academics: 'SectionHub',
  reports: 'SectionHub',
  arena: 'Arena',
  aiQuizGenerator: 'ResourceGenerator',
  transport: 'TransportHub',
  holidays: 'Holidays',
  schoolBus: 'MyBus',
};

// A teacher's tiles, in this order. A class teacher's own section is pinned inside Classes.
const TEACHER_TILE_ORDER: FeatureId[] = [
  'markMyAttendance',
  'myTimetable',
  'classes',
  'students',
  'arena',
  'aiQuizGenerator',
  'academicHelper',
  'events',
];

// A student's tiles, in this order (any other tile a student can see goes after them).
const STUDENT_TILE_ORDER: FeatureId[] = [
  'resources',
  'classes',
  'schoolBus',
  'gamification',
  'myAttendance',
  'reportCard',
  'fees',
  'myTimetable',
  'academicHelper',
  'events',
];

// Classes/Fees route to the same screens admins use, but scoped to the student's own
// class-section - the copy needs to reflect that scope instead of the school-wide admin framing.
// Their words are under dashboard.studentCopy.<id> in the translations.
const STUDENT_COPY_IDS: FeatureId[] = ['classes', 'fees'];

// Students routes to the same screen admins use, but scoped to the classes a teacher teaches -
// the copy needs to reflect that instead of the school-wide framing.
const TEACHER_COPY: Partial<Record<FeatureId, Pick<FeatureAction, 'title' | 'description'>>> = {
  students: { title: 'My Students', description: 'Students in classes you teach' },
};

// The admin's Students, Admissions and Staff tiles cover more than their old single screen, so
// their copy says what's behind them.
const ADMIN_COPY_IDS: FeatureId[] = ['students', 'employees', 'admissions'];

function tileRank(order: FeatureId[], id: FeatureId): number {
  const index = order.indexOf(id);
  return index === -1 ? order.length : index;
}

function applyRoleCopy(feature: FeatureAction, copy: Partial<Record<FeatureId, Pick<FeatureAction, 'title' | 'description'>>>): FeatureAction {
  const override = copy[feature.id];
  return override ? { ...feature, ...override } : feature;
}

interface Counts {
  students: number | null;
  employees: number | null;
  vendors: number | null;
}

// Per school, so a device that registers a second school starts its checklist afresh.
const setupDismissedKey = (schoolId: string) => `gurukul.setupDismissed.${schoolId}`;
const parentsToldKey = (schoolId: string) => `gurukul.setupParentsTold.${schoolId}`;

export function PrincipalDashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isStudent = session.ownerType === 'STUDENT';
  // Schoolless (public) students: only Resources + Gamification, and never the Open School's name.
  const isPublic = isPublicSchool(schoolId);
  const isTeacher = session.role === 'TEACHER';
  const isAdmin = session.role === 'ADMIN';
  const { language } = useLanguage();
  const [school, setSchool] = useState<School | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [myClassSection, setMyClassSection] = useState<ClassSection | null>(null);
  const [myHomeroomSection, setMyHomeroomSection] = useState<ClassSection | null>(null);
  const [counts, setCounts] = useState<Counts>({ students: null, employees: null, vendors: null });
  const [loadingCounts, setLoadingCounts] = useState(true);
  // Periods that need a substitute today; null until loaded, or when it couldn't be (plain label then).
  const [coverNeeded, setCoverNeeded] = useState<number | null>(null);
  // Today's numbers for the hero card (admin only): staff in / total marked, rupees received.
  const [staffToday, setStaffToday] = useState<{ present: number; total: number } | null | undefined>(null);
  const [collectedToday, setCollectedToday] = useState<number | null | undefined>(null);
  // The setup checklist: what the school still has to do, from the counts and roster loaded below.
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [parentsTold, setParentsTold] = useState(false);

  const featureActions: FeatureAction[] = [
    { id: 'students', title: t('dashboard.features.students.title'), icon: 'user-graduate', description: t('dashboard.features.students.description') },
    { id: 'admissions', title: t('dashboard.features.admissions.title'), icon: 'clipboard-list', description: t('dashboard.features.admissions.description') },
    { id: 'employees', title: t('dashboard.features.employees.title'), icon: 'id-badge', description: t('dashboard.features.employees.description') },
    { id: 'vendors', title: t('dashboard.features.vendors.title'), icon: 'truck', description: t('dashboard.features.vendors.description') },
    { id: 'fees', title: t('dashboard.features.fees.title'), icon: 'file-invoice-dollar', description: t('dashboard.features.fees.description') },
    { id: 'payroll', title: t('dashboard.features.payroll.title'), icon: 'money-check-alt', description: t('dashboard.features.payroll.description') },
    { id: 'infraExpenses', title: t('dashboard.features.infraExpenses.title'), icon: 'tools', description: t('dashboard.features.infraExpenses.description') },
    { id: 'classes', title: t('dashboard.features.classes.title'), icon: 'chalkboard-teacher', description: t('dashboard.features.classes.description') },
    { id: 'resources', title: t('dashboard.features.resources.title'), icon: 'photo-video', description: t('dashboard.features.resources.description') },
    { id: 'calls', title: t('dashboard.features.calls.title'), icon: 'video', description: t('dashboard.features.calls.description') },
    { id: 'gamification', title: t('dashboard.features.gamification.title'), icon: 'trophy', description: t('dashboard.features.gamification.description') },
    { id: 'events', title: t('dashboard.features.events.title'), icon: 'calendar-alt', description: t('dashboard.features.events.description') },
    { id: 'academicHelper', title: t('dashboard.features.academicHelper.title'), icon: 'lightbulb', description: t('dashboard.features.academicHelper.description') },
    { id: 'teacherTools', title: t('dashboard.features.teacherTools.title'), icon: 'chalkboard-teacher', description: t('dashboard.features.teacherTools.description') },
    { id: 'arena', title: t('dashboard.features.arena.title'), icon: 'gamepad', description: t('dashboard.features.arena.description') },
    { id: 'aiQuizGenerator', title: t('dashboard.features.aiQuizGenerator.title'), icon: 'magic', description: t('dashboard.features.aiQuizGenerator.description') },
    { id: 'reportCard', title: t('dashboard.features.reportCard.title'), icon: 'file-alt', description: t('dashboard.features.reportCard.description') },
    { id: 'myAttendance', title: t('dashboard.features.myAttendance.title'), icon: 'calendar-check', description: t('dashboard.features.myAttendance.description') },
    { id: 'myTimetable', title: t('dashboard.features.myTimetable.title'), icon: 'clock', description: t('dashboard.features.myTimetable.description') },
    { id: 'timetableEditor', title: t('dashboard.features.timetableEditor.title'), icon: 'table', description: t('dashboard.features.timetableEditor.description') },
    { id: 'bellSchedule', title: t('dashboard.features.bellSchedule.title'), icon: 'bell', description: t('dashboard.features.bellSchedule.description') },
    { id: 'substitutions', title: t('dashboard.features.substitutions.title'), icon: 'user-clock', description: t('dashboard.features.substitutions.description') },
    { id: 'rooms', title: t('dashboard.features.rooms.title'), icon: 'door-open', description: t('dashboard.features.rooms.description') },
    { id: 'gradingScale', title: t('dashboard.features.gradingScale.title'), icon: 'sliders-h', description: t('dashboard.features.gradingScale.description') },
    { id: 'markMyAttendance', title: t('dashboard.features.markMyAttendance.title'), icon: 'map-marker-alt', description: t('dashboard.features.markMyAttendance.description') },
    { id: 'staffAttendance', title: t('dashboard.features.staffAttendance.title'), icon: 'clipboard-check', description: t('dashboard.features.staffAttendance.description') },
    { id: 'registrationInbox', title: t('dashboard.features.registrationInbox.title'), icon: 'user-check', description: t('dashboard.features.registrationInbox.description') },
    { id: 'attendanceDevices', title: t('dashboard.features.attendanceDevices.title'), icon: 'id-card', description: t('dashboard.features.attendanceDevices.description') },
    { id: 'attendanceExport', title: t('dashboard.features.attendanceExport.title'), icon: 'file-excel', description: t('dashboard.features.attendanceExport.description') },
    { id: 'schoolLocation', title: t('dashboard.features.schoolLocation.title'), icon: 'map-marked-alt', description: t('dashboard.features.schoolLocation.description') },
    { id: 'idCards', title: t('dashboard.features.idCards.title'), icon: 'id-badge', description: t('dashboard.features.idCards.description') },
    { id: 'activityLog', title: t('dashboard.features.activityLog.title'), icon: 'history', description: t('dashboard.features.activityLog.description') },
    { id: 'aiMisuseLog', title: t('dashboard.features.aiMisuseLog.title'), icon: 'user-shield', description: t('dashboard.features.aiMisuseLog.description') },
    { id: 'attendance', title: t('dashboard.features.attendance.title'), icon: 'clipboard-check', description: t('dashboard.features.attendance.description') },
    { id: 'vendorsExpenses', title: t('dashboard.features.vendorsExpenses.title'), icon: 'truck', description: t('dashboard.features.vendorsExpenses.description') },
    { id: 'academics', title: t('dashboard.features.academics.title'), icon: 'book', description: t('dashboard.features.academics.description') },
    { id: 'reports', title: t('dashboard.features.reports.title'), icon: 'chart-bar', description: t('dashboard.features.reports.description') },
    { id: 'transport', title: t('dashboard.features.transport.title'), icon: 'bus', description: t('dashboard.features.transport.description') },
    { id: 'holidays', title: t('dashboard.features.holidays.title'), icon: 'calendar-day', description: t('dashboard.features.holidays.description') },
    { id: 'schoolBus', title: t('dashboard.features.schoolBus.title'), icon: 'bus', description: t('dashboard.features.schoolBus.description') },
  ];

  const adminFeatures = ADMIN_HOME_FEATURES.flatMap((id) => featureActions.filter((feature) => feature.id === id)).map((feature) =>
    ADMIN_COPY_IDS.includes(feature.id)
      ? { ...feature, title: t(`dashboard.adminCopy.${feature.id}.title`), description: t(`dashboard.adminCopy.${feature.id}.description`) }
      : feature,
  );

  // Teachers and students: the full feature list, narrowed per role.
  const roleFeatures = featureActions
    .filter((feature) => FEATURE_FLAGS.videoCalls || feature.id !== 'calls')
    .filter((feature) => FEATURE_FLAGS.resourceHub || feature.id !== 'resources')
    .filter((feature) => !isPublic || feature.id === 'resources' || feature.id === 'gamification')
    // Students reach Fees and Timetable from the bottom tab bar, so drop the duplicate tiles.
    .filter((feature) => !(isStudent && (feature.id === 'fees' || feature.id === 'myTimetable')))
    .filter((feature) => {
      if (STUDENT_ONLY_FEATURES.includes(feature.id)) return session.ownerType === 'STUDENT';
      if (TEACHER_AND_STUDENT_FEATURES.includes(feature.id)) return isTeacher || isStudent;
      if (ADMIN_ONLY_FEATURES.includes(feature.id)) return session.role === 'ADMIN';
      if (TEACHER_ONLY_FEATURES.includes(feature.id)) return session.role === 'TEACHER';
      if (isStudent && STUDENT_HIDDEN_FEATURES.includes(feature.id)) return false;
      if (isTeacher && TEACHER_HIDDEN_FEATURES.includes(feature.id)) return false;
      return true;
    })
    // My Class is only scoped to the student's own class-section once it's loaded - rather than
    // briefly showing a tile that would route somewhere before we know where.
    .filter((feature) => !(isStudent && (feature.id === 'classes' || feature.id === 'resources') && !myClassSection))
    .sort((a, b) => {
      const order = isStudent ? STUDENT_TILE_ORDER : isTeacher ? TEACHER_TILE_ORDER : [];
      return tileRank(order, a.id) - tileRank(order, b.id);
    })
    .map((feature) => {
      if (isStudent) {
        return STUDENT_COPY_IDS.includes(feature.id)
          ? { ...feature, title: t(`dashboard.studentCopy.${feature.id}.title`), description: t(`dashboard.studentCopy.${feature.id}.description`) }
          : feature;
      }
      if (isTeacher) return applyRoleCopy(feature, TEACHER_COPY);
      return feature;
    });

  const visibleFeatures = session.role === 'ADMIN' ? adminFeatures : roleFeatures;

  useEffect(() => {
    getSchool(schoolId)
      .then(setSchool)
      .catch(() => setSchool(null));
  }, [schoolId]);

  useEffect(() => {
    if (session.ownerType === 'EMPLOYEE') {
      getEmployee(schoolId, session.ownerId)
        .then((owner) => {
          setMyName(owner.name);
        })
        .catch(() => setMyName(null));
      if (session.role === 'TEACHER') {
        listClassSections(schoolId)
          .then((sections) => setMyHomeroomSection(sections.find((cs) => cs.classTeacherId === session.ownerId) ?? null))
          .catch(() => setMyHomeroomSection(null));
      }
      return;
    }
    getStudent(schoolId, session.ownerId)
      .then((student) => {
        setMyName(student.name);
        if (!student.classSectionId) return;
        getClassSection(schoolId, student.classSectionId)
          .then(setMyClassSection)
          .catch(() => setMyClassSection(null));
      })
      .catch(() => setMyName(null));
  }, [schoolId, session.ownerId, session.ownerType, session.role]);

  // Only the admin sees the school-wide counts, so other logins don't fetch the student count, the
  // staff roster or the vendor list (admin-only on the server) for cards they never see.
  useEffect(() => {
    if (!isAdmin) return;
    const load = () => {
      setLoadingCounts(true);
      Promise.allSettled([
        listStudents(schoolId, 0, 1)
          .then((res) => setCounts((prev) => ({ ...prev, students: res.totalElements })))
          .catch(() => setCounts((prev) => ({ ...prev, students: null }))),
        listAllEmployees(schoolId)
          .then((rows) => {
            setCounts((prev) => ({ ...prev, employees: rows.filter(isActiveEmployee).length }));
            setEmployees(rows);
          })
          .catch(() => setCounts((prev) => ({ ...prev, employees: null }))),
        // The school's counts and location feed the setup checklist, so they refresh on every return.
        getSchool(schoolId)
          .then(setSchool)
          .catch(() => undefined),
        listVendors(schoolId)
          .then((rows) => setCounts((prev) => ({ ...prev, vendors: rows.length })))
          .catch(() => setCounts((prev) => ({ ...prev, vendors: null }))),
      ]).finally(() => setLoadingCounts(false));
      const today = todayIso();
      getUncoveredPeriods(schoolId, today)
        .then((rows) => setCoverNeeded(coverCount(rows)))
        .catch(() => setCoverNeeded(null));
      getStaffAttendanceRoster(schoolId, today)
        .then((roster) => setStaffToday({ present: staffPresentCount(roster.entries), total: roster.entries.length }))
        .catch(() => setStaffToday(undefined));
      getDayBook(schoolId, today)
        .then((book) => setCollectedToday(book.totalInflow))
        .catch(() => setCollectedToday(undefined));
    };
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [schoolId, navigation, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    AsyncStorage.multiGet([setupDismissedKey(schoolId), parentsToldKey(schoolId)])
      .then(([[, dismissed], [, told]]) => {
        setSetupDismissed(dismissed === '1');
        setParentsTold(told === '1');
      })
      .catch(() => setSetupDismissed(false));
  }, [schoolId, isAdmin]);

  const steps = setupSteps(school, employees, parentsTold);
  // Only once the school and roster are known - otherwise an established school would see the card flash.
  const showSetup = isAdmin && !setupDismissed && school !== null && employees !== null && !setupComplete(steps);

  const dismissSetup = () => {
    setSetupDismissed(true);
    AsyncStorage.setItem(setupDismissedKey(schoolId), '1').catch(() => undefined);
  };

  const tellParents = async () => {
    try {
      const result = await Share.share({ message: t('setup.parentsMessage', { school: school?.name ?? t('dashboard.fallbackTitle') }) });
      if (result.action === Share.dismissedAction) return;
      setParentsTold(true);
      AsyncStorage.setItem(parentsToldKey(schoolId), '1').catch(() => undefined);
    } catch {
      // The share sheet failing to open is not worth an error; the row just stays open.
    }
  };

  const openSetupStep = (id: SetupStepId) => {
    if (id === 'classes') navigation.navigate('ClassSetup');
    else if (id === 'students') navigation.navigate('StudentImport');
    else if (id === 'teachers') navigation.navigate('TeacherSetup');
    else if (id === 'location') navigation.navigate('SchoolLocationSettings');
    else tellParents();
  };

  const heroStats: HeroStat[] = [
    {
      label: t('dashboard.today.students'),
      value: loadingCounts && counts.students === null ? null : counts.students === null ? undefined : counts.students.toLocaleString('en-IN'),
      hint: t('dashboard.today.staffAndVendors', { staff: counts.employees ?? '—', vendors: counts.vendors ?? '—' }),
    },
    {
      label: t('dashboard.today.staffIn'),
      value: staffToday === null ? null : staffToday === undefined ? undefined : `${staffToday.present}/${staffToday.total}`,
      hint: staffToday ? t('dashboard.today.staffAway', { count: staffToday.total - staffToday.present }) : undefined,
    },
    {
      label: t('dashboard.today.collected'),
      value: collectedToday === null ? null : collectedToday === undefined ? undefined : compactInr(collectedToday),
      hint: t('dashboard.today.collectedHint'),
    },
  ];

  const openAskAi = () => navigation.navigate('HelpdeskBot');
  const tabs: HomeTab[] = isAdmin
    ? [
        { key: 'home', label: t('dashboard.tabs.home'), icon: 'home' },
        { key: 'classes', label: t('dashboard.tabs.classes'), icon: 'chalkboard', onPress: () => navigation.navigate('ClassesList') },
        { key: 'fees', label: t('dashboard.tabs.fees'), icon: 'rupee-sign', onPress: () => navigation.navigate('FeesHub') },
        { key: 'people', label: t('dashboard.tabs.people'), icon: 'users', onPress: () => navigation.navigate('EmployeesList') },
        { key: 'ai', label: t('dashboard.tabs.askAi'), icon: 'robot', onPress: openAskAi },
      ]
    : isTeacher
      ? [
          { key: 'home', label: t('dashboard.tabs.home'), icon: 'home' },
          { key: 'classes', label: t('dashboard.tabs.classes'), icon: 'chalkboard', onPress: () => navigation.navigate('ClassesList', { homeroom: myHomeroomSection ?? undefined }) },
          { key: 'timetable', label: t('dashboard.tabs.timetable'), icon: 'clock', onPress: () => navigation.navigate('MyTimetable') },
          { key: 'students', label: t('dashboard.tabs.students'), icon: 'user-graduate', onPress: () => navigation.navigate('MyStudents') },
          { key: 'ai', label: t('dashboard.tabs.askAi'), icon: 'robot', onPress: openAskAi },
        ]
      : isPublic
        ? [{ key: 'home', label: t('dashboard.tabs.home'), icon: 'home' }]
        : [
            { key: 'home', label: t('dashboard.tabs.home'), icon: 'home' },
            { key: 'timetable', label: t('dashboard.tabs.timetable'), icon: 'clock', onPress: () => navigation.navigate('MyTimetable') },
            { key: 'fees', label: t('dashboard.tabs.fees'), icon: 'rupee-sign', onPress: () => navigation.navigate('MyFees') },
            { key: 'messages', label: t('dashboard.tabs.messages'), icon: 'comment-dots', onPress: () => navigation.navigate('ConversationsList') },
            { key: 'ai', label: t('dashboard.tabs.askAi'), icon: 'robot', onPress: openAskAi },
          ];

  const greeting = t('dashboard.welcome', { name: myName ?? session.username });

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={greeting}
        subtitle={isPublic ? t('publicLogin.learnerTag') : (school?.name ?? t('dashboard.fallbackTitle'))}
        showBadge={false}
        rightAction={
          <View style={styles.headerActions}>
            {!isStudent && (
              <>
                <Pressable
                  style={styles.headerChatButton}
                  onPress={() => navigation.navigate('GlobalSearch')}
                  accessibilityLabel="Search"
                >
                  <FontAwesome5 name="search" size={18} color={colors.textPrimary} />
                </Pressable>
                <Pressable
                  style={styles.headerChatButton}
                  onPress={() => navigation.navigate('ConversationsList')}
                  accessibilityLabel="Messages"
                >
                  <FontAwesome5 name="comment-dots" size={18} color={colors.textPrimary} />
                </Pressable>
              </>
            )}
            <Pressable
              style={styles.headerChatButton}
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Profile"
            >
              <FontAwesome5 name="user" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        }
      >
        <Text style={styles.headerDate}>{longDate(new Date(), language)}</Text>
      </ScreenHeader>
      <ScreenContainer contentContainerStyle={styles.scrollContent}>
        {isAdmin && <HeroCard stats={heroStats} tint="violet" />}
        {isAdmin && (
          <Pressable
            style={[styles.coverStrip, !coverNeeded && styles.coverStripCalm]}
            onPress={() => navigation.navigate('Substitutions')}
            accessibilityRole="button"
          >
            <View style={styles.coverNumber}>
              <Text style={[styles.coverNumberText, !coverNeeded && { color: tints.mint.fg }]}>{coverNeeded === null ? '—' : coverNeeded}</Text>
            </View>
            <View style={styles.listText}>
              <Text style={styles.listTitle}>{coverNeeded ? t('dashboard.cover.needed', { count: coverNeeded }) : t('dashboard.today.allCovered')}</Text>
              <Text style={[styles.coverHint, !coverNeeded && { color: tints.mint.fg }]}>{coverNeeded ? t('dashboard.today.actNow') : t('dashboard.features.substitutions.description')}</Text>
            </View>
            <Text style={styles.listChevron}>›</Text>
          </Pressable>
        )}
        <NotificationPermissionPrompt />
        {showSetup && <SetupChecklistCard steps={steps} onStep={openSetupStep} onDismiss={dismissSetup} />}

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard.needsYou')}</Text>
            <View style={styles.listCard}>
              <Pressable style={styles.listRow} onPress={() => navigation.navigate('Substitutions')} accessibilityRole="button">
                <View style={[styles.listIcon, !!coverNeeded && styles.listIconAlert]}>
                  <FontAwesome5 name="user-clock" size={16} color={coverNeeded ? colors.warning : colors.primary} />
                </View>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>
                    {coverNeeded ? t('dashboard.cover.needed', { count: coverNeeded }) : t('dashboard.cover.arrange')}
                  </Text>
                  <Text style={styles.listDescription}>{t('dashboard.features.substitutions.description')}</Text>
                </View>
                <Text style={styles.listChevron}>›</Text>
              </Pressable>
              <Pressable style={[styles.listRow, styles.listRowLast]} onPress={() => navigation.navigate('StaffAttendance')} accessibilityRole="button">
                <View style={styles.listIcon}>
                  <FontAwesome5 name="clipboard-check" size={16} color={colors.primary} />
                </View>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{t('dashboard.features.staffAttendance.title')}</Text>
                  <Text style={styles.listDescription}>{t('dashboard.features.staffAttendance.description')}</Text>
                </View>
                <Text style={styles.listChevron}>›</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>{isAdmin ? t('dashboard.allTools') : t('dashboard.quickActions')}</Text>
        <View style={styles.tileGrid}>
          {/* AI Tutor (student): first on a school student's grid; the tile itself says when it is premium. */}
          {isStudent && !isPublic && <TutorTile schoolId={schoolId} onPress={() => navigation.navigate('TutorChapters')} />}
          {visibleFeatures.map((feature, index) => (
            <FeatureTile
              key={feature.id}
              feature={feature}
              tint={tintAt(index)}
              onPress={() => {
                const adminSection = session.role === 'ADMIN' ? ADMIN_SECTIONS[feature.id] : undefined;
                if (adminSection) {
                  navigation.navigate('SectionHub', { section: adminSection });
                  return;
                }
                if (isStudent && myClassSection && feature.id === 'resources') {
                  navigation.navigate('Resources', { classSection: myClassSection });
                  return;
                }
                if (isStudent && myClassSection && feature.id === 'classes') {
                  navigation.navigate('SectionDetail', { classSection: myClassSection });
                  return;
                }
                if (isStudent && feature.id === 'fees') {
                  navigation.navigate('MyFees');
                  return;
                }
                if (isStudent && feature.id === 'reportCard') {
                  navigation.navigate('ReportCard', {
                    student: { id: session.ownerId, name: myName ?? session.username },
                  });
                  return;
                }
                if (isStudent && feature.id === 'myAttendance') {
                  navigation.navigate('AttendanceHistory', {
                    student: { id: session.ownerId, name: myName ?? session.username },
                  });
                  return;
                }
                if (isTeacher && feature.id === 'students') {
                  navigation.navigate('MyStudents');
                  return;
                }
                if (isTeacher && feature.id === 'classes') {
                  navigation.navigate('ClassesList', { homeroom: myHomeroomSection ?? undefined });
                  return;
                }
                navigation.navigate(featureRoutes[feature.id] as never);
              }}
            />
          ))}
        </View>
      </ScreenContainer>
      <HomeTabBar tabs={tabs} activeKey="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerChatButton: { ...headerButtonStyle, width: 40, height: 40, borderRadius: 14 },
  headerDate: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  scrollContent: { paddingBottom: spacing.xl },
  coverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: tints.marigold.bg,
    borderRadius: radius.xl,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  coverStripCalm: { backgroundColor: tints.mint.bg },
  coverNumber: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  coverNumberText: { fontFamily: fonts.heading, fontSize: 18, color: tints.marigold.fg },
  coverHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: tints.marigold.fg, marginTop: 1 },
  sectionTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  listRowLast: { borderBottomWidth: 0 },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: tints.violet.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  listIconAlert: { backgroundColor: tints.marigold.bg },
  listText: { flex: 1 },
  listTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  listDescription: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.textSecondary, marginTop: 1 },
  listChevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
