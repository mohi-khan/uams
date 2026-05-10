import axios from 'axios'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach access token from localStorage on every request
// atomWithStorage JSON-serializes values, so parse before use
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('access_token')
  const token = raw ? JSON.parse(raw) : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 — attempt token refresh, then retry original request
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const rawRefresh = localStorage.getItem('refresh_token')
        const refreshToken = rawRefresh ? JSON.parse(rawRefresh) : null
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        )

        localStorage.setItem('access_token', data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return apiClient(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)
