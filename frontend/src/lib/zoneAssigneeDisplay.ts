import type { Zone } from '@/stores/canvasStore'

/** Thành viên dự án (tối thiểu để map assigned_user_id → tên). */
export type AssigneeMember = { user: { id: number; name: string } }

/**
 * SPEC PATCH-07: hiển thị phụ trách — ưu tiên nhãn `assignee`, sau đó tên user theo `assigned_user_id`.
 */
export function resolveZoneAssigneeDisplay(
  zone: Pick<Zone, 'assignee' | 'assigned_user_id'>,
  members: AssigneeMember[] | null | undefined,
): string {
  const label = zone.assignee?.trim()
  if (label) return label
  if (zone.assigned_user_id != null) {
    const m = members?.find((x) => x.user.id === zone.assigned_user_id)
    if (m) return m.user.name
    return `Thành viên #${zone.assigned_user_id}`
  }
  return ''
}
