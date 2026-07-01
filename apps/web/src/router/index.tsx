import { Suspense } from "react"
import { Navigate, createBrowserRouter } from "react-router-dom"

import { RouteLoading } from "@/components/route-loading"
import { AppLayout } from "@/layouts/app-layout"
import { ProtectedRoute, PublicOnlyRoute } from "@/router/auth-routes"
import {
  AiChatPage,
  LoginPage,
  NotFoundPage,
  PlaceholderPage,
} from "@/router/lazy-pages"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <Suspense fallback={<RouteLoading />}>
          <LoginPage />
        </Suspense>
      </PublicOnlyRoute>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/ai-chat" replace />,
          },
          {
            path: "ai-chat",
            element: <AiChatPage />,
          },
          {
            path: "settings",
            element: <PlaceholderPage title="Settings" />,
          },
          {
            path: "help",
            element: <PlaceholderPage title="Get Help" />,
          },
          {
            path: "search",
            element: <PlaceholderPage title="Search" />,
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
])
