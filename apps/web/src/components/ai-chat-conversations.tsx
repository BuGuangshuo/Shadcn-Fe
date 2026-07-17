import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquareIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Input } from '@workspace/ui/components/input';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';
import {
  type AiChatConversationSummary,
  deleteAiChatConversation,
  listAiChatConversations,
  updateAiChatConversationTitle,
} from '@/service/ai-chat';
import { getStoredAuthTokens } from '@/service/auth';

type RefreshConversationsEventDetail = {
  preserveConversation?: {
    id: string;
    title?: string | null;
  };
};

type ConversationTitleUpdatedEventDetail = {
  id?: string | null;
  title?: string | null;
};

function dispatchNewConversationEvent() {
  window.dispatchEvent(new Event('ai-chat:new-conversation'));
}

function dispatchSelectConversationEvent(conversation: AiChatConversationSummary) {
  window.dispatchEvent(
    new CustomEvent('ai-chat:select-conversation', {
      detail: {
        id: conversation.id,
        title: conversation.title,
      },
    }),
  );
}

export function AiChatConversations() {
  const navigate = useNavigate();
  const [conversations, setConversations] = React.useState<AiChatConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = React.useState<string | null>(null);
  const [conversationPendingDeletion, setConversationPendingDeletion] =
    React.useState<AiChatConversationSummary | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(
    () => Boolean(getStoredAuthTokens()?.accessToken),
  );
  const [isMutating, setIsMutating] = React.useState(false);
  const [isChatStreaming, setIsChatStreaming] = React.useState(false);
  const isActionBusy = isMutating || isChatStreaming;

  React.useEffect(() => {
    let isActive = true;
    const tokens = getStoredAuthTokens();

    if (!tokens?.accessToken) {
      return;
    }

    listAiChatConversations(tokens.accessToken)
      .then((response) => {
        if (isActive) {
          setConversations(response.items);
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          toast.error(error.message || '最近会话加载失败。');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  function selectConversation(conversation: AiChatConversationSummary) {
    setSelectedConversationId(conversation.id);
    navigate('/ai-chat');
    dispatchSelectConversationEvent(conversation);
  }

  async function refreshConversations(options: RefreshConversationsEventDetail = {}) {
    const tokens = getStoredAuthTokens();

    if (!tokens?.accessToken) {
      return;
    }

    try {
      const response = await listAiChatConversations(tokens.accessToken);

      setConversations((current) => {
        const preservedConversationId = options.preserveConversation?.id;

        if (
          !preservedConversationId ||
          response.items.some((conversation) => conversation.id === preservedConversationId)
        ) {
          return response.items;
        }

        const now = new Date().toISOString();
        const existingConversation = current.find(
          (conversation) => conversation.id === preservedConversationId,
        );
        const preservedConversation: AiChatConversationSummary = existingConversation ?? {
          id: preservedConversationId,
          title: options.preserveConversation?.title?.trim() || '新聊天',
          created_at: now,
          updated_at: now,
          last_message_at: now,
        };

        return [
          preservedConversation,
          ...response.items.filter((conversation) => conversation.id !== preservedConversationId),
        ];
      });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '最近会话刷新失败。');
    }
  }

  React.useEffect(() => {
    function handleSelectedConversationChanged(event: Event) {
      const detail = (event as CustomEvent<{ id: string | null }>).detail;

      setSelectedConversationId(detail?.id ?? null);
    }

    function handleRefreshConversations(event: Event) {
      const detail = (event as CustomEvent<RefreshConversationsEventDetail>).detail;

      void refreshConversations({
        preserveConversation: detail?.preserveConversation,
      });
    }

    function handleStreamingChanged(event: Event) {
      const detail = (event as CustomEvent<{ isStreaming?: boolean }>).detail;

      setIsChatStreaming(Boolean(detail?.isStreaming));
    }

    function handleConversationTitleUpdated(event: Event) {
      const detail = (event as CustomEvent<ConversationTitleUpdatedEventDetail>).detail;
      const conversationId = detail?.id?.trim();
      const title = detail?.title?.trim();

      if (!conversationId || !title) {
        return;
      }

      setConversations((current) => {
        const now = new Date().toISOString();
        let didUpdate = false;
        const nextConversations = current.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          didUpdate = true;
          return {
            ...conversation,
            title,
            updated_at: now,
            last_message_at: conversation.last_message_at ?? now,
          };
        });

        if (didUpdate) {
          return nextConversations;
        }

        return [
          {
            id: conversationId,
            title,
            created_at: now,
            updated_at: now,
            last_message_at: now,
          },
          ...current,
        ];
      });
    }

    window.addEventListener(
      'ai-chat:selected-conversation-changed',
      handleSelectedConversationChanged,
    );
    window.addEventListener('ai-chat:refresh-conversations', handleRefreshConversations);
    window.addEventListener('ai-chat:conversation-title-updated', handleConversationTitleUpdated);
    window.addEventListener('ai-chat:streaming-changed', handleStreamingChanged);

    return () => {
      window.removeEventListener(
        'ai-chat:selected-conversation-changed',
        handleSelectedConversationChanged,
      );
      window.removeEventListener('ai-chat:refresh-conversations', handleRefreshConversations);
      window.removeEventListener(
        'ai-chat:conversation-title-updated',
        handleConversationTitleUpdated,
      );
      window.removeEventListener('ai-chat:streaming-changed', handleStreamingChanged);
    };
  });

  function startEditConversation(conversation: AiChatConversationSummary) {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  }

  function cancelEditConversation() {
    setEditingConversationId(null);
    setEditingTitle('');
  }

  async function commitEditConversation() {
    const conversationId = editingConversationId;
    const nextTitle = editingTitle.trim();

    if (!conversationId) {
      return;
    }

    if (isChatStreaming) {
      toast.info('上一条回复仍在生成，请先停止或等待完成。');
      return;
    }

    if (!nextTitle) {
      toast.info('会话名称不能为空。');
      return;
    }

    const tokens = getStoredAuthTokens();

    if (!tokens?.accessToken) {
      toast.error('登录状态已失效，请重新登录后再试。');
      return;
    }

    setIsMutating(true);

    try {
      const updatedConversation = await updateAiChatConversationTitle(
        tokens.accessToken,
        conversationId,
        nextTitle,
      );
      const updatedTitle = updatedConversation?.title ?? nextTitle;
      const updatedAt = updatedConversation?.updated_at ?? new Date().toISOString();

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title: updatedTitle,
                updated_at: updatedAt,
              }
            : conversation,
        ),
      );

      if (selectedConversationId === conversationId) {
        window.dispatchEvent(
          new CustomEvent('ai-chat:conversation-title-updated', {
            detail: { id: conversationId, title: updatedTitle },
          }),
        );
      }

      cancelEditConversation();
      toast.success('会话名称已更新');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '会话名称更新失败。');
    } finally {
      setIsMutating(false);
    }
  }

  function requestDeleteConversation(conversation: AiChatConversationSummary) {
    if (isChatStreaming) {
      toast.info('上一条回复仍在生成，请先停止或等待完成。');
      return;
    }

    setConversationPendingDeletion(conversation);
  }

  async function deleteConversation(conversation: AiChatConversationSummary) {
    if (isChatStreaming) {
      toast.info('上一条回复仍在生成，请先停止或等待完成。');
      return;
    }

    const tokens = getStoredAuthTokens();

    if (!tokens?.accessToken) {
      toast.error('登录状态已失效，请重新登录后再试。');
      setConversationPendingDeletion(null);
      return;
    }

    setIsMutating(true);

    try {
      await deleteAiChatConversation(tokens.accessToken, conversation.id);

      const nextConversations = conversations.filter((item) => item.id !== conversation.id);

      setConversations(nextConversations);
      setConversationPendingDeletion(null);
      toast.success('会话已删除');

      if (selectedConversationId !== conversation.id) {
        return;
      }

      const nextConversation = nextConversations[0];

      if (nextConversation) {
        selectConversation(nextConversation);
      } else {
        setSelectedConversationId(null);
        dispatchNewConversationEvent();
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '会话删除失败。');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <>
      <SidebarGroup className="min-h-0 flex-1">
        <SidebarGroupLabel>最近</SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 px-2">
              <Skeleton className="h-8 rounded-xl" />
              <Skeleton className="h-8 rounded-xl" />
              <Skeleton className="h-8 rounded-xl" />
            </div>
          ) : conversations.length ? (
            <SidebarMenu>
              {conversations.map((conversation) => {
                const isSelected = selectedConversationId === conversation.id;
                const isEditing = editingConversationId === conversation.id;

                return (
                  <SidebarMenuItem key={conversation.id}>
                    {isEditing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void commitEditConversation();
                        }}
                      >
                        <Input
                          autoFocus
                          value={editingTitle}
                          disabled={isActionBusy}
                          onBlur={() => void commitEditConversation()}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelEditConversation();
                            }
                          }}
                          className="h-8 rounded-xl bg-background"
                        />
                      </form>
                    ) : (
                      <>
                        <SidebarMenuButton
                          tooltip={conversation.title || '未命名会话'}
                          isActive={isSelected}
                          disabled={isMutating}
                          onClick={() => selectConversation(conversation)}
                        >
                          <MessageSquareIcon />
                          <span>{conversation.title || '未命名会话'}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction
                              showOnHover
                              aria-label="会话操作"
                              disabled={isActionBusy}
                            >
                              <MoreHorizontalIcon />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            alignOffset={-18}
                            sideOffset={6}
                            className="w-40"
                          >
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => startEditConversation(conversation)}
                              >
                                <PencilIcon />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => requestDeleteConversation(conversation)}
                              >
                                <Trash2Icon />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          ) : (
            <p
              className={cn(
                'px-3 py-2 text-sm text-sidebar-foreground/60',
                'group-data-[collapsible=icon]:hidden',
              )}
            >
              暂无最近会话
            </p>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog
        open={Boolean(conversationPendingDeletion)}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setConversationPendingDeletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除聊天？</AlertDialogTitle>
            <AlertDialogDescription>删除的对话不可恢复，是否确定要删除？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isMutating}
              onClick={(event) => {
                event.preventDefault();

                if (conversationPendingDeletion) {
                  void deleteConversation(conversationPendingDeletion);
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
