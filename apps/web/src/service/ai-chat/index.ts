import {
  type AbstractXRequestClass,
  type SSEOutput,
  XRequest,
} from "@ant-design/x-sdk"

export const AI_CHAT_STREAM_PATH = "/api/v1/ai/chat/stream"
export const AI_CHAT_THINKING_MAX_TOKENS = 4096

const AI_CHAT_STREAM_URL =
  import.meta.env.VITE_AI_CHAT_API_URL || AI_CHAT_STREAM_PATH

export type AiChatStreamEventType =
  | "session"
  | "reasoning"
  | "delta"
  | "done"
  | "error"

export type AiChatRequestPayload = {
  message: string
  session_id?: string | null
  enable_thinking?: boolean
  model?: string | null
  temperature?: number | null
  max_tokens?: number | null
  system_prompt?: string | null
}

export type AiChatStreamEvent = {
  type: AiChatStreamEventType | null
  sessionId: string | null
  content: string
  message: string | null
  reasoning: string | null
  errorMessage: string | null
}

export type AiChatStreamRequest = AbstractXRequestClass<
  AiChatRequestPayload,
  SSEOutput
>

type AiChatStreamCallbacks = {
  onUpdate?: (chunk: SSEOutput) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function createAiChatStreamRequest(
  accessToken: string,
  callbacks: AiChatStreamCallbacks
) {
  return XRequest<AiChatRequestPayload, SSEOutput>(AI_CHAT_STREAM_URL, {
    manual: true,
    timeout: 30000,
    streamTimeout: 45000,
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    callbacks: {
      onUpdate: (chunk) => callbacks.onUpdate?.(chunk),
      onSuccess: () => callbacks.onSuccess?.(),
      onError: (error) => callbacks.onError?.(error),
    },
  })
}

export function parseAiChatStreamChunk(chunk: SSEOutput): AiChatStreamEvent {
  const type = extractEventType(chunk)
  const data = readChunkData(chunk)

  return {
    type,
    sessionId: readStringRecordValue(data, "session_id"),
    content: type ? extractContent(data) : extractChunkText(chunk),
    message: readStringRecordValue(data, "message"),
    reasoning: readStringRecordValue(data, "reasoning"),
    errorMessage:
      type === "error"
        ? readStringRecordValue(data, "message") || "AI 服务返回错误。"
        : null,
  }
}

export function getAiChatFriendlyErrorMessage(error: Error) {
  if (error.name === "AbortError") {
    return "已停止生成。"
  }

  if (error.message === "TimeoutError") {
    return "请求超时，请稍后重试。"
  }

  if (error.message === "StreamTimeoutError") {
    return "长时间没有收到新内容，请稍后重试。"
  }

  if (/status 401|status 403/.test(error.message)) {
    return "当前没有访问该 AI 服务的权限，请检查登录状态或接口鉴权配置。"
  }

  if (/status 404/.test(error.message)) {
    return "AI 接口地址不可用，请检查接口配置。"
  }

  if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
    return "无法连接到 AI 服务，请检查网络、接口地址或跨域配置。"
  }

  return "AI 服务暂时不可用，请稍后再试。"
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function readTextDelta(payload: unknown): string {
  if (payload == null || payload === "[DONE]") {
    return ""
  }

  if (typeof payload === "string") {
    const parsedPayload = parseJSON(payload)
    return parsedPayload === payload ? payload : readTextDelta(parsedPayload)
  }

  if (typeof payload !== "object") {
    return String(payload)
  }

  const data = payload as Record<string, unknown>
  const choices = data.choices

  if (Array.isArray(choices)) {
    return choices
      .map((choice) => {
        const item = choice as Record<string, unknown>
        const delta = item.delta as Record<string, unknown> | undefined
        const message = item.message as Record<string, unknown> | undefined

        return (
          readTextDelta(delta?.content) ||
          readTextDelta(message?.content) ||
          readTextDelta(item.text)
        )
      })
      .join("")
  }

  return (
    readTextDelta(data.delta) ||
    readTextDelta(data.content) ||
    readTextDelta(data.message) ||
    readTextDelta(data.answer) ||
    readTextDelta(data.text)
  )
}

function extractChunkText(chunk: SSEOutput) {
  return readTextDelta(chunk.data ?? chunk)
}

function readChunkData(chunk: SSEOutput): unknown {
  return typeof chunk.data === "string" ? parseJSON(chunk.data) : chunk.data
}

function readRecordValue(data: unknown, key: string) {
  if (!data || typeof data !== "object") {
    return null
  }

  return (data as Record<string, unknown>)[key] ?? null
}

function readStringRecordValue(data: unknown, key: string) {
  const value = readRecordValue(data, key)
  return typeof value === "string" ? value : null
}

function extractEventType(chunk: SSEOutput): AiChatStreamEventType | null {
  const event = (chunk as { event?: unknown }).event
  const type = (chunk as { type?: unknown }).type
  const value = typeof event === "string" ? event : type

  switch (value) {
    case "session":
    case "reasoning":
    case "delta":
    case "done":
    case "error":
      return value
    default:
      return null
  }
}

function extractContent(data: unknown) {
  return readTextDelta(readRecordValue(data, "content") ?? data)
}
