import { api } from './client';
import type { Credential, CredentialRequest, StaffRole } from './types';

export function createEmployeeCredential(schoolId: string, employeeId: string, req: CredentialRequest) {
  return api.post<Credential>(`/api/v1/employees/${employeeId}/credentials`, req, schoolId);
}

export function createStudentCredential(schoolId: string, studentId: string, req: CredentialRequest) {
  return api.post<Credential>(`/api/v1/students/${studentId}/credentials`, req, schoolId);
}

/** Admin only: make a staff member an admin, or a teacher again. A staff member with no login yet gets one on their phone. */
export function setEmployeeRole(schoolId: string, employeeId: string, role: StaffRole) {
  return api.put<Credential>(`/api/v1/employees/${employeeId}/role`, { role }, schoolId);
}
