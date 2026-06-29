import type { ReactNode } from "react"
import {
  BotMessageSquareIcon,
  ChartBarIcon,
  CircleHelpIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react"

export type NavigationItem = {
  title: string
  url: string
  icon: ReactNode
}

export type DocumentNavigationItem = {
  name: string
  url: string
  icon: ReactNode
}

export const navMain: NavigationItem[] = [
  {
    title: "AI Chat",
    url: "/ai-chat",
    icon: <BotMessageSquareIcon />,
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Lifecycle",
    url: "/lifecycle",
    icon: <ListIcon />,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: <ChartBarIcon />,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: <FolderIcon />,
  },
  {
    title: "Team",
    url: "/team",
    icon: <UsersIcon />,
  },
]

export const documents: DocumentNavigationItem[] = [
  {
    name: "Data Library",
    url: "/documents/data-library",
    icon: <DatabaseIcon />,
  },
  {
    name: "Reports",
    url: "/documents/reports",
    icon: <FileChartColumnIcon />,
  },
  {
    name: "Word Assistant",
    url: "/documents/word-assistant",
    icon: <FileIcon />,
  },
]

export const navSecondary: NavigationItem[] = [
  {
    title: "Settings",
    url: "/settings",
    icon: <Settings2Icon />,
  },
  {
    title: "Get Help",
    url: "/help",
    icon: <CircleHelpIcon />,
  },
  {
    title: "Search",
    url: "/search",
    icon: <SearchIcon />,
  },
]

const routeTitles = new Map<string, string>([
  ["/", "AI Chat"],
  ...navMain.map((item) => [item.url, item.title] as const),
  ...documents.map((item) => [item.url, item.name] as const),
  ...navSecondary.map((item) => [item.url, item.title] as const),
])

export function getRouteTitle(pathname: string) {
  return routeTitles.get(pathname) ?? "Not Found"
}
