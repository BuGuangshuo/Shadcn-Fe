import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileTextIcon, LoaderCircleIcon, MessageCircleIcon, SearchIcon } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { SidebarMenuButton, SidebarMenuItem } from '@workspace/ui/components/sidebar';
import { ToggleGroup, ToggleGroupItem } from '@workspace/ui/components/toggle-group';
import {
  type AiChatConversationSearchResult,
  type AiChatConversationSearchType,
  type AiChatConversationSummary,
  listAiChatConversations,
  searchAiChatConversations,
} from '@/service/ai-chat';
import { getStoredAuthTokens } from '@/service/auth';

const SEARCH_PAGE_SIZE = 8;

type SearchFilter = 'all' | AiChatConversationSearchType;

const searchFilters: Array<{ label: string; value: SearchFilter }> = [
  { label: '全部', value: 'all' },
  { label: '聊天', value: 'conversation' },
  { label: '文档', value: 'document' },
];

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);

    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}

function formatResultTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return '今天';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function SearchResultIcon({ type }: { type: AiChatConversationSearchType }) {
  return type === 'document' ? (
    <FileTextIcon className="size-4.5 text-primary" aria-hidden="true" />
  ) : (
    <MessageCircleIcon className="size-4.5" aria-hidden="true" />
  );
}

function SearchLoadingRows() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 rounded-xl px-3">
          <Skeleton className="size-5 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AiChatSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<SearchFilter>('all');
  const [recentConversations, setRecentConversations] = React.useState<AiChatConversationSummary[]>(
    [],
  );
  const [searchResults, setSearchResults] = React.useState<AiChatConversationSearchResult[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isRecentLoading, setIsRecentLoading] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const normalizedKeyword = keyword.trim();
  const debouncedKeyword = useDebouncedValue(normalizedKeyword, 300);
  const isSearchMode = Boolean(normalizedKeyword);
  const isDebouncing = isSearchMode && normalizedKeyword !== debouncedKeyword;
  const activeSearchKeyRef = React.useRef('');
  const loadMoreAbortRef = React.useRef<AbortController | null>(null);
  const recentRequestIdRef = React.useRef(0);

  async function loadRecentConversations() {
    const requestId = recentRequestIdRef.current + 1;
    const accessToken = getStoredAuthTokens()?.accessToken;

    recentRequestIdRef.current = requestId;

    if (!accessToken) {
      setErrorMessage('登录状态已失效，请重新登录后再试。');
      return;
    }

    setIsRecentLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAiChatConversations(accessToken, {
        page: 1,
        pageSize: SEARCH_PAGE_SIZE,
      });

      if (recentRequestIdRef.current === requestId) {
        setRecentConversations(response.items);
      }
    } catch (error) {
      if (recentRequestIdRef.current === requestId) {
        setErrorMessage(error instanceof Error ? error.message : '最近聊天加载失败。');
      }
    } finally {
      if (recentRequestIdRef.current === requestId) {
        setIsRecentLoading(false);
      }
    }
  }

  React.useEffect(() => {
    if (
      !open ||
      !normalizedKeyword ||
      !debouncedKeyword ||
      normalizedKeyword !== debouncedKeyword
    ) {
      activeSearchKeyRef.current = '';
      loadMoreAbortRef.current?.abort();
      return;
    }

    const accessToken = getStoredAuthTokens()?.accessToken;

    if (!accessToken) {
      void Promise.resolve().then(() => {
        setErrorMessage('登录状态已失效，请重新登录后再试。');
        setIsSearching(false);
      });
      return;
    }

    const searchKey = `${debouncedKeyword}\u0000${filter}`;
    const abortController = new AbortController();

    activeSearchKeyRef.current = searchKey;
    loadMoreAbortRef.current?.abort();

    searchAiChatConversations(accessToken, {
      keyword: debouncedKeyword,
      type: filter === 'all' ? undefined : filter,
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
      signal: abortController.signal,
    })
      .then((response) => {
        if (activeSearchKeyRef.current === searchKey) {
          setSearchResults(response.items);
          setTotal(response.total);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (activeSearchKeyRef.current === searchKey) {
          setErrorMessage(error instanceof Error ? error.message : '搜索失败，请稍后重试。');
        }
      })
      .finally(() => {
        if (activeSearchKeyRef.current === searchKey) {
          setIsSearching(false);
        }
      });

    return () => abortController.abort();
  }, [debouncedKeyword, filter, normalizedKeyword, open]);

  function selectConversation(conversationId: string, title: string) {
    handleOpenChange(false);
    navigate('/ai-chat');
    window.dispatchEvent(
      new CustomEvent('ai-chat:select-conversation', {
        detail: { id: conversationId, title },
      }),
    );
  }

  async function loadNextPage() {
    if (
      !open ||
      !debouncedKeyword ||
      isDebouncing ||
      isSearching ||
      isLoadingMore ||
      searchResults.length >= total
    ) {
      return;
    }

    const accessToken = getStoredAuthTokens()?.accessToken;

    if (!accessToken) {
      setErrorMessage('登录状态已失效，请重新登录后再试。');
      return;
    }

    const nextPage = page + 1;
    const searchKey = `${debouncedKeyword}\u0000${filter}`;
    const abortController = new AbortController();

    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = abortController;
    setIsLoadingMore(true);

    try {
      const response = await searchAiChatConversations(accessToken, {
        keyword: debouncedKeyword,
        type: filter === 'all' ? undefined : filter,
        page: nextPage,
        pageSize: SEARCH_PAGE_SIZE,
        signal: abortController.signal,
      });

      if (activeSearchKeyRef.current !== searchKey) {
        return;
      }

      setSearchResults((current) => [...current, ...response.items]);
      setTotal(response.total);
      setPage(nextPage);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setErrorMessage(error instanceof Error ? error.message : '更多结果加载失败。');
      }
    } finally {
      if (activeSearchKeyRef.current === searchKey) {
        setIsLoadingMore(false);
      }
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      void loadRecentConversations();
      return;
    }

    recentRequestIdRef.current += 1;
    activeSearchKeyRef.current = '';
    loadMoreAbortRef.current?.abort();
    setKeyword('');
    setFilter('all');
    setSearchResults([]);
    setTotal(0);
    setPage(1);
    setIsSearching(false);
    setIsLoadingMore(false);
    setErrorMessage(null);
  }

  function handleKeywordChange(nextKeyword: string) {
    const hasKeyword = Boolean(nextKeyword.trim());

    setKeyword(nextKeyword);
    setSearchResults([]);
    setTotal(0);
    setPage(1);
    setIsSearching(hasKeyword);
    setIsLoadingMore(false);
    setErrorMessage(null);
    loadMoreAbortRef.current?.abort();

    if (!hasKeyword) {
      activeSearchKeyRef.current = '';
      void loadRecentConversations();
    }
  }

  function handleFilterChange(value: string) {
    if (!value) {
      return;
    }

    setFilter(value as SearchFilter);
    setPage(1);

    if (normalizedKeyword) {
      setSearchResults([]);
      setTotal(0);
      setIsSearching(true);
      setIsLoadingMore(false);
      setErrorMessage(null);
      loadMoreAbortRef.current?.abort();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <SidebarMenuItem>
        <DialogTrigger asChild>
          <SidebarMenuButton tooltip="搜索" isActive={open}>
            <SearchIcon />
            <span>搜索</span>
          </SidebarMenuButton>
        </DialogTrigger>
      </SidebarMenuItem>

      <DialogContent
        showCloseButton={false}
        className="grid max-h-[min(680px,calc(100svh-2rem))] grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>搜索历史聊天</DialogTitle>
          <DialogDescription>搜索历史对话内容和上传过的文档。</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-4 py-3.5">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              type="search"
              value={keyword}
              onChange={(event) => handleKeywordChange(event.target.value)}
              placeholder="搜索聊天或文档"
              aria-label="搜索聊天或文档"
              className="h-10 bg-muted/35 ps-9 pe-3"
            />
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              关闭
            </Button>
          </DialogClose>
        </div>

        <div className="border-b px-4 py-2.5">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={handleFilterChange}
            aria-label="搜索类型"
            className="gap-1"
          >
            {searchFilters.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                aria-label={item.label}
                className="min-h-8 rounded-xl px-4 font-normal data-[state=on]:bg-muted/60"
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div
          className="min-h-64 overflow-y-auto overscroll-contain px-2 py-2 sm:h-[28rem]"
          onScroll={(event) => {
            const element = event.currentTarget;

            if (element.scrollHeight - element.scrollTop - element.clientHeight < 80) {
              void loadNextPage();
            }
          }}
        >
          {!isSearchMode ? (
            isRecentLoading ? (
              <SearchLoadingRows />
            ) : errorMessage ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">{errorMessage}</p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground">最近聊天</p>
                {recentConversations.length ? (
                  recentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id, conversation.title)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm outline-none transition-colors hover:bg-muted/45 focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <MessageCircleIcon className="size-4.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{conversation.title || '未命名会话'}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                    暂无最近聊天
                  </p>
                )}
              </div>
            )
          ) : isSearching || isDebouncing ? (
            <SearchLoadingRows />
          ) : errorMessage ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">{errorMessage}</p>
          ) : searchResults.length ? (
            <div className="flex flex-col gap-1">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.conversation_id}-${result.type}-${result.time}-${index}`}
                  type="button"
                  onClick={() => selectConversation(result.conversation_id, result.title)}
                  className="flex min-h-16 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/45 focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center">
                    <SearchResultIcon type={result.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{result.title || '未命名会话'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {result.type === 'document' ? '文档' : '聊天'}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {result.content}
                    </span>
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                    {formatResultTime(result.time)}
                  </span>
                </button>
              ))}
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                  加载更多
                </div>
              ) : null}
            </div>
          ) : (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">没有找到相关内容</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
