import type { ReactNode } from "react"
import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom"

import { RouteLoading } from "@/components/route-loading"
import { useAuth } from "@/lib/auth-context"

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return <RouteLoading />
  }

  if (status === "unauthenticated") {
    const redirectTo = `${location.pathname}${location.search}`

    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirectTo)}`}
        replace
      />
    )
  }

  return <Outlet />
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"

  if (status === "loading") {
    return <RouteLoading />
  }

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
