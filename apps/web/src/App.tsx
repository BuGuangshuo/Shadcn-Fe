import { RouterProvider } from "react-router-dom"

import { AuthProvider } from "@/lib/auth-provider"
import { router } from "@/router"
import { Toaster } from "@workspace/ui/components/sonner"

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  )
}
