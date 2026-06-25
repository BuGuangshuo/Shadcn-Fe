import { createContext, useContext } from "react"

import type { AuthSession, UserPublic } from "@/service/auth"

export type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export type AuthContextValue = {
  status: AuthStatus
  user: UserPublic | null
  session: AuthSession | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
