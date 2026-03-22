/** User-facing text — never show raw API token to end users */
const INVALID_STATE_TRANSITION_VI =
  'Không thể đổi sang trạng thái này theo quy trình thi công. ' +
  'Ví dụ: không thể chuyển từ «Chưa bắt đầu» sang «Hoàn thành» trực tiếp — cần các bước trung gian (ví dụ «Đang thi công») trước khi hoàn thành.'

const FORBIDDEN_VI =
  'Bạn không có quyền thực hiện thao tác này. ' +
  'Ví dụ: chỉ quản lý dự án / admin mới sửa được toàn bộ thông tin khu vực (PUT); đội hiện trường chỉ được cập nhật trạng thái và tiến độ trên khu vực được giao qua màn hình Tiến độ.'

const UNAUTHENTICATED_VI =
  'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.'

/**
 * parseApiError — extract a human-readable Vietnamese error message from an
 * Axios error.  Handles:
 *  - VALIDATION_ERROR / VALIDATION_FAILED → join field messages from `details`
 *    (Laravel API uses `VALIDATION_ERROR` — see backend/bootstrap/app.php)
 *  - INVALID_STATE_TRANSITION → friendly transition message
 *  - Generic API error → error.message
 *  - Fallback string when nothing else matches
 */
function collectValidationMessages(details: unknown): string[] {
  if (!details || typeof details !== 'object') return []
  const lines: string[] = []
  for (const msgs of Object.values(details as Record<string, unknown>)) {
    if (Array.isArray(msgs)) {
      for (const m of msgs) {
        if (typeof m === 'string' && m.trim()) {
          const t = m.trim()
          // Backend sometimes puts this token in details — never show raw to users
          lines.push(t === 'INVALID_STATE_TRANSITION' ? INVALID_STATE_TRANSITION_VI : t)
        }
      }
    } else if (typeof msgs === 'string' && msgs.trim()) {
      const t = msgs.trim()
      lines.push(t === 'INVALID_STATE_TRANSITION' ? INVALID_STATE_TRANSITION_VI : t)
    }
  }
  return lines
}

export function parseApiError(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback
  }

  const apiErr = (
    error as {
      response?: { data?: { error?: { code?: unknown; message?: unknown; details?: unknown } } }
    }
  ).response?.data?.error

  if (!apiErr) return fallback

  // 403 — Laravel AuthorizationException → FORBIDDEN
  if (apiErr.code === 'FORBIDDEN') {
    return FORBIDDEN_VI
  }

  // 401
  if (apiErr.code === 'UNAUTHENTICATED') {
    return UNAUTHENTICATED_VI
  }

  // INVALID_STATE_TRANSITION — explicit code from API (ZoneService state machine)
  if (apiErr.code === 'INVALID_STATE_TRANSITION') {
    return INVALID_STATE_TRANSITION_VI
  }

  // Laravel API: code VALIDATION_ERROR + details { field: ["msg", ...] }
  const isValidation =
    apiErr.code === 'VALIDATION_ERROR' ||
    apiErr.code === 'VALIDATION_FAILED'

  if (isValidation) {
    const lines = collectValidationMessages(apiErr.details)
    if (lines.length) return lines.join(' • ')
  }

  // Generic message from API (skip useless "Validation failed." if we had no details)
  if (typeof apiErr.message === 'string' && apiErr.message) {
    const msg = apiErr.message
    if (msg === 'This action is unauthorized.') return FORBIDDEN_VI
    if (msg === 'Unauthenticated.') return UNAUTHENTICATED_VI
    if (msg !== 'Validation failed.') return msg
  }

  return fallback
}
