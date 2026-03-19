import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import useAuthStore from '@/stores/authStore'

export default function AppShell() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <NavLink to="/projects" className="text-lg font-semibold">
              TienDo
            </NavLink>

            <nav className="flex items-center gap-2 text-sm">
              <MainNavLink to="/projects">Dự án</MainNavLink>
              <MainNavLink to="/notifications">Thông báo</MainNavLink>
              {user?.role === 'admin' ? <MainNavLink to="/admin/users">Người dùng</MainNavLink> : null}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{user?.name ?? 'User'}</p>
              <p>{user?.email ?? ''}</p>
            </div>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  )
}

function MainNavLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
      }
    >
      {children}
    </NavLink>
  )
}
