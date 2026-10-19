import type { AttendanceStatus, FeeAssessment, StudentAttendanceHistory } from '../api/types';
import { isBillCancelled } from './feeBills';

/** What the child still owes across open bills, and the earliest due date among them. */
export function feeDueSummary(bills: readonly FeeAssessment[]): { due: number; earliestDueDate: string | null } {
  let due = 0;
  let earliestDueDate: string | null = null;
  for (const bill of bills) {
    if (isBillCancelled(bill) || bill.remainingDue <= 0) continue;
    due += bill.remainingDue;
    if (bill.dueDate && (earliestDueDate === null || bill.dueDate < earliestDueDate)) earliestDueDate = bill.dueDate;
  }
  return { due, earliestDueDate };
}

/** The child's attendance status on `date`, or null when nothing is marked yet. */
export function statusOn(history: StudentAttendanceHistory | null, date: string): AttendanceStatus | null {
  return history?.records.find((r) => r.attendanceDate === date)?.status ?? null;
}
