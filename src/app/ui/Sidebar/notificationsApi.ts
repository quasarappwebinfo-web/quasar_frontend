import { apiJson } from '@/shared/api/apiJson'

export type UserNotification = {
  id: number
  title: string
  body: string
  link?: string | null
  readAt?: string | null
  createdAt?: string | null
}

export async function listMyNotifications(): Promise<{
  notifications: UserNotification[]
  unread: number
}> {
  return apiJson('/api/v1/user/notificaciones')
}

export const NOTIFICATIONS_CHANGED = 'quasar-notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}

export async function markNotificationRead(
  notificationId: number,
): Promise<UserNotification> {
  return apiJson(`/api/v1/user/notificaciones/${notificationId}/leida`, {
    method: 'POST',
  })
}

export async function markAllNotificationsRead(): Promise<{ marked: number }> {
  return apiJson('/api/v1/user/notificaciones/leidas', { method: 'POST' })
}
