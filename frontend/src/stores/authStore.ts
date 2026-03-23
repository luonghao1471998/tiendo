import { create } from 'zustand'

import client, { getAuthToken, setAuthToken } from '@/api/client'

type ApiResponse<T> = {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

type UserProject = {
  id: number
  name: string
  role: 'project_manager' | 'field_team' | 'viewer'
}

export type AuthUser = {
  id: number
  name: string
  email: string
  role: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null
  /** Đường dẫn tương đối `/storage/...` từ API */
  avatar_url?: string | null
  /** User mới từ lời mời (mật khẩu tạm) — bắt buộc đổi trước khi dùng app */
  must_change_password?: boolean
  projects: UserProject[]
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  loading: boolean
}

type AuthActions = {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  me: () => Promise<void>
  initSession: () => Promise<void>
  hasProjectRole: (projectId: string | number, roles?: string[]) => boolean
}

const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  token: getAuthToken(),
  loading: false,

  async login(email, password) {
    // Do NOT set global loading here — that would unmount the Login page
    // and cause setError() in the catch to be called on an unmounted component.
    // Login.tsx uses its own local loading state instead.
    const resp = (await client.post('/auth/login', { email, password })) as {
      data: ApiResponse<{ token: string; expires_at: string; user: AuthUser }>
    }

    const token = resp.data.data.token
    const user = resp.data.data.user
    setAuthToken(token)
    set({ token, user })
    await get().me()
  },

  async logout() {
    const token = get().token
    set({ loading: true })
    try {
      if (token) {
        await client.post('/auth/logout')
      }
    } finally {
      setAuthToken(null)
      set({ token: null, user: null, loading: false })
    }
  },

  async me() {
    set({ loading: true })
    try {
      const resp = (await client.get('/auth/me')) as {
        data: ApiResponse<AuthUser>
      }
      set({ user: resp.data.data })
    } finally {
      set({ loading: false })
    }
  },

  async initSession() {
    const token = getAuthToken()
    if (!token) {
      set({ token: null, user: null })
      return
    }

    set({ token })
    try {
      await get().me()
    } catch {
      setAuthToken(null)
      set({ token: null, user: null })
    }
  },

  hasProjectRole(projectId, roles) {
    if (!roles?.length) {
      return false
    }

    const { user } = get()
    if (!user) {
      return false
    }

    if (user.role === 'admin') {
      return true
    }

    const membership = user.projects.find((project) => String(project.id) === String(projectId))
    if (!membership) {
      return false
    }

    return roles.includes(membership.role)
  },
}))

export default useAuthStore

