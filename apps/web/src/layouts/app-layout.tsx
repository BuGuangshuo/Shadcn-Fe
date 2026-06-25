import { Suspense } from "react"
import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { RouteLoading } from "@/components/route-loading"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <Suspense fallback={<RouteLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
