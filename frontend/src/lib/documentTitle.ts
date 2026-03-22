import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Tên app — dùng chung tab mặc định & hậu tố */
export const APP_TAB_NAME = 'TienDo'

/**
 * Tiêu đề tab ngắn gọn theo route (pathname, không query).
 */
export function titleForPathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/'

  if (/^\/share\/[^/]+$/.test(p)) return `Xem chia sẻ · ${APP_TAB_NAME}`
  if (p === '/login') return `Đăng nhập · ${APP_TAB_NAME}`
  if (p === '/projects') return `Dự án · ${APP_TAB_NAME}`
  if (/^\/projects\/[^/]+\/layers\/[^/]+\/editor$/.test(p)) return `Soạn bản vẽ · ${APP_TAB_NAME}`
  if (/^\/projects\/[^/]+\/layers\/[^/]+\/progress$/.test(p)) return `Tiến độ · ${APP_TAB_NAME}`
  if (/^\/projects\/[^/]+\/layers\/[^/]+\/view$/.test(p)) return `Xem bản vẽ · ${APP_TAB_NAME}`
  if (/^\/projects\/[^/]+$/.test(p)) return `Chi tiết dự án · ${APP_TAB_NAME}`
  if (p === '/notifications') return `Thông báo · ${APP_TAB_NAME}`
  if (p === '/admin/users') return `Người dùng · ${APP_TAB_NAME}`

  return APP_TAB_NAME
}

/** Gắn vào <BrowserRouter> — cập nhật document.title mỗi khi đổi route */
export function DocumentTitleSync() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleForPathname(pathname)
  }, [pathname])

  return null
}
