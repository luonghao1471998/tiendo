import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, FolderOpen, MapPin, Plus, X } from 'lucide-react'

import client from '@/api/client'
import { parseApiError } from '@/lib/parseApiError'
import useAuthStore from '@/stores/authStore'

type ProjectItem = {
  id: number
  name: string
  code: string
  description: string | null
  address: string | null
}

type ApiListResponse<T> = {
  success: boolean
  data: T[]
  meta?: { current_page: number; per_page: number; total: number }
}

type ApiResponse<T> = { success: boolean; data: T }

// ─── Input helper ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#FF7F29] focus:outline-none focus:ring-2 focus:ring-[#FF7F29]/30'

// ─── CreateProjectModal ───────────────────────────────────────────────────────

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (project: ProjectItem) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) { setErr('Tên dự án là bắt buộc.'); return }
    if (!code.trim()) { setErr('Mã dự án là bắt buộc.'); return }
    setErr(null)
    setLoading(true)
    try {
      const resp = (await client.post('/projects', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        address: address.trim() || null,
      })) as { data: ApiResponse<ProjectItem> }
      onCreated(resp.data.data)
    } catch (e) {
      setErr(parseApiError(e, 'Tạo dự án thất bại.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF3E8]">
              <Building2 size={16} className="text-[#FF7F29]" />
            </div>
            <h2 className="font-semibold text-[#0F172A]">Tạo dự án mới</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
              Tên dự án <span className="text-red-500">*</span>
            </label>
            <input className={inputCls} placeholder="VD: Chung cư The Sun" value={name}
              onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
              Mã dự án <span className="text-red-500">*</span>
            </label>
            <input className={`${inputCls} uppercase`} placeholder="VD: THESUN" value={code}
              onChange={(e) => setCode(e.target.value)} />
            <p className="mt-1 text-xs text-[#94A3B8]">Tự động viết hoa, không thể thay đổi sau khi tạo.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Mô tả</label>
            <textarea className={inputCls} placeholder="Mô tả ngắn về dự án..." rows={2}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Địa chỉ công trình</label>
            <input className={inputCls} placeholder="VD: 123 Nguyễn Trãi, Q.1, TP.HCM"
              value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          {err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t border-[#E2E8F0] px-6 py-4">
          <button type="button" onClick={onClose}
            className="cursor-pointer rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] transition hover:bg-[#F8FAFC]">
            Hủy
          </button>
          <button type="button" onClick={() => void submit()} disabled={loading}
            className="cursor-pointer rounded-xl bg-[#FF7F29] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#E5691D] disabled:opacity-60">
            {loading ? 'Đang tạo...' : 'Tạo dự án'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-16 animate-pulse rounded-full bg-[#F1F5F9]" />
      <div className="mb-2 h-6 w-3/4 animate-pulse rounded-lg bg-[#F1F5F9]" />
      <div className="mb-1 h-4 w-full animate-pulse rounded-lg bg-[#F1F5F9]" />
      <div className="mb-4 h-4 w-2/3 animate-pulse rounded-lg bg-[#F1F5F9]" />
      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-[#F1F5F9]" />
    </div>
  )
}

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = (await client.get('/projects')) as { data: ApiListResponse<ProjectItem> }
      setProjects(response.data.data)
    } catch {
      setError('Không tải được danh sách dự án.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchProjects() }, [])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dự án</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {user ? `Xin chào, ${user.name}` : 'Danh sách dự án của bạn'}
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FF7F29] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#E5691D] hover:shadow-md"
          >
            <Plus size={16} />
            Tạo dự án
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Grid */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((i) => <ProjectCardSkeleton key={i} />)
        ) : projects.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E2E8F0] py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8]">
              <FolderOpen size={24} className="text-[#FF7F29]" />
            </div>
            <p className="mb-1 font-semibold text-[#0F172A]">Chưa có dự án nào</p>
            <p className="text-sm text-[#64748B]">
              {isAdmin ? 'Nhấn "Tạo dự án" để bắt đầu.' : 'Bạn chưa được thêm vào dự án nào.'}
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group flex cursor-pointer flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all duration-150 hover:border-[#FF7F29] hover:shadow-md"
            >
              {/* Code badge */}
              <span className="mb-3 inline-flex self-start items-center rounded-full bg-[#FFF3E8] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#FF7F29]">
                {project.code}
              </span>

              {/* Name */}
              <h2 className="mb-1.5 text-base font-semibold text-[#0F172A] transition group-hover:text-[#FF7F29]">
                {project.name}
              </h2>

              {/* Description */}
              <p className="line-clamp-2 flex-1 text-sm text-[#64748B]">
                {project.description ?? 'Chưa có mô tả'}
              </p>

              {/* Address */}
              {project.address ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate">{project.address}</span>
                </div>
              ) : null}

              {/* Footer bar */}
              <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                <span className="text-xs text-[#94A3B8]">Xem chi tiết →</span>
                <div className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-[#94A3B8]" />
                  <span className="text-xs text-[#94A3B8]">Dự án</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </section>

      {showCreate ? (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(newProject) => {
            setProjects((prev) => [newProject, ...prev])
            setShowCreate(false)
          }}
        />
      ) : null}
    </main>
  )
}
