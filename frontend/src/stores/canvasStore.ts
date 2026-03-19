import { create } from 'zustand'

import client from '@/api/client'
import type { ZoneStatus, MarkStatus } from '@/lib/constants'

export type GeometryPoint = [number, number]

export type Geometry = {
  type: 'polygon' | 'rect'
  points?: GeometryPoint[]
  // rect fields
  x?: number
  y?: number
  width?: number
  height?: number
}

export type Zone = {
  id: number
  zone_code: string
  name: string
  status: ZoneStatus
  completion_pct: number
  geometry_pct: Geometry
  assignee: string | null
  assigned_user_id: number | null
  deadline: string | null
  tasks: string | null
  notes: string | null
  updated_at: string | null
}

export type Mark = {
  id: number
  zone_id: number
  status: MarkStatus
  geometry_pct: Geometry
  painted_by: number | null
  updated_at: string | null
}

type DrawMode = 'select' | 'draw_zone' | 'draw_mark' | 'edit_zone'
type DrawShape = 'polygon' | 'rect'

type CanvasState = {
  zones: Zone[]
  marks: Mark[]

  selectedZoneId: number | null
  selectedMarkId: number | null
  hoveredZoneId: number | null

  mode: DrawMode
  drawShape: DrawShape
  markStatus: MarkStatus

  filterStatus: ZoneStatus | null

  zoom: number
  panX: number
  panY: number

  lastSyncAt: string | null
  syncLoading: boolean
}

type CanvasActions = {
  fetchZonesAndMarks: (layerId: number) => Promise<void>
  syncSince: (layerId: number, since: string) => Promise<void>

  selectZone: (id: number | null) => void
  selectMark: (id: number | null) => void
  setHoveredZone: (id: number | null) => void

  setMode: (mode: DrawMode) => void
  setDrawShape: (shape: DrawShape) => void
  setMarkStatus: (status: MarkStatus) => void
  setFilterStatus: (status: ZoneStatus | null) => void

  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetViewport: () => void

  addZone: (zone: Zone) => void
  updateZone: (zone: Zone) => void
  removeZone: (id: number) => void

  addMark: (mark: Mark) => void
  updateMark: (mark: Mark) => void
  removeMark: (id: number) => void

  reset: () => void
}

const INITIAL_STATE: CanvasState = {
  zones: [],
  marks: [],
  selectedZoneId: null,
  selectedMarkId: null,
  hoveredZoneId: null,
  mode: 'select',
  drawShape: 'polygon',
  markStatus: 'in_progress',
  filterStatus: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  lastSyncAt: null,
  syncLoading: false,
}

type SyncResponse = {
  zones: Zone[]
  marks: Mark[]
  deleted_zone_ids: number[]
  deleted_mark_ids: number[]
  sync_time: string
}

type ListResponse<T> = {
  success: boolean
  data: T[]
}

const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  ...INITIAL_STATE,

  async fetchZonesAndMarks(layerId) {
    const [zonesResp, marksResp] = (await Promise.all([
      client.get(`/layers/${layerId}/zones`) as Promise<{ data: ListResponse<Zone> }>,
      // marks come per zone — we fetch a flat list from zones response
      // marks are embedded via syncSince on first load
      Promise.resolve(null),
    ]))

    const zones: Zone[] = zonesResp.data.data ?? []

    // fetch marks for each zone in parallel (flatten)
    const markArrays = await Promise.all(
      zones.map((z) =>
        (client.get(`/zones/${z.id}/marks`) as Promise<{ data: ListResponse<Mark> }>)
          .then((r) => r.data.data)
          .catch(() => [] as Mark[]),
      ),
    )
    const marks = markArrays.flat()

    set({
      zones,
      marks,
      lastSyncAt: new Date().toISOString(),
      selectedZoneId: null,
      selectedMarkId: null,
    })

    void marksResp
  },

  async syncSince(layerId, since) {
    if (get().syncLoading) return
    set({ syncLoading: true })
    try {
      const resp = (await client.get(`/layers/${layerId}/sync`, {
        params: { since },
      })) as { data: { success: boolean; data: SyncResponse } }

      const payload = resp.data.data

      set((state) => {
        // apply zone updates
        let zones = [...state.zones]
        for (const z of payload.zones) {
          const idx = zones.findIndex((x) => x.id === z.id)
          if (idx >= 0) zones[idx] = z
          else zones.push(z)
        }
        zones = zones.filter((z) => !payload.deleted_zone_ids.includes(z.id))

        // apply mark updates
        let marks = [...state.marks]
        for (const m of payload.marks) {
          const idx = marks.findIndex((x) => x.id === m.id)
          if (idx >= 0) marks[idx] = m
          else marks.push(m)
        }
        marks = marks.filter((m) => !payload.deleted_mark_ids.includes(m.id))

        return { zones, marks, lastSyncAt: payload.sync_time, syncLoading: false }
      })
    } catch {
      set({ syncLoading: false })
    }
  },

  selectZone: (id) => set({ selectedZoneId: id, selectedMarkId: null }),
  selectMark: (id) => set({ selectedMarkId: id }),
  setHoveredZone: (id) => set({ hoveredZoneId: id }),

  setMode: (mode) => set({ mode }),
  setDrawShape: (shape) => set({ drawShape: shape }),
  setMarkStatus: (status) => set({ markStatus: status }),
  setFilterStatus: (status) => set({ filterStatus: status }),

  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.1), 10) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  resetViewport: () => set({ zoom: 1, panX: 0, panY: 0 }),

  addZone: (zone) => set((state) => ({ zones: [...state.zones, zone] })),
  updateZone: (zone) =>
    set((state) => ({ zones: state.zones.map((z) => (z.id === zone.id ? zone : z)) })),
  removeZone: (id) =>
    set((state) => ({
      zones: state.zones.filter((z) => z.id !== id),
      marks: state.marks.filter((m) => m.zone_id !== id),
      selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
    })),

  addMark: (mark) => set((state) => ({ marks: [...state.marks, mark] })),
  updateMark: (mark) =>
    set((state) => ({ marks: state.marks.map((m) => (m.id === mark.id ? mark : m)) })),
  removeMark: (id) =>
    set((state) => ({
      marks: state.marks.filter((m) => m.id !== id),
      selectedMarkId: state.selectedMarkId === id ? null : state.selectedMarkId,
    })),

  reset: () => set(INITIAL_STATE),
}))

export default useCanvasStore
