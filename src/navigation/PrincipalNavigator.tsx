import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdmissionDetailScreen } from '../screens/principal/AdmissionDetailScreen';
import { AdmissionsListScreen } from '../screens/principal/AdmissionsListScreen';
import { NewAdmissionScreen } from '../screens/principal/NewAdmissionScreen';
import { AssessmentDetailScreen } from '../screens/principal/AssessmentDetailScreen';
import { AssessmentFormScreen } from '../screens/principal/AssessmentFormScreen';
import { AssessmentResultsScreen } from '../screens/principal/AssessmentResultsScreen';
import { OverallStatusScreen } from '../screens/principal/OverallStatusScreen';
import { ReportCardScreen } from '../screens/principal/ReportCardScreen';
import { PublishReportCardsScreen } from '../screens/principal/PublishReportCardsScreen';
import { SectionReportCardsGridScreen } from '../screens/principal/SectionReportCardsGridScreen';
import { GradingScaleScreen } from '../screens/principal/GradingScaleScreen';
import { MarkMyAttendanceScreen } from '../screens/principal/MarkMyAttendanceScreen';
import { PushDebugScreen } from '../screens/principal/PushDebugScreen';
import { SchoolLocationSettingsScreen } from '../screens/principal/SchoolLocationSettingsScreen';
import { ClassSetupScreen } from '../screens/principal/ClassSetupScreen';
import { StudentImportScreen } from '../screens/principal/StudentImportScreen';
import { TeacherSetupScreen } from '../screens/principal/TeacherSetupScreen';
import { StaffAttendanceScreen } from '../screens/principal/StaffAttendanceScreen';
import { EmployeeAttendanceHistoryScreen } from '../screens/principal/EmployeeAttendanceHistoryScreen';
import { ActivityLogScreen } from '../screens/principal/ActivityLogScreen';
import { AiMisuseLogScreen } from '../screens/principal/AiMisuseLogScreen';
import { AttendanceDevicesScreen } from '../screens/principal/AttendanceDevicesScreen';
import { AttendanceExportScreen } from '../screens/principal/AttendanceExportScreen';
import { SchoolLogoSettingsScreen } from '../screens/principal/SchoolLogoSettingsScreen';
import { IdCardScreen } from '../screens/principal/IdCardScreen';
import { IdCardSheetsScreen } from '../screens/principal/IdCardSheetsScreen';
import { AttendanceHistoryScreen } from '../screens/principal/AttendanceHistoryScreen';
import { RegistrationInboxScreen } from '../screens/principal/RegistrationInboxScreen';
import { SectionAttendanceScreen } from '../screens/principal/SectionAttendanceScreen';
import { ClassesListScreen } from '../screens/principal/ClassesListScreen';
import { ClassmatesScreen } from '../screens/principal/ClassmatesScreen';
import { ConversationThreadScreen } from '../screens/principal/ConversationThreadScreen';
import { ConversationsListScreen } from '../screens/principal/ConversationsListScreen';
import { NewConversationScreen } from '../screens/principal/NewConversationScreen';
import { HelpdeskBotScreen } from '../screens/principal/HelpdeskBotScreen';
import { CallHistoryScreen } from '../screens/principal/CallHistoryScreen';
import { ArenaScreen } from '../screens/principal/ArenaScreen';
import { BattleRoomMatchScreen } from '../screens/principal/BattleRoomMatchScreen';
import { BattleRoomScreen } from '../screens/principal/BattleRoomScreen';
import { PracticeStartScreen } from '../screens/principal/PracticeStartScreen';
import { PracticeSessionScreen } from '../screens/principal/PracticeSessionScreen';
import { AwardRecognitionScreen } from '../screens/principal/AwardRecognitionScreen';
import { EventsListScreen } from '../screens/principal/EventsListScreen';
import { EventDetailScreen } from '../screens/principal/EventDetailScreen';
import { EventFormScreen } from '../screens/principal/EventFormScreen';
import { ChallengeDetailScreen } from '../screens/principal/ChallengeDetailScreen';
import { GamificationHubScreen } from '../screens/principal/GamificationHubScreen';
import { HouseWarsScreen } from '../screens/principal/HouseWarsScreen';
import { InCallScreen } from '../screens/principal/InCallScreen';
import { LeaderboardScreen } from '../screens/principal/LeaderboardScreen';
import { NewChallengeScreen } from '../screens/principal/NewChallengeScreen';
import { MyQuestionsScreen } from '../screens/principal/MyQuestionsScreen';
import { QuizResultsScreen } from '../screens/principal/QuizResultsScreen';
import { QuestionStatsScreen } from '../screens/principal/QuestionStatsScreen';
import { QuestionAuthorScreen } from '../screens/principal/QuestionAuthorScreen';
import { PickCallTargetScreen } from '../screens/principal/PickCallTargetScreen';
import { ScheduleCallScreen } from '../screens/principal/ScheduleCallScreen';
import { ScheduledCallsScreen } from '../screens/principal/ScheduledCallsScreen';
import { VideoCallHubScreen } from '../screens/principal/VideoCallHubScreen';
import { AcademicHelperScreen } from '../screens/principal/AcademicHelperScreen';
import { EmployeeDetailScreen } from '../screens/principal/EmployeeDetailScreen';
import { EmployeeFormScreen } from '../screens/principal/EmployeeFormScreen';
import { EmployeesListScreen } from '../screens/principal/EmployeesListScreen';
import { FeeAssessmentDetailScreen } from '../screens/principal/FeeAssessmentDetailScreen';
import { FeeAssessmentsListScreen } from '../screens/principal/FeeAssessmentsListScreen';
import { MyFeesScreen } from '../screens/principal/MyFeesScreen';
import { MyStudentsScreen } from '../screens/principal/MyStudentsScreen';
import { MyTimetableScreen } from '../screens/principal/MyTimetableScreen';
import { PeriodSetupScreen } from '../screens/principal/PeriodSetupScreen';
import { TimetableEditorScreen } from '../screens/principal/TimetableEditorScreen';
import { SubstitutionsScreen } from '../screens/principal/SubstitutionsScreen';
import { RoomsScreen } from '../screens/principal/RoomsScreen';
import { FeeCategoriesListScreen } from '../screens/principal/FeeCategoriesListScreen';
import { PayFeesScreen } from '../screens/principal/PayFeesScreen';
import { FeePaymentSettingsScreen } from '../screens/principal/FeePaymentSettingsScreen';
import { FeeStructureDetailScreen } from '../screens/principal/FeeStructureDetailScreen';
import { FeeStructureFormScreen } from '../screens/principal/FeeStructureFormScreen';
import { FeeStructuresListScreen } from '../screens/principal/FeeStructuresListScreen';
import { FeesHubScreen } from '../screens/principal/FeesHubScreen';
import { InfraCategoriesScreen } from '../screens/principal/InfraCategoriesScreen';
import { InfraExpenseDetailScreen } from '../screens/principal/InfraExpenseDetailScreen';
import { InfraExpenseFormScreen } from '../screens/principal/InfraExpenseFormScreen';
import { InfraExpensesListScreen } from '../screens/principal/InfraExpensesListScreen';
import { LedgerEntryDetailScreen } from '../screens/principal/LedgerEntryDetailScreen';
import { LedgerScreen } from '../screens/principal/LedgerScreen';
import { PayrollHubScreen } from '../screens/principal/PayrollHubScreen';
import { PayrollRunScreen } from '../screens/principal/PayrollRunScreen';
import { PayrollRunsListScreen } from '../screens/principal/PayrollRunsListScreen';
import { PayrollOverviewScreen } from '../screens/principal/PayrollOverviewScreen';
import { MyClassFeesScreen } from '../screens/principal/MyClassFeesScreen';
import { PaymentReceiptScreen } from '../screens/principal/PaymentReceiptScreen';
import { RecordPaymentScreen } from '../screens/principal/RecordPaymentScreen';
import { ReversePaymentScreen } from '../screens/principal/ReversePaymentScreen';
import { StudentFeePaymentsScreen } from '../screens/principal/StudentFeePaymentsScreen';
import { PayslipDetailScreen } from '../screens/principal/PayslipDetailScreen';
import { PrincipalDashboardScreen } from '../screens/principal/PrincipalDashboardScreen';
import { ConnectGoogleAccountScreen } from '../screens/principal/ConnectGoogleAccountScreen';
import { ProfileScreen } from '../screens/principal/ProfileScreen';
import { SwitchChildScreen } from '../screens/principal/SwitchChildScreen';
import { GlobalSearchScreen } from '../screens/principal/GlobalSearchScreen';
import { ResourceGeneratorScreen } from '../screens/principal/ResourceGeneratorScreen';
import { QuizBankReviewScreen } from '../screens/principal/QuizBankReviewScreen';
import { ResourceUploadScreen } from '../screens/principal/ResourceUploadScreen';
import { SalaryHistoryScreen } from '../screens/principal/SalaryHistoryScreen';
import { SalaryStructureFormScreen } from '../screens/principal/SalaryStructureFormScreen';
import { SalaryStructuresListScreen } from '../screens/principal/SalaryStructuresListScreen';
import { SectionAssessmentsListScreen } from '../screens/principal/SectionAssessmentsListScreen';
import { SectionDetailScreen } from '../screens/principal/SectionDetailScreen';
import { SectionStudentsListScreen } from '../screens/principal/SectionStudentsListScreen';
import { SectionSubjectsListScreen } from '../screens/principal/SectionSubjectsListScreen';
import { ResourcesScreen } from '../screens/principal/ResourcesScreen';
import { ChapterScreen } from '../screens/principal/ChapterScreen';
import { CurriculumMappingScreen } from '../screens/principal/CurriculumMappingScreen';
import { WebDocumentScreen } from '../screens/principal/WebDocumentScreen';
import { SectionsListScreen } from '../screens/principal/SectionsListScreen';
import { StudentDetailScreen } from '../screens/principal/StudentDetailScreen';
import { StudentFormScreen } from '../screens/principal/StudentFormScreen';
import { StudentsListScreen } from '../screens/principal/StudentsListScreen';
import { TeacherPerformanceScreen } from '../screens/principal/TeacherPerformanceScreen';
import { TeacherToolsHubScreen } from '../screens/principal/TeacherToolsHubScreen';
import { SectionHubScreen } from '../screens/principal/SectionHubScreen';
import { VendorDetailScreen } from '../screens/principal/VendorDetailScreen';
import { VendorFormScreen } from '../screens/principal/VendorFormScreen';
import { VendorsListScreen } from '../screens/principal/VendorsListScreen';
import { BusTripDetailScreen } from '../screens/transport/BusTripDetailScreen';
import { HolidaysScreen } from '../screens/principal/HolidaysScreen';
import { AcademicTermsScreen } from '../screens/principal/AcademicTermsScreen';
import { MyBusScreen } from '../screens/transport/MyBusScreen';
import { TransportHubScreen } from '../screens/transport/TransportHubScreen';
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

export function PrincipalNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PrincipalDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
        <Stack.Screen name="PrincipalDashboard" component={PrincipalDashboardScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="PushDebug" component={PushDebugScreen} />
        <Stack.Screen name="SwitchChild" component={SwitchChildScreen} />
        <Stack.Screen name="ConnectGoogleAccount" component={ConnectGoogleAccountScreen} />
        <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
        <Stack.Screen name="StudentsList" component={StudentsListScreen} />
        <Stack.Screen name="Classmates" component={ClassmatesScreen} />
        <Stack.Screen name="MyStudents" component={MyStudentsScreen} />
        <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
        <Stack.Screen name="StudentForm" component={StudentFormScreen} />
        <Stack.Screen name="EmployeesList" component={EmployeesListScreen} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
        <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
        <Stack.Screen name="SalaryHistory" component={SalaryHistoryScreen} />
        <Stack.Screen name="VendorsList" component={VendorsListScreen} />
        <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
        <Stack.Screen name="VendorForm" component={VendorFormScreen} />
        <Stack.Screen name="FeesHub" component={FeesHubScreen} />
        <Stack.Screen name="FeeCategoriesList" component={FeeCategoriesListScreen} />
        <Stack.Screen name="FeeStructuresList" component={FeeStructuresListScreen} />
        <Stack.Screen name="FeeStructureForm" component={FeeStructureFormScreen} />
        <Stack.Screen name="FeeStructureDetail" component={FeeStructureDetailScreen} />
        <Stack.Screen name="FeeAssessmentsList" component={FeeAssessmentsListScreen} />
        <Stack.Screen name="MyFees" component={MyFeesScreen} />
        <Stack.Screen name="FeeAssessmentDetail" component={FeeAssessmentDetailScreen} />
        <Stack.Screen name="PayFees" component={PayFeesScreen} />
        <Stack.Screen name="FeePaymentSettings" component={FeePaymentSettingsScreen} />
        <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
        <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} />
        <Stack.Screen name="ReversePayment" component={ReversePaymentScreen} />
        <Stack.Screen name="StudentFeePayments" component={StudentFeePaymentsScreen} />
        <Stack.Screen name="Ledger" component={LedgerScreen} />
        <Stack.Screen name="LedgerEntryDetail" component={LedgerEntryDetailScreen} />
        <Stack.Screen name="PayrollHub" component={PayrollHubScreen} />
        <Stack.Screen name="SalaryStructuresList" component={SalaryStructuresListScreen} />
        <Stack.Screen name="SalaryStructureForm" component={SalaryStructureFormScreen} />
        <Stack.Screen name="PayrollRunsList" component={PayrollRunsListScreen} />
        <Stack.Screen name="PayrollRun" component={PayrollRunScreen} />
        <Stack.Screen name="PayrollOverview" component={PayrollOverviewScreen} />
        <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
        <Stack.Screen name="MyClassFees" component={MyClassFeesScreen} />
        <Stack.Screen name="InfraExpensesList" component={InfraExpensesListScreen} />
        <Stack.Screen name="InfraExpenseDetail" component={InfraExpenseDetailScreen} />
        <Stack.Screen name="InfraExpenseForm" component={InfraExpenseFormScreen} />
        <Stack.Screen name="InfraCategories" component={InfraCategoriesScreen} />
        <Stack.Screen name="ClassesList" component={ClassesListScreen} />
        <Stack.Screen name="SectionsList" component={SectionsListScreen} />
        <Stack.Screen name="SectionDetail" component={SectionDetailScreen} />
        <Stack.Screen name="SectionStudentsList" component={SectionStudentsListScreen} />
        <Stack.Screen name="SectionSubjectsList" component={SectionSubjectsListScreen} />
        <Stack.Screen name="Resources" component={ResourcesScreen} />
        <Stack.Screen name="Chapter" component={ChapterScreen} />
        <Stack.Screen name="CurriculumMapping" component={CurriculumMappingScreen} />
        <Stack.Screen name="WebDocument" component={WebDocumentScreen} />
        <Stack.Screen name="SectionAssessmentsList" component={SectionAssessmentsListScreen} />
        <Stack.Screen name="AssessmentForm" component={AssessmentFormScreen} />
        <Stack.Screen name="AssessmentDetail" component={AssessmentDetailScreen} />
        <Stack.Screen name="AssessmentResults" component={AssessmentResultsScreen} />
        <Stack.Screen name="AttendanceTake" component={SectionAttendanceScreen} />
        <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
        <Stack.Screen name="RegistrationInbox" component={RegistrationInboxScreen} />
        <Stack.Screen name="ReportCard" component={ReportCardScreen} />
        <Stack.Screen name="OverallStatus" component={OverallStatusScreen} />
        <Stack.Screen name="PublishReportCards" component={PublishReportCardsScreen} />
        <Stack.Screen name="SectionReportCardsGrid" component={SectionReportCardsGridScreen} />
        <Stack.Screen name="GradingScale" component={GradingScaleScreen} />
        <Stack.Screen name="MarkMyAttendance" component={MarkMyAttendanceScreen} />
        <Stack.Screen name="SchoolLocationSettings" component={SchoolLocationSettingsScreen} />
        <Stack.Screen name="ClassSetup" component={ClassSetupScreen} />
        <Stack.Screen name="StudentImport" component={StudentImportScreen} />
        <Stack.Screen name="TeacherSetup" component={TeacherSetupScreen} />
        <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
        <Stack.Screen name="EmployeeAttendanceHistory" component={EmployeeAttendanceHistoryScreen} />
        <Stack.Screen name="AttendanceDevices" component={AttendanceDevicesScreen} />
        <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
        <Stack.Screen name="AiMisuseLog" component={AiMisuseLogScreen} />
        <Stack.Screen name="AttendanceExport" component={AttendanceExportScreen} />
        <Stack.Screen name="SchoolLogoSettings" component={SchoolLogoSettingsScreen} />
        <Stack.Screen name="IdCard" component={IdCardScreen} />
        <Stack.Screen name="IdCardSheets" component={IdCardSheetsScreen} />
        <Stack.Screen name="ConversationsList" component={ConversationsListScreen} />
        <Stack.Screen name="NewConversation" component={NewConversationScreen} />
        <Stack.Screen name="ConversationThread" component={ConversationThreadScreen} />
        <Stack.Screen name="HelpdeskBot" component={HelpdeskBotScreen} />
        <Stack.Screen name="VideoCallHub" component={VideoCallHubScreen} />
        <Stack.Screen name="PickCallTarget" component={PickCallTargetScreen} />
        <Stack.Screen name="ScheduleCall" component={ScheduleCallScreen} />
        <Stack.Screen name="ScheduledCalls" component={ScheduledCallsScreen} />
        <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
        <Stack.Screen name="InCall" component={InCallScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="GamificationHub" component={GamificationHubScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="HouseWars" component={HouseWarsScreen} />
        <Stack.Screen name="EventsList" component={EventsListScreen} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
        <Stack.Screen name="EventForm" component={EventFormScreen} />
        <Stack.Screen name="AwardRecognition" component={AwardRecognitionScreen} />
        <Stack.Screen name="Arena" component={ArenaScreen} />
        <Stack.Screen name="BattleRoomMatch" component={BattleRoomMatchScreen} />
        <Stack.Screen name="BattleRoom" component={BattleRoomScreen} />
        <Stack.Screen name="PracticeStart" component={PracticeStartScreen} />
        <Stack.Screen name="PracticeSession" component={PracticeSessionScreen} />
        <Stack.Screen name="NewChallenge" component={NewChallengeScreen} />
        <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
        <Stack.Screen name="QuestionAuthor" component={QuestionAuthorScreen} />
        <Stack.Screen name="MyQuestions" component={MyQuestionsScreen} />
        <Stack.Screen name="QuizResults" component={QuizResultsScreen} />
        <Stack.Screen name="QuestionStats" component={QuestionStatsScreen} />
        <Stack.Screen name="AcademicHelper" component={AcademicHelperScreen} />
        <Stack.Screen name="TeacherPerformance" component={TeacherPerformanceScreen} />
        <Stack.Screen name="TeacherToolsHub" component={TeacherToolsHubScreen} />
        <Stack.Screen name="SectionHub" component={SectionHubScreen} />
        <Stack.Screen name="ResourceGenerator" component={ResourceGeneratorScreen} />
        <Stack.Screen name="QuizBankReview" component={QuizBankReviewScreen} />
        <Stack.Screen name="ResourceUpload" component={ResourceUploadScreen} />
        <Stack.Screen name="NewAdmission" component={NewAdmissionScreen} />
        <Stack.Screen name="AdmissionsList" component={AdmissionsListScreen} />
        <Stack.Screen name="AdmissionDetail" component={AdmissionDetailScreen} />
        <Stack.Screen name="MyTimetable" component={MyTimetableScreen} />
        <Stack.Screen name="TimetableEditor" component={TimetableEditorScreen} />
        <Stack.Screen name="PeriodSetup" component={PeriodSetupScreen} />
        <Stack.Screen name="Substitutions" component={SubstitutionsScreen} />
        <Stack.Screen name="Rooms" component={RoomsScreen} />
        <Stack.Screen name="MyBus" component={MyBusScreen} />
        <Stack.Screen name="Holidays" component={HolidaysScreen} />
        <Stack.Screen name="AcademicTerms" component={AcademicTermsScreen} />
        <Stack.Screen name="TransportHub" component={TransportHubScreen} />
        <Stack.Screen name="BusTripDetail" component={BusTripDetailScreen} />
      </Stack.Navigator>
  );
}
