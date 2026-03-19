import { create } from 'zustand'

type MasterLayer = {
  id: number | string
  code?: string
}

type Project = {
  id: number | string
  name?: string
  code?: string
}

type Layer = {
  id: number | string
  code?: string
}

type ProjectState = {
  projects: Project[]
  currentProjectId: Project['id'] | null
  masterLayer: MasterLayer | null
  layer: Layer | null
  loading: boolean
}

type ProjectActions = {
  setCurrentProject: (projectId: Project['id']) => void
  setMasterLayer: (masterLayer: MasterLayer | null) => void
  setLayer: (layer: Layer | null) => void
}

const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  projects: [],
  currentProjectId: null,
  masterLayer: null,
  layer: null,
  loading: false,

  setCurrentProject(projectId) {
    set({ currentProjectId: projectId })
  },

  setMasterLayer(masterLayer) {
    set({ masterLayer })
  },

  setLayer(layer) {
    set({ layer })
  },
}))

export default useProjectStore

