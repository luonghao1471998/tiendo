import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Camera, KeyRound, LogOut, Menu, X } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import ChangePasswordModal from '@/components/account/ChangePasswordModal'
import client from '@/api/client'
import useAuthStore, { type AuthUser } from '@/stores/authStore'

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

function AvatarButton({
  name,
  avatarUrl,
  onClick,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup,
}: {
  name: string
  /** URL hiển thị (đã gắn cache-bust nếu cần) */
  avatarUrl?: string | null
  onClick: () => void
  'aria-expanded'?: boolean
  'aria-haspopup'?: boolean | 'menu'
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      title="Tài khoản"
      className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/25 text-xs font-bold text-white ring-2 ring-white/30 transition hover:ring-white/50"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || '?'
      )}
    </button>
  )
}

type AccountMenuItemsProps = {
  onChangePassword: () => void
  onPickAvatar: () => void
  onLogout: () => void
  variant?: 'popover' | 'mobile'
}

function AccountMenuItems({ onChangePassword, onPickAvatar, onLogout, variant = 'popover' }: AccountMenuItemsProps) {
  const itemClass =
    variant === 'popover'
      ? 'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#FFF3E8]'
      : 'flex w-full cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm text-white hover:bg-white/10'

  return (
    <>
      <button type="button" className={itemClass} onClick={onChangePassword}>
        <KeyRound size={16} className="shrink-0 opacity-70" />
        Đổi mật khẩu
      </button>
      <button type="button" className={itemClass} onClick={onPickAvatar}>
        <Camera size={16} className="shrink-0 opacity-70" />
        Đổi ảnh đại diện
      </button>
      <button type="button" className={itemClass} onClick={onLogout}>
        <LogOut size={16} className="shrink-0 opacity-70" />
        Đăng xuất
      </button>
    </>
  )
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const unread = useUnreadCount()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  /** Tăng sau mỗi lần upload avatar để tránh cache ảnh cũ cùng path */
  const [avatarBust, setAvatarBust] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const accountWrapRef = useRef<HTMLDivElement>(null)

  const displayAvatarUrl = useMemo((): string | null => {
    const u = user?.avatar_url
    if (!u) return null
    const sep = u.includes('?') ? '&' : '?'
    return `${u}${sep}_v=${avatarBust}`
  }, [user?.avatar_url, avatarBust])

  useEffect(() => {
    if (!accountOpen) return
    const onDoc = (e: MouseEvent) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [accountOpen])

  const handleLogout = async () => {
    setAccountOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const closeMobile = () => setMobileOpen(false)

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    try {
      // Không set Content-Type thủ công — axios tự thêm boundary; thiếu boundary khiến Laravel không nhận file.
      const resp = (await client.post('/auth/me/avatar', fd)) as { data: { success: boolean; data: AuthUser } }
      if (resp.data.success && resp.data.data) {
        useAuthStore.setState({ user: resp.data.data })
        setAvatarBust((n) => n + 1)
      }
    } catch {
      // silent — có thể bổ sung toast sau
    }
    setAccountOpen(false)
    closeMobile()
  }

  const navLinks = [
    { to: '/projects', label: 'Dự án' },
    ...(user?.role === 'admin' ? [{ to: '/admin/users', label: 'Người dùng' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(ev) => void onAvatarFile(ev)}
      />

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />

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
            <div className="relative hidden items-center gap-2.5 sm:flex" ref={accountWrapRef}>
              <div className="text-right text-xs">
                <p className="font-semibold text-white leading-tight">{user?.name ?? 'User'}</p>
                <p className="text-white/70 leading-tight hidden md:block">{user?.email ?? ''}</p>
              </div>
              <AvatarButton
                name={user?.name ?? '?'}
                avatarUrl={displayAvatarUrl}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((o) => !o)}
              />
              {accountOpen ? (
                <div
                  className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
                  role="menu"
                >
                  <AccountMenuItems
                    variant="popover"
                    onChangePassword={() => {
                      setAccountOpen(false)
                      setChangePwOpen(true)
                    }}
                    onPickAvatar={() => fileInputRef.current?.click()}
                    onLogout={() => void handleLogout()}
                  />
                </div>
              ) : null}
            </div>

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
              <div className="mt-2 flex items-center gap-3 border-t border-white/20 pt-3">
                <div className="pointer-events-none">
                  <AvatarButton name={user?.name ?? '?'} avatarUrl={displayAvatarUrl} onClick={() => {}} />
                </div>
                <div className="min-w-0 flex-1 text-sm text-white">
                  <p className="truncate font-semibold">{user?.name ?? ''}</p>
                  <p className="truncate text-xs text-white/80">{user?.email ?? ''}</p>
                </div>
              </div>
              <AccountMenuItems
                variant="mobile"
                onChangePassword={() => {
                  closeMobile()
                  setChangePwOpen(true)
                }}
                onPickAvatar={() => {
                  fileInputRef.current?.click()
                  closeMobile()
                }}
                onLogout={() => {
                  closeMobile()
                  void handleLogout()
                }}
              />
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
