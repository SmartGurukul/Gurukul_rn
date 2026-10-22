import { api } from './client';
import type {
  Announcement,
  AnnouncementAudiences,
  BotAction,
  ChatContact,
  Conversation,
  CreateAnnouncementRequest,
  CreateConversationRequest,
  MessageHistoryResponse,
  PresignChatAttachmentRequest,
  PresignChatAttachmentResponse,
} from './types';

export function listConversations(schoolId: string) {
  return api.get<Conversation[]>('/api/v1/chat/conversations', schoolId);
}

/**
 * Who the caller may start a parent-staff chat with: for a parent, their children's teachers and
 * the school's admins; for staff, parents of their students (any parent, for an admin).
 */
export function listChatContacts(schoolId: string) {
  return api.get<ChatContact[]>('/api/v1/chat/contacts', schoolId);
}

export function createConversation(schoolId: string, req: CreateConversationRequest) {
  return api.post<Conversation>('/api/v1/chat/conversations', req, schoolId);
}

/** Gets (or creates, on first use) the caller's own private Helpdesk BOT conversation. */
export function getOrCreateBotConversation(schoolId: string) {
  return api.post<Conversation>('/api/v1/chat/bot/conversation', {}, schoolId);
}

/**
 * Saves a helpdesk-bot proposal (admin only, and only the admin who asked). The answer is the
 * action as it is now: EXECUTED, or FAILED with a reason - nothing is saved then. A proposal that
 * isn't waiting any more is a 409 BOT_ACTION_NOT_PENDING whose `data` is the current action.
 */
export function confirmBotAction(schoolId: string, actionId: string) {
  return api.post<BotAction>(`/api/v1/chat/bot/actions/${actionId}/confirm`, undefined, schoolId);
}

/** Cancels a waiting helpdesk-bot proposal; nothing is saved. Same errors as confirmBotAction. */
export function cancelBotAction(schoolId: string, actionId: string) {
  return api.post<BotAction>(`/api/v1/chat/bot/actions/${actionId}/cancel`, undefined, schoolId);
}

/** A helpdesk-bot proposal as it is now, to refresh a card after a lost connection. */
export function getBotAction(schoolId: string, actionId: string) {
  return api.get<BotAction>(`/api/v1/chat/bot/actions/${actionId}`, schoolId);
}

export function getConversationMessages(schoolId: string, conversationId: string, page = 0) {
  return api.get<MessageHistoryResponse>(`/api/v1/chat/conversations/${conversationId}/messages?page=${page}`, schoolId);
}

export function presignChatAttachment(
  schoolId: string,
  conversationId: string,
  req: PresignChatAttachmentRequest
) {
  return api.post<PresignChatAttachmentResponse>(
    `/api/v1/chat/conversations/${conversationId}/attachments/presign`,
    req,
    schoolId
  );
}

/**
 * Posts a notice (ADMIN or TEACHER). Saved means sent: the broadcast and the push follow on the
 * server within seconds, after the save commits. The same notice by the same person within 10
 * minutes returns the one already saved instead of a second copy, so a retry after a timeout is safe.
 */
export function createAnnouncement(schoolId: string, req: CreateAnnouncementRequest) {
  return api.post<Announcement>('/api/v1/chat/announcements', req, schoolId);
}

/**
 * Where the caller may post a notice - exactly what createAnnouncement accepts from them. ADMIN
 * and TEACHER only (403 for anyone else); an older server without it answers 404.
 */
export function getAnnouncementAudiences(schoolId: string) {
  return api.get<AnnouncementAudiences>('/api/v1/chat/announcements/audiences', schoolId);
}

export function listAnnouncements(schoolId: string, sectionId?: string, className?: string) {
  const params = new URLSearchParams();
  if (sectionId) params.set('sectionId', sectionId);
  if (className) params.set('className', className);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<Announcement[]>(`/api/v1/chat/announcements${query}`, schoolId);
}
