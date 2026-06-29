import { Suspense } from "react"
import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { RouteLoading } from "@/components/route-loading"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

export function AppLayout() {
  return (
    <SidebarProvider className="h-svh overflow-hidden [--header-height:3.5rem]">
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="@container/main flex min-h-0 flex-1 flex-col">
            <Suspense fallback={<RouteLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
