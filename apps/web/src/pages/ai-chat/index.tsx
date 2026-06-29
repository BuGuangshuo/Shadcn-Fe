import * as React from "react"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  BotIcon,
  LoaderCircleIcon,
  SendIcon,
  SquareIcon,
  UserIcon,
} from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  AI_CHAT_THINKING_MAX_TOKENS,
  type AiChatStreamRequest,
  createAiChatStreamRequest,
  getAiChatFriendlyErrorMessage,
  parseAiChatStreamChunk,
} from "@/service/ai-chat"
import { MarkdownContent } from "@/components/markdown-content"
import { getStoredAuthTokens } from "@/service/auth"

type ChatRole = "assistant" | "user"
type ChatStatus = "streaming" | "error" | "done"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  reasoning?: string
  status?: ChatStatus
}

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "你好，我是 AI 助手。你可以直接输入问题，我会帮您解答",
    status: "done",
  },
]

function createMessageId(role: ChatRole) {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const hasReasoning = !isUser && Boolean(message.reasoning)

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar size="sm" className="mt-1">
          <AvatarFallback>
            <BotIcon />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "flex max-w-[min(42rem,85%)] flex-col gap-2",
          isUser && "items-end"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-card-foreground",
            message.status === "error" && "border-destructive/40"
          )}
        >
          {hasReasoning && (
            <details className="mb-3 rounded-xl border bg-muted/30 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                思考过程
              </summary>
              <p className="mt-2 text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                {message.reasoning}
              </p>
            </details>
          )}
          {message.content && isUser ? (
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <LoaderCircleIcon className="animate-spin" />
              正在思考...
            </span>
          )}
        </div>
        {message.status === "streaming" && (
          <span className="text-xs text-muted-foreground">正在生成</span>
        )}
        {message.status === "error" && (
          <span className="text-xs text-destructive">生成失败</span>
        )}
      </div>
      {isUser && (
        <Avatar size="sm" className="mt-1">
          <AvatarFallback>
            <UserIcon />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

export function AiChatPage() {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = React.useState("")
  const [enableThinking, setEnableThinking] = React.useState(true)
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [isUserScrolling, setIsUserScrolling] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const sessionIdRef = React.useRef<string | null>(null)
  const requestRef = React.useRef<AiChatStreamRequest | null>(null)
  const messageListRef = React.useRef<HTMLDivElement | null>(null)
  const isAtMessageListBottomRef = React.useRef(true)
  const ignoreMessageScrollRef = React.useRef(false)
  const scrollbarHideTimerRef = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    const messageList = messageListRef.current

    if (!messageList || !isAtMessageListBottomRef.current) {
      return
    }

    ignoreMessageScrollRef.current = true
    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: "auto",
    })

    window.requestAnimationFrame(() => {
      ignoreMessageScrollRef.current = false
      updateIsAtMessageListBottom(messageList)
    })
  }, [messages])

  React.useEffect(() => {
    return () => {
      requestRef.current?.abort()

      if (scrollbarHideTimerRef.current) {
        window.clearTimeout(scrollbarHideTimerRef.current)
      }
    }
  }, [])

  function updateIsAtMessageListBottom(element: HTMLDivElement) {
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight

    isAtMessageListBottomRef.current = distanceToBottom <= 48
  }

  function showUserScrollbar() {
    setIsUserScrolling(true)

    if (scrollbarHideTimerRef.current) {
      window.clearTimeout(scrollbarHideTimerRef.current)
    }

    scrollbarHideTimerRef.current = window.setTimeout(() => {
      setIsUserScrolling(false)
    }, 900)
  }

  function handleMessageListScroll(
    event: React.UIEvent<HTMLDivElement, UIEvent>
  ) {
    updateIsAtMessageListBottom(event.currentTarget)

    if (!ignoreMessageScrollRef.current && event.nativeEvent.isTrusted) {
      showUserScrollbar()
    }
  }

  function updateAssistantMessage(
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? updater(message) : message
      )
    )
  }

  function handleStop() {
    requestRef.current?.abort()
    setIsStreaming(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = input.trim()
    if (!prompt) {
      setErrorMessage("请输入问题后再发送。")
      return
    }

    if (isStreaming) {
      toast.info("上一条回复仍在生成，请先停止或等待完成。")
      return
    }

    const tokens = getStoredAuthTokens()
    if (!tokens?.accessToken) {
      const message = "登录状态已失效，请重新登录后再试。"
      setErrorMessage(message)
      toast.error(message)
      return
    }

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: prompt,
      status: "done",
    }
    const assistantMessage: ChatMessage = {
      id: createMessageId("assistant"),
      role: "assistant",
      content: "",
      status: "streaming",
    }
    const nextMessages = [...messages, userMessage, assistantMessage]
    let streamedContent = ""
    let streamedReasoning = ""
    let streamFailed = false

    isAtMessageListBottomRef.current = true
    setMessages(nextMessages)
    setInput("")
    setErrorMessage(null)
    setIsStreaming(true)

    const request = createAiChatStreamRequest(tokens.accessToken, {
      onUpdate: (chunk) => {
        const event = parseAiChatStreamChunk(chunk)

        if (event.sessionId) {
          sessionIdRef.current = event.sessionId
        }

        if (event.type === "session") {
          return
        }

        if (event.type === "reasoning") {
          if (!enableThinking) {
            return
          }

          if (!event.content) {
            return
          }

          streamedReasoning += event.content
          updateAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            reasoning: streamedReasoning,
          }))
          return
        }

        if (event.type === "delta") {
          if (!event.content) {
            return
          }

          streamedContent += event.content
          updateAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            content: streamedContent,
          }))
          return
        }

        if (event.type === "done") {
          streamedContent = event.message ?? streamedContent
          streamedReasoning = enableThinking
            ? (event.reasoning ?? streamedReasoning)
            : ""
          updateAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            content: streamedContent,
            reasoning: streamedReasoning || undefined,
            status: "done",
          }))
          return
        }

        if (event.type === "error") {
          const streamErrorMessage = event.errorMessage || "AI 服务返回错误。"

          streamFailed = true
          setIsStreaming(false)
          setErrorMessage(streamErrorMessage)
          toast.error(streamErrorMessage)
          updateAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            content: message.content || streamErrorMessage,
            status: "error",
          }))
          return
        }

        if (!event.content) {
          return
        }

        streamedContent += event.content
        updateAssistantMessage(assistantMessage.id, (message) => ({
          ...message,
          content: streamedContent,
        }))
      },
      onSuccess: () => {
        if (streamFailed) {
          return
        }

        setIsStreaming(false)
        updateAssistantMessage(assistantMessage.id, (message) => ({
          ...message,
          content:
            message.content ||
            (message.reasoning
              ? "服务没有返回正式回答，请稍后重试或关闭思考模式。"
              : "服务没有返回可展示的内容。"),
          status: "done",
        }))
      },
      onError: (error) => {
        const friendlyMessage = getAiChatFriendlyErrorMessage(error)

        setIsStreaming(false)
        setErrorMessage(friendlyMessage)

        if (error.name !== "AbortError") {
          toast.error(friendlyMessage)
        }

        updateAssistantMessage(assistantMessage.id, (message) => ({
          ...message,
          content: message.content || friendlyMessage,
          status: error.name === "AbortError" ? "done" : "error",
        }))
      },
    })

    requestRef.current = request
    request.run({
      message: prompt,
      session_id: sessionIdRef.current,
      enable_thinking: enableThinking,
      max_tokens: enableThinking ? AI_CHAT_THINKING_MAX_TOKENS : undefined,
    })
  }

  return (
    <div className="box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <Card className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden">
        <CardHeader className="shrink-0 gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <BotIcon />
                AI 小助手
              </CardTitle>
            </div>
          </div>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>请求失败</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="min-h-0 overflow-hidden p-0">
          <div
            ref={messageListRef}
            className={cn(
              "flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-4 py-5 md:px-6",
              isUserScrolling
                ? "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
                : "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
            onScroll={handleMessageListScroll}
            onTouchMove={showUserScrollbar}
            onWheel={showUserScrollbar}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="sticky bottom-0 z-10 shrink-0 bg-card p-4 md:p-6">
          <form className="w-full" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ai-chat-input" className="sr-only">
                  输入消息
                </FieldLabel>
                <div className="flex flex-col gap-3 rounded-2xl border bg-background p-3 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                  <Textarea
                    id="ai-chat-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        if (!event.currentTarget.value.trim()) {
                          return
                        }
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                    placeholder="输入你的问题，按 Enter 发送，Shift + Enter 换行"
                    disabled={isStreaming}
                    className="max-h-40 min-h-20 border-0 bg-transparent px-0 py-1.5 leading-6 shadow-none focus-visible:ring-0"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ai-chat-enable-thinking"
                        checked={enableThinking}
                        onCheckedChange={setEnableThinking}
                        disabled={isStreaming}
                      />
                      <FieldLabel
                        htmlFor="ai-chat-enable-thinking"
                        className="cursor-pointer text-sm font-normal"
                      >
                        思考模式
                      </FieldLabel>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {isStreaming ? (
                        <Button type="button" onClick={handleStop}>
                          <SquareIcon data-icon="inline-start" />
                          停止
                        </Button>
                      ) : (
                        <Button type="submit" disabled={!input.trim()}>
                          <SendIcon data-icon="inline-start" />
                          发送
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
