import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import AppShell from '@/components/layout/AppShell'
import AdminUsers from '@/pages/AdminUsers'
import CanvasEditor from '@/pages/CanvasEditor'
import CanvasProgress from '@/pages/CanvasProgress'
import CanvasView from '@/pages/CanvasView'
import Login from '@/pages/Login'
import MustChangePasswordPage from '@/pages/MustChangePasswordPage'
import Notifications from '@/pages/Notifications'
import ProjectDetail from '@/pages/ProjectDetail'
import ProjectList from '@/pages/ProjectList'
import ShareView from '@/pages/ShareView'
import { DocumentTitleSync } from '@/lib/documentTitle'
import useAuthStore from '@/stores/authStore'

export function App() {
  const { token, loading, initSession } = useAuthStore()

  useEffect(() => {
    void initSession()
  }, [initSession])

  // Share routes are public — render immediately without waiting for auth loading.
  // Không dùng startsWith('/share/') vì SPA có thể nằm sau base path (vd: /app/share/...).
  const isShareRoute = /\/share\/[^/?#]+/.test(window.location.pathname)

  if (loading && !isShareRoute) {
    return <div className="p-6 text-sm text-muted-foreground">Đang khởi tạo phiên làm việc...</div>
  }

  return (
    <BrowserRouter>
      <DocumentTitleSync />
      <Routes>
        <Route element={<GuestOnly token={token} />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<RequireAuth token={token} />}>
          <Route path="/account/must-change-password" element={<MustChangePasswordPage />} />
          <Route element={<BlockUntilPasswordChanged />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/layers/:layerId/editor" element={<CanvasEditor />} />
              <Route path="/projects/:id/layers/:layerId/progress" element={<CanvasProgress />} />
              <Route path="/projects/:id/layers/:layerId/view" element={<CanvasView />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>
          </Route>
        </Route>

        <Route path="/share/:token" element={<ShareView />} />
        <Route path="*" element={<Navigate to={token ? '/projects' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function RequireAuth({ token }: { token: string | null }) {
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function GuestOnly({ token }: { token: string | null }) {
  const { user } = useAuthStore()
  if (token && user?.must_change_password) {
    return <Navigate to="/account/must-change-password" replace />
  }
  if (token) {
    return <Navigate to="/projects" replace />
  }
  return <Outlet />
}

function BlockUntilPasswordChanged() {
  const { user } = useAuthStore()
  if (user?.must_change_password) {
    return <Navigate to="/account/must-change-password" replace />
  }
  return <Outlet />
}

export default App
