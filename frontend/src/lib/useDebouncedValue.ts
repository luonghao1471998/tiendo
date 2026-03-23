import { useEffect, useState } from 'react'

/** Giá trị `value` sau `delayMs` ms không đổi (dùng cho tìm kiếm gọi API). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
