import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ParentHomeScreen } from '../screens/ParentHomeScreen';
import { AnnouncementsScreen } from '../screens/principal/AnnouncementsScreen';
import { AttendanceHistoryScreen } from '../screens/principal/AttendanceHistoryScreen';
import { ChildDashboardScreen } from '../screens/principal/ChildDashboardScreen';
import { ChildFeesScreen } from '../screens/principal/ChildFeesScreen';
import { FeeAssessmentDetailScreen } from '../screens/principal/FeeAssessmentDetailScreen';
import { PaymentReceiptScreen } from '../screens/principal/PaymentReceiptScreen';
import { StudentFeePaymentsScreen } from '../screens/principal/StudentFeePaymentsScreen';
import { IdCardScreen } from '../screens/principal/IdCardScreen';
import { ConversationsListScreen } from '../screens/principal/ConversationsListScreen';
import { ConversationThreadScreen } from '../screens/principal/ConversationThreadScreen';
import { NewConversationScreen } from '../screens/principal/NewConversationScreen';
import { NotificationsScreen } from '../screens/principal/NotificationsScreen';
import { PushDebugScreen } from '../screens/principal/PushDebugScreen';
import { MyTimetableScreen } from '../screens/principal/MyTimetableScreen';
import { OverallStatusScreen } from '../screens/principal/OverallStatusScreen';
import { ReportCardScreen } from '../screens/principal/ReportCardScreen';
import { MyBusScreen } from '../screens/transport/MyBusScreen';
// AI Tutor (parent)
import { TutorParentReportScreen } from '../screens/principal/TutorParentReportScreen';
import { TutorTranscriptScreen } from '../screens/principal/TutorTranscriptScreen';
// end AI Tutor (parent)
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

export function ParentNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ParentHome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
      <Stack.Screen name="ChildDashboard" component={ChildDashboardScreen} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="ChildFees" component={ChildFeesScreen} />
      <Stack.Screen name="FeeAssessmentDetail" component={FeeAssessmentDetailScreen} />
      <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
      <Stack.Screen name="StudentFeePayments" component={StudentFeePaymentsScreen} />
      <Stack.Screen name="ReportCard" component={ReportCardScreen} />
      <Stack.Screen name="OverallStatus" component={OverallStatusScreen} />
      <Stack.Screen name="IdCard" component={IdCardScreen} />
      <Stack.Screen name="ConversationsList" component={ConversationsListScreen} />
      <Stack.Screen name="NewConversation" component={NewConversationScreen} />
      <Stack.Screen name="ConversationThread" component={ConversationThreadScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PushDebug" component={PushDebugScreen} />
      <Stack.Screen name="MyTimetable" component={MyTimetableScreen} />
      <Stack.Screen name="MyBus" component={MyBusScreen} />
      {/* AI Tutor (parent) */}
      <Stack.Screen name="TutorParentReport" component={TutorParentReportScreen} />
      <Stack.Screen name="TutorTranscript" component={TutorTranscriptScreen} />
      {/* end AI Tutor (parent) */}
    </Stack.Navigator>
  );
}
