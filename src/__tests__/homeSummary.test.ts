import type { StaffAttendanceEntry } from '../api/types';
import { compactInr, staffPresentCount } from '../utils/homeSummary';

const entry = (status: StaffAttendanceEntry['status']): StaffAttendanceEntry => ({
  employeeId: 'e',
  employeeName: 'n',
  designation: 'd',
  status,
  remarks: null,
  selfMarked: false,
  method: null,
});

describe('staffPresentCount', () => {
  it('counts present, late and half day; not absent or unmarked', () => {
    expect(staffPresentCount([entry('PRESENT'), entry('LATE'), entry('HALF_DAY'), entry('ABSENT'), entry(null)])).toBe(3);
  });
});

describe('compactInr', () => {
  it('keeps small amounts whole with Indian grouping', () => {
    expect(compactInr(0)).toBe('₹0');
    expect(compactInr(48500)).toBe('₹48,500');
    expect(compactInr(99999.6)).toBe('₹1,00,000');
  });
  it('shortens lakhs and crores to one decimal', () => {
    expect(compactInr(100000)).toBe('₹1L');
    expect(compactInr(1840000)).toBe('₹18.4L');
    expect(compactInr(23000000)).toBe('₹2.3Cr');
    expect(compactInr(-150000)).toBe('-₹1.5L');
  });
});
