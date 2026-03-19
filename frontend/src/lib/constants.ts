export const ZONE_STATUS = [
  'not_started',
  'in_progress',
  'completed',
  'delayed',
  'paused',
] as const

export type ZoneStatus = (typeof ZONE_STATUS)[number]

export const ZONE_STATUS_COLOR: Record<ZoneStatus, string> = {
  not_started: '#9CA3AF',
  in_progress: '#F59E0B',
  completed: '#10B981',
  delayed: '#EF4444',
  paused: '#8B5CF6',
}

export const MARK_STATUS = ['in_progress', 'completed'] as const

export type MarkStatus = (typeof MARK_STATUS)[number]

export const MARK_STATUS_COLOR: Record<MarkStatus, string> = {
  in_progress: '#F59E0B',
  completed: '#10B981',
}

