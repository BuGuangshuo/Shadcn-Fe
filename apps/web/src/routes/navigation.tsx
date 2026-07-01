import type { ReactNode } from 'react';
import {
  BotMessageSquareIcon,
} from 'lucide-react';

export type NavigationItem = {
  title: string;
  url: string;
  icon: ReactNode;
};

export type DocumentNavigationItem = {
  name: string;
  url: string;
  icon: ReactNode;
};

export const navMain: NavigationItem[] = [
  {
    title: '新聊天',
    url: '/ai-chat',
    icon: <BotMessageSquareIcon />,
  },
];

export const documents: DocumentNavigationItem[] = [];

export const navSecondary: NavigationItem[] = [];

const routeTitles = new Map<string, string>([
  ['/', '新聊天'],
  ...navMain.map((item) => [item.url, item.title] as const),
  ...documents.map((item) => [item.url, item.name] as const),
  ...navSecondary.map((item) => [item.url, item.title] as const),
]);

export function getRouteTitle(pathname: string) {
  return routeTitles.get(pathname) ?? 'Not Found';
}
