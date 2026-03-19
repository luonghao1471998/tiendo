import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import client from '@/api/client'
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
  meta?: {
    current_page: number
    per_page: number
    total: number
  }
}

export default function ProjectList() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const response = (await client.get('/projects')) as {
          data: ApiListResponse<ProjectItem>
        }
        setProjects(response.data.data)
      } catch {
        setError('Không tải được danh sách dự án.')
      } finally {
        setLoading(false)
      }
    }

    void fetchProjects()
  }, [])

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dự án</h1>
          <p className="text-sm text-muted-foreground">
            {user ? `Xin chào ${user.name} (${user.email})` : 'Danh sách dự án của bạn'}
          </p>
        </div>
      </header>

      {loading ? <p>Đang tải dữ liệu...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{project.code}</p>
              <h2 className="mb-2 text-lg font-semibold">{project.name}</h2>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {project.description || 'Chưa có mô tả'}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {project.address || 'Chưa có địa chỉ công trình'}
              </p>
            </Link>
          ))}

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Bạn chưa có dự án nào.
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

