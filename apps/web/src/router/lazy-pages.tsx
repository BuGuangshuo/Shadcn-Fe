import { lazy } from "react"

export const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  }))
)

export const LoginPage = lazy(() =>
  import("@/pages/login").then((module) => ({
    default: module.LoginPage,
  }))
)

export const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((module) => ({
    default: module.NotFoundPage,
  }))
)

export const PlaceholderPage = lazy(() =>
  import("@/pages/placeholder").then((module) => ({
    default: module.PlaceholderPage,
  }))
)
