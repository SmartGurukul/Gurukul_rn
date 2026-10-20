/**
 * The single virtual "Open School" that every schoolless (public) student belongs to. Its id is
 * fixed on the backend (migration V98). A public student gets a reduced, school-name-hidden
 * experience: Resources + Gamification only. The app tells a public session apart purely by its
 * schoolId, so no extra backend field is needed.
 */
export const PUBLIC_SCHOOL_ID = '11111111-1111-4111-8111-111111111111';

export function isPublicSchool(schoolId: string | null | undefined): boolean {
  return schoolId === PUBLIC_SCHOOL_ID;
}

/** Classes a public student can pick from (CBSE grades 1-12). */
export const PUBLIC_CLASSES: number[] = Array.from({ length: 12 }, (_, i) => i + 1);
