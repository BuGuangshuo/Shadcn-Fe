import * as React from "react"
import { useLocation } from "react-router-dom"
import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { getRouteTitle } from "@/routes/navigation"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

type AiChatConversationTitleEventDetail = {
  id?: string | null
  title?: string | null
}

function normalizeChatTitle(title?: string | null) {
  const trimmedTitle = title?.trim()

  return trimmedTitle || null
}

export function SiteHeader() {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const routeTitle = getRouteTitle(pathname)
  const [activeChatConversation, setActiveChatConversation] = React.useState<{
    id: string | null
    title: string | null
  }>({
    id: null,
    title: null,
  })
  const title =
    pathname === "/ai-chat"
      ? activeChatConversation.title ?? routeTitle
      : routeTitle
  const isDark = theme === "dark"

  React.useEffect(() => {
    function resetChatConversationTitle() {
      setActiveChatConversation({
        id: null,
        title: null,
      })
    }

    function handleSelectConversation(event: Event) {
      const detail = (event as CustomEvent<AiChatConversationTitleEventDetail>)
        .detail

      if (!detail?.id) {
        resetChatConversationTitle()
        return
      }

      setActiveChatConversation({
        id: detail.id,
        title: normalizeChatTitle(detail.title),
      })
    }

    function handleSelectedConversationChanged(event: Event) {
      const detail = (event as CustomEvent<AiChatConversationTitleEventDetail>)
        .detail

      if (!detail?.id) {
        resetChatConversationTitle()
        return
      }

      setActiveChatConversation((current) => ({
        id: detail.id ?? null,
        title:
          "title" in detail
            ? normalizeChatTitle(detail.title)
            : current.id === detail.id
              ? current.title
              : null,
      }))
    }

    function handleConversationTitleUpdated(event: Event) {
      const detail = (event as CustomEvent<AiChatConversationTitleEventDetail>)
        .detail

      if (!detail?.id) {
        return
      }

      setActiveChatConversation((current) =>
        current.id === detail.id
          ? {
              ...current,
              title: normalizeChatTitle(detail.title),
            }
          : current
      )
    }

    window.addEventListener(
      "ai-chat:select-conversation",
      handleSelectConversation
    )
    window.addEventListener(
      "ai-chat:selected-conversation-changed",
      handleSelectedConversationChanged
    )
    window.addEventListener(
      "ai-chat:conversation-title-updated",
      handleConversationTitleUpdated
    )
    window.addEventListener(
      "ai-chat:new-conversation",
      resetChatConversationTitle
    )

    return () => {
      window.removeEventListener(
        "ai-chat:select-conversation",
        handleSelectConversation
      )
      window.removeEventListener(
        "ai-chat:selected-conversation-changed",
        handleSelectedConversationChanged
      )
      window.removeEventListener(
        "ai-chat:conversation-title-updated",
        handleConversationTitleUpdated
      )
      window.removeEventListener(
        "ai-chat:new-conversation",
        resetChatConversationTitle
      )
    }
  }, [])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="truncate text-base font-medium">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={isDark ? "切换浅色模式" : "切换深色模式"}
                onClick={() => setTheme(isDark ? "light" : "dark")}
              >
                {isDark ? <MoonIcon /> : <SunIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDark ? "切换浅色模式" : "切换深色模式"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
