/**
 * Events the server pushes over socket.io. The client only listens; all writes go through REST.
 *
 *   const socket = io('http://localhost:3000', { auth: { token } });
 *   socket.on(RealtimeEvent.MESSAGE_NEW, ({ conversationId, message }) => …);
 */
export const RealtimeEvent = {
  /** `{ conversationId, message }`, sent to both participants. */
  MESSAGE_NEW: 'message:new',
  /** `{ conversationId, userId, readAt }`, sent to the other participant ("seen"). */
  CONVERSATION_READ: 'conversation:read',
  /** The full notification row, sent to its owner. */
  NOTIFICATION_NEW: 'notification:new',
} as const;

export type RealtimeEventName =
  (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export function userRoom(userId: bigint | string) {
  return `user:${userId}`;
}
