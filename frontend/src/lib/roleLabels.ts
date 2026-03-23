/** Nhãn hiển thị cho role trong dự án (API vẫn dùng snake_case). */
export function projectMemberRoleLabel(
  role: 'project_manager' | 'field_team' | 'viewer' | string,
): string {
  switch (role) {
    case 'field_team':
      return 'Field Team'
    case 'project_manager':
      return 'Project Manager'
    case 'viewer':
      return 'Viewer'
    default:
      return role
  }
}

/** Nhãn cho role tài khoản hệ thống (trang admin). */
export function platformUserRoleLabel(
  role: 'admin' | 'project_manager' | 'field_team' | 'viewer' | null | string,
): string {
  if (role == null || role === '') return '—'
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'field_team':
      return 'Field Team'
    case 'project_manager':
      return 'Project Manager'
    case 'viewer':
      return 'Viewer'
    default:
      return String(role)
  }
}
