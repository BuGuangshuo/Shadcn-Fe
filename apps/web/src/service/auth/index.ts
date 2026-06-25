const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  ""
)

export const AUTH_STORAGE_KEY = "test-frontend.auth.v1"
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000

export type Token = {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in: number
}

export type StoredAuthTokens = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

export type LoginRequest = {
  username: string
  password: string
}

export type UserPublic = {
  id: string
  username: string
  email?: string | null
  full_name?: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

export type AuthSession = {
  user_id: string
  username: string
  access_token_ttl: number
  refresh_token_ttl: number
}

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

type ApiRequestOptions = RequestInit & {
  accessToken?: string
}

export function getStoredAuthTokens() {
  if (typeof window === "undefined") {
    return null
  }

  const rawTokens = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawTokens) {
    return null
  }

  try {
    return JSON.parse(rawTokens) as StoredAuthTokens
  } catch {
    clearStoredAuthTokens()
    return null
  }
}

export function setStoredAuthTokens(tokens: StoredAuthTokens) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens))
}

export function clearStoredAuthTokens() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAccessTokenFresh(tokens: StoredAuthTokens) {
  return tokens.expiresAt - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS
}

export function normalizeToken(token: Token): StoredAuthTokens {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    tokenType: token.token_type ?? "bearer",
    expiresAt: Date.now() + token.expires_in * 1000,
  }
}

export async function loginWithPassword(credentials: LoginRequest) {
  return apiRequest<Token>("/api/v1/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  })
}

export async function refreshAccessToken(refreshToken: string) {
  return apiRequest<Token>("/api/v1/login/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export async function readCurrentUser(accessToken: string) {
  return apiRequest<UserPublic>("/api/v1/login/me", {
    accessToken,
  })
}

export async function readCurrentSession(accessToken: string) {
  return apiRequest<AuthSession>("/api/v1/login/session", {
    accessToken,
  })
}

export async function logoutSession(accessToken: string) {
  return apiRequest<{ message: string }>("/api/v1/login/logout", {
    method: "POST",
    accessToken,
  })
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { accessToken, headers, body, ...init } = options
  const requestHeaders = new Headers(headers)

  if (body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers: requestHeaders,
  })
  const payload = await parseResponsePayload(response)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getErrorMessage(payload, response.statusText),
      payload
    )
  }

  return payload as T
}

async function parseResponsePayload(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") {
    return payload
  }

  if (!payload || typeof payload !== "object") {
    return fallback || "请求失败"
  }

  const detail = (payload as { detail?: unknown }).detail

  if (typeof detail === "string") {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg)
        }

        return null
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join("；")
    }
  }

  const message = (payload as { message?: unknown }).message

  if (typeof message === "string") {
    return message
  }

  return fallback || "请求失败"
}
