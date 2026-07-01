import * as React from "react"
import { Link, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

function isActiveRoute(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
}) {
  const { pathname } = useLocation()
  const [selectedConversationId, setSelectedConversationId] = React.useState<
    string | null
  >(null)

  React.useEffect(() => {
    function handleConversationSelected(event: Event) {
      const detail = (event as CustomEvent<{ id?: string | null }>).detail

      setSelectedConversationId(detail?.id ?? null)
    }

    function handleNewConversation() {
      setSelectedConversationId(null)
    }

    window.addEventListener(
      "ai-chat:select-conversation",
      handleConversationSelected
    )
    window.addEventListener(
      "ai-chat:selected-conversation-changed",
      handleConversationSelected
    )
    window.addEventListener("ai-chat:new-conversation", handleNewConversation)

    return () => {
      window.removeEventListener(
        "ai-chat:select-conversation",
        handleConversationSelected
      )
      window.removeEventListener(
        "ai-chat:selected-conversation-changed",
        handleConversationSelected
      )
      window.removeEventListener(
        "ai-chat:new-conversation",
        handleNewConversation
      )
    }
  }, [])

  function handleNavigationClick(url: string) {
    if (url === "/ai-chat") {
      window.dispatchEvent(new Event("ai-chat:new-conversation"))
      window.dispatchEvent(
        new CustomEvent("ai-chat:selected-conversation-changed", {
          detail: { id: null },
        })
      )
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={
                  isActiveRoute(pathname, item.url) &&
                  (item.url !== "/ai-chat" || selectedConversationId === null)
                }
                tooltip={item.title}
              >
                <Link
                  to={item.url}
                  onClick={() => handleNavigationClick(item.url)}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
