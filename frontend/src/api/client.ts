import axios from 'axios'

const AUTH_TOKEN_KEY = 'tiendo.auth.token'

const client = axios.create({
  // Backend API prefix (Laravel): /api/v1/*
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function setAuthToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    return
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export default client

