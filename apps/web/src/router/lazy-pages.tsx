import { lazy } from "react"

export const AiChatPage = lazy(() =>
  import("@/pages/ai-chat").then((module) => ({
    default: module.AiChatPage,
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
