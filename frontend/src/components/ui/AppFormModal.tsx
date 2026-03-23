import type { ReactNode } from 'react'

/**
 * Vỏ modal form đồng bộ với Excel import (ProjectDetail): backdrop blur, header gạch cam, footer xám.
 */
export default function AppFormModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-md',
  ariaLabelledBy,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer: ReactNode
  maxWidthClass?: string
  ariaLabelledBy?: string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`flex w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)]`}
        style={{ maxHeight: '90vh' }}
        role="dialog"
        aria-modal="true"
        {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 border-l-4 border-[#FF7F29] pl-3">
              <h2
                {...(ariaLabelledBy ? { id: ariaLabelledBy } : {})}
                className="text-lg font-semibold text-[#0F172A]"
              >
                {title}
              </h2>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-[#64748B]">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-[#64748B] hover:bg-[#E2E8F0]/80"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 text-[#0F172A]">{children}</div>
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">{footer}</div>
      </div>
    </div>
  )
}

/** Input / label giống khối form trong modal Excel */
export const appFormInputClass =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7F29]/70 focus:ring-1 focus:ring-[#FF7F29]/30'

export const appFormLabelClass = 'mb-1 block text-xs font-medium text-[#64748B]'
