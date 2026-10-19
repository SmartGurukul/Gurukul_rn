import type { FeeAssessment, StudentAttendanceHistory } from '../api/types';
import { feeDueSummary, statusOn } from '../utils/parentHome';

const bill = (over: Partial<FeeAssessment>): FeeAssessment =>
  ({ status: 'PENDING', remainingDue: 0, dueDate: null, ...over }) as FeeAssessment;

describe('feeDueSummary', () => {
  it('sums what is still due on open bills and picks the earliest due date', () => {
    const { due, earliestDueDate } = feeDueSummary([
      bill({ remainingDue: 4200, dueDate: '2026-10-31' }),
      bill({ remainingDue: 1000, dueDate: '2026-10-15' }),
      bill({ remainingDue: 0, dueDate: '2026-09-01' }),
      bill({ remainingDue: 999, dueDate: '2026-01-01', status: 'CANCELLED' }),
    ]);
    expect(due).toBe(5200);
    expect(earliestDueDate).toBe('2026-10-15');
  });
  it('is zero with no open bills', () => {
    expect(feeDueSummary([])).toEqual({ due: 0, earliestDueDate: null });
  });
});

describe('statusOn', () => {
  const history = {
    records: [
      { attendanceDate: '2026-10-19', status: 'PRESENT' },
      { attendanceDate: '2026-10-18', status: 'ABSENT' },
    ],
  } as StudentAttendanceHistory;
  it('finds the day, and null when unmarked', () => {
    expect(statusOn(history, '2026-10-19')).toBe('PRESENT');
    expect(statusOn(history, '2026-10-17')).toBeNull();
    expect(statusOn(null, '2026-10-19')).toBeNull();
  });
});
