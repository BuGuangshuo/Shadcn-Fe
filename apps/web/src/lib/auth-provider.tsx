import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "@/lib/auth-context"
import {
  AUTH_STORAGE_KEY,
  clearStoredAuthTokens,
  getStoredAuthTokens,
  isAccessTokenFresh,
  loginWithPassword,
  logoutSession,
  normalizeToken,
  readCurrentSession,
  readCurrentUser,
  refreshAccessToken,
  setStoredAuthTokens,
  type AuthSession,
  type StoredAuthTokens,
  type UserPublic,
} from "@/service/auth"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [tokens, setTokens] = useState<StoredAuthTokens | null>(null)
  const [user, setUser] = useState<UserPublic | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const refreshPromiseRef = useRef<Promise<StoredAuthTokens> | null>(null)
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null)

  const resetAuthState = useCallback(() => {
    clearStoredAuthTokens()
    setTokens(null)
    setUser(null)
    setSession(null)
    setStatus("unauthenticated")
  }, [])

  const persistTokens = useCallback((nextTokens: StoredAuthTokens) => {
    setStoredAuthTokens(nextTokens)
    setTokens(nextTokens)
  }, [])

  const refreshTokens = useCallback(
    async (currentTokens: StoredAuthTokens) => {
      if (!currentTokens.refreshToken) {
        throw new Error("当前会话没有 refresh token")
      }

      if (!refreshPromiseRef.current) {
        refreshPromiseRef.current = refreshAccessToken(
          currentTokens.refreshToken
        )
          .then(normalizeToken)
          .then((nextTokens) => {
            persistTokens(nextTokens)
            return nextTokens
          })
          .finally(() => {
            refreshPromiseRef.current = null
          })
      }

      return refreshPromiseRef.current
    },
    [persistTokens]
  )

  const ensureFreshTokens = useCallback(
    async (currentTokens: StoredAuthTokens) => {
      if (isAccessTokenFresh(currentTokens)) {
        return currentTokens
      }

      return refreshTokens(currentTokens)
    },
    [refreshTokens]
  )

  const loadAuthenticatedUser = useCallback(
    async (currentTokens: StoredAuthTokens) => {
      const freshTokens = await ensureFreshTokens(currentTokens)
      const [nextUser, nextSession] = await Promise.all([
        readCurrentUser(freshTokens.accessToken),
        readCurrentSession(freshTokens.accessToken),
      ])

      setUser(nextUser)
      setSession(nextSession)
      setStatus("authenticated")
    },
    [ensureFreshTokens]
  )

  const runBootstrap = useCallback(async () => {
    const storedTokens = getStoredAuthTokens()

    if (!storedTokens) {
      resetAuthState()
      return
    }

    setStatus("loading")
    setTokens(storedTokens)

    try {
      await loadAuthenticatedUser(storedTokens)
    } catch {
      resetAuthState()
    }
  }, [loadAuthenticatedUser, resetAuthState])

  const bootstrap = useCallback(() => {
    if (!bootstrapPromiseRef.current) {
      bootstrapPromiseRef.current = runBootstrap().finally(() => {
        bootstrapPromiseRef.current = null
      })
    }

    return bootstrapPromiseRef.current
  }, [runBootstrap])

  const login = useCallback(
    async (username: string, password: string) => {
      const issuedToken = await loginWithPassword({ username, password })
      const nextTokens = normalizeToken(issuedToken)

      persistTokens(nextTokens)
      await loadAuthenticatedUser(nextTokens)
    },
    [loadAuthenticatedUser, persistTokens]
  )

  const logout = useCallback(async () => {
    const currentTokens = tokens ?? getStoredAuthTokens()

    resetAuthState()

    if (!currentTokens?.accessToken) {
      return
    }

    try {
      await logoutSession(currentTokens.accessToken)
    } catch {
      // The local session is already cleared; server logout failures should not
      // keep the user trapped in an invalid client session.
    }
  }, [resetAuthState, tokens])

  const refreshSession = useCallback(async () => {
    const currentTokens = tokens ?? getStoredAuthTokens()

    if (!currentTokens) {
      resetAuthState()
      return
    }

    try {
      await loadAuthenticatedUser(currentTokens)
    } catch {
      resetAuthState()
    }
  }, [loadAuthenticatedUser, resetAuthState, tokens])

  useEffect(() => {
    queueMicrotask(() => {
      void bootstrap()
    })
  }, [bootstrap])

  useEffect(() => {
    if (status !== "authenticated" || !tokens) {
      return
    }

    const delay = Math.max(tokens.expiresAt - Date.now() - 60_000, 5_000)
    const refreshTimer = window.setTimeout(() => {
      void refreshSession()
    }, delay)

    return () => window.clearTimeout(refreshTimer)
  }, [refreshSession, status, tokens])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== AUTH_STORAGE_KEY) {
        return
      }

      void bootstrap()
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [bootstrap])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      login,
      logout,
      refreshSession,
    }),
    [login, logout, refreshSession, session, status, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
