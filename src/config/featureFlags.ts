/**
 * Static toggles for temporarily disabling a feature everywhere it's surfaced, without deleting
 * its code. Flip a flag back to true to fully re-enable that feature - no other changes needed.
 */
export const FEATURE_FLAGS = {
  videoCalls: false,
  // Teacher resource upload/listing. Off: its backend endpoints (TeacherResourceController) exist
  // only on the unmerged origin/vaibhav branch, not on backend main.
  teacherResources: false,
  // Student Resource Hub: the Resources card inside My Class (NCERT chapters, topics, videos).
  resourceHub: true,
} as const;
