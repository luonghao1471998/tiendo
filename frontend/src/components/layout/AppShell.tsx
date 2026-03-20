import { useEffect, useState } from 'react'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import client from '@/api/client'
import useAuthStore from '@/stores/authStore'

// ─── Unread count hook ────────────────────────────────────────────────────────

function useUnreadCount() {
  const [count, setCount] = useState(0)
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return

    const poll = async () => {
      try {
        const resp = (await client.get('/notifications/unread-count')) as {
          data: { success: boolean; data: { count: number } }
        }
        setCount(resp.data.data.count ?? 0)
      } catch {
        // silent
      }
    }

    void poll()
    const id = setInterval(() => { void poll() }, 60_000)
    return () => clearInterval(id)
  }, [token])

  return count
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-bold text-white ring-2 ring-white/30">
      {initials || '?'}
    </div>
  )
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const unread = useUnreadCount()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const closeMobile = () => setMobileOpen(false)

  const navLinks = [
    { to: '/projects', label: 'Dự án' },
    ...(user?.role === 'admin' ? [{ to: '/admin/users', label: 'Người dùng' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="h-14 bg-[#FF7F29] shadow-sm">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          {/* Logo */}
          <NavLink
            to="/projects"
            className="flex items-center gap-2 text-base font-bold text-white hover:text-white/90"
            onClick={closeMobile}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-sm font-black">
              T
            </span>
            TienDo
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {navLinks.map((l) => (
              <MainNavLink key={l.to} to={l.to}>{l.label}</MainNavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Bell */}
            <NavLink
              to="/notifications"
              onClick={closeMobile}
              className={({ isActive }) =>
                `relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all duration-150 ${
                  isActive ? 'bg-white/25' : 'hover:bg-white/15'
                }`
              }
              title="Thông báo"
            >
              <Bell size={18} className="text-white" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </NavLink>

            {/* User info + avatar — desktop */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="text-right text-xs">
                <p className="font-semibold text-white leading-tight">{user?.name ?? 'User'}</p>
                <p className="text-white/70 leading-tight hidden md:block">{user?.email ?? ''}</p>
              </div>
              <Avatar name={user?.name ?? '?'} />
            </div>

            {/* Logout — desktop */}
            <button
              className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-sm text-white transition-all duration-150 hover:bg-white/10 sm:flex"
              onClick={() => void handleLogout()}
              title="Đăng xuất"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/40 text-white transition-all duration-150 hover:bg-white/10 md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen ? (
          <div className="border-t border-white/20 bg-[#E5691D] px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-1 pt-3">
              {navLinks.map((l) => (
                <MobileNavLink key={l.to} to={l.to} onClick={closeMobile}>{l.label}</MobileNavLink>
              ))}
              <button
                className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-white/40 px-4 py-2.5 text-sm text-white hover:bg-white/10"
                onClick={() => { closeMobile(); void handleLogout() }}
              >
                <LogOut size={14} />
                Đăng xuất ({user?.name ?? ''})
              </button>
            </nav>
          </div>
        ) : null}
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
        `cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
          isActive ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function MobileNavLink({ to, children, onClick }: { to: string; children: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
          isActive ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
