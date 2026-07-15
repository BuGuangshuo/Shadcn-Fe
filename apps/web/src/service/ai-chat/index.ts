import { type SSEOutput, XStream } from '@ant-design/x-sdk';

export const AI_CHAT_STREAM_PATH = '/api/v1/ai/chat/stream';
export const AI_CHAT_CONVERSATIONS_PATH = '/api/v1/ai/chat/conversations';
export const AI_CHAT_CONVERSATIONS_SEARCH_PATH = `${AI_CHAT_CONVERSATIONS_PATH}/search`;
export const AI_CHAT_THINKING_MAX_TOKENS = 4096;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const AI_CHAT_STREAM_URL = import.meta.env.VITE_AI_CHAT_API_URL || AI_CHAT_STREAM_PATH;

export type AiChatStreamEventType = 'session' | 'title' | 'reasoning' | 'delta' | 'done' | 'error';

export type AiChatThinkingMode = 'auto' | 'thinking' | 'fast';

export type AiChatConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

export type AiChatConversationAttachment = {
  filename: string;
  content_type: string | null;
  size: number;
};

export type AiChatConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning_title?: string | null;
  reasoning_content?: string | null;
  attachments?: AiChatConversationAttachment[];
  created_at: string;
};

export type AiChatConversationDetail = {
  id: string;
  session_id: string;
  title: string;
  messages: AiChatConversationMessage[];
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

export type AiChatConversationListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: AiChatConversationSummary[];
};

export type AiChatConversationSearchType = 'conversation' | 'document';

export type AiChatConversationSearchResult = {
  conversation_id: string;
  title: string;
  type: AiChatConversationSearchType;
  content: string;
  time: string;
};

export type AiChatConversationSearchResponse = {
  total: number;
  page: number;
  page_size: number;
  items: AiChatConversationSearchResult[];
};

export type AiChatRequestPayload = {
  message: string;
  session_id?: string | null;
  thinking_mode?: AiChatThinkingMode;
  model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  system_prompt?: string | null;
  files?: AiChatUploadFile[];
};

export type AiChatUploadFile = {
  file: File;
  relativePath: string;
};

export type AiChatStreamEvent = {
  type: AiChatStreamEventType | null;
  sessionId: string | null;
  content: string;
  message: string | null;
  title: string | null;
  reasoning: string | null;
  reasoningTitle: string | null;
  reasoningContent: string | null;
  errorMessage: string | null;
};

export type AiChatStreamRequest = {
  run: (params: AiChatRequestPayload) => boolean;
  abort: () => void;
};

type AiChatStreamCallbacks = {
  onUpdate?: (chunk: SSEOutput) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export function createAiChatStreamRequest(accessToken: string, callbacks: AiChatStreamCallbacks) {
  return new AiChatStreamFetchRequest(accessToken, callbacks);
}

export async function listAiChatConversations(
  accessToken: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return aiChatJsonRequest<AiChatConversationListResponse>(
    `${AI_CHAT_CONVERSATIONS_PATH}?${searchParams.toString()}`,
    {
      accessToken,
    },
  );
}

export async function searchAiChatConversations(
  accessToken: string,
  params: {
    keyword: string;
    type?: AiChatConversationSearchType;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  },
) {
  const searchParams = new URLSearchParams({
    keyword: params.keyword,
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 8),
  });

  if (params.type) {
    searchParams.set('type', params.type);
  }

  return aiChatJsonRequest<AiChatConversationSearchResponse>(
    `${AI_CHAT_CONVERSATIONS_SEARCH_PATH}?${searchParams.toString()}`,
    {
      accessToken,
      signal: params.signal,
    },
  );
}

export async function getAiChatConversation(accessToken: string, conversationId: string) {
  return aiChatJsonRequest<AiChatConversationDetail>(
    `${AI_CHAT_CONVERSATIONS_PATH}/${conversationId}`,
    {
      accessToken,
    },
  );
}

export async function updateAiChatConversationTitle(
  accessToken: string,
  conversationId: string,
  title: string,
) {
  return aiChatJsonRequest<Partial<AiChatConversationDetail> | null>(
    `${AI_CHAT_CONVERSATIONS_PATH}/${conversationId}`,
    {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ title }),
    },
  );
}

export async function deleteAiChatConversation(accessToken: string, conversationId: string) {
  return aiChatJsonRequest<null>(`${AI_CHAT_CONVERSATIONS_PATH}/${conversationId}`, {
    method: 'DELETE',
    accessToken,
  });
}

type AiChatJsonRequestOptions = RequestInit & {
  accessToken: string;
};

class AiChatStreamFetchRequest implements AiChatStreamRequest {
  private abortController: AbortController | null = null;
  private readonly accessToken: string;
  private readonly callbacks: AiChatStreamCallbacks;
  private timeoutHandler: number | null = null;
  private streamTimeoutHandler: number | null = null;

  constructor(accessToken: string, callbacks: AiChatStreamCallbacks) {
    this.accessToken = accessToken;
    this.callbacks = callbacks;
  }

  run(params: AiChatRequestPayload) {
    this.abortController = new AbortController();
    void this.send(params, this.abortController);
    return true;
  }

  abort() {
    this.clearTimers();
    this.abortController?.abort();
  }

  private async send(params: AiChatRequestPayload, abortController: AbortController) {
    let isTimeout = false;

    this.timeoutHandler = window.setTimeout(() => {
      isTimeout = true;
      abortController.abort();
    }, 30000);

    try {
      const response = await fetch(AI_CHAT_STREAM_URL, {
        method: 'POST',
        headers: createAiChatRequestHeaders(this.accessToken, params),
        body: createAiChatRequestBody(params),
        signal: abortController.signal,
      });

      this.clearTimeoutHandler();

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const responseBody = response.body;

      if (!responseBody) {
        throw new Error('The response body is empty.');
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.split(';')[0].trim() === 'application/json') {
        await this.handleJsonResponse(response);
        return;
      }

      await this.handleSseResponse(responseBody);
    } catch (error) {
      this.clearTimers();

      if (isTimeout) {
        this.callbacks.onError?.(new Error('TimeoutError'));
        return;
      }

      this.callbacks.onError?.(normalizeAiChatError(error));
    }
  }

  private async handleJsonResponse(response: Response) {
    const chunk = await response.json();

    if (chunk?.success === false) {
      const error = new Error(chunk.message || 'System error');
      error.name = chunk.name || 'SystemError';
      throw error;
    }

    this.callbacks.onUpdate?.(chunk);
    this.callbacks.onSuccess?.();
  }

  private async handleSseResponse(responseBody: ReadableStream<Uint8Array>) {
    const stream = XStream<SSEOutput>({
      readableStream: responseBody,
    });
    const iterator = stream[Symbol.asyncIterator]();

    while (true) {
      let isStreamTimeout = false;

      this.streamTimeoutHandler = window.setTimeout(() => {
        isStreamTimeout = true;
        this.abortController?.abort();
      }, 45000);

      try {
        const result = await iterator.next();

        this.clearStreamTimeoutHandler();

        if (result.done) {
          break;
        }

        if (result.value) {
          this.callbacks.onUpdate?.(result.value);
        }
      } catch (error) {
        this.clearStreamTimeoutHandler();

        if (isStreamTimeout) {
          throw new Error('StreamTimeoutError', { cause: error });
        }

        throw error;
      }
    }

    this.callbacks.onSuccess?.();
  }

  private clearTimeoutHandler() {
    if (this.timeoutHandler) {
      window.clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  private clearStreamTimeoutHandler() {
    if (this.streamTimeoutHandler) {
      window.clearTimeout(this.streamTimeoutHandler);
      this.streamTimeoutHandler = null;
    }
  }

  private clearTimers() {
    this.clearTimeoutHandler();
    this.clearStreamTimeoutHandler();
  }
}

function createAiChatRequestHeaders(
  accessToken: string,
  params: AiChatRequestPayload,
): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${accessToken}`,
  };

  if (!params.files?.length) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function createAiChatRequestBody(params: AiChatRequestPayload) {
  if (!params.files?.length) {
    return JSON.stringify({
      message: params.message,
      session_id: params.session_id,
      model: params.model,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      system_prompt: params.system_prompt,
      thinking_mode: params.thinking_mode,
    });
  }

  const formData = new FormData();

  appendFormDataValue(formData, 'message', params.message);
  appendFormDataValue(formData, 'session_id', params.session_id);
  appendFormDataValue(formData, 'model', params.model);
  appendFormDataValue(formData, 'temperature', params.temperature);
  appendFormDataValue(formData, 'max_tokens', params.max_tokens);
  appendFormDataValue(formData, 'system_prompt', params.system_prompt);
  appendFormDataValue(formData, 'thinking_mode', params.thinking_mode);

  for (const uploadFile of params.files) {
    formData.append('files', uploadFile.file);
  }

  formData.append(
    'relative_paths',
    JSON.stringify(
      params.files.map((uploadFile) => uploadFile.relativePath || uploadFile.file.name),
    ),
  );

  return formData;
}

function appendFormDataValue(
  formData: FormData,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value == null) {
    return;
  }

  formData.append(key, String(value));
}

function normalizeAiChatError(error: unknown) {
  return error instanceof Error || error instanceof DOMException
    ? error
    : new Error('Unknown error!');
}

async function aiChatJsonRequest<T>(path: string, options: AiChatJsonRequestOptions) {
  const { accessToken, headers, body, ...init } = options;
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  if (body && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  requestHeaders.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers: requestHeaders,
  });
  const payload = await parseAiChatResponsePayload(response);

  if (!response.ok) {
    throw new Error(readAiChatErrorMessage(payload, response.statusText));
  }

  return payload as T;
}

async function parseAiChatResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readAiChatErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return fallback || '请求失败';
  }

  const message = (payload as { message?: unknown }).message;

  if (typeof message === 'string') {
    return message;
  }

  const detail = (payload as { detail?: unknown }).detail;

  if (typeof detail === 'string') {
    return detail;
  }

  return fallback || '请求失败';
}

export function parseAiChatStreamChunk(chunk: SSEOutput): AiChatStreamEvent {
  const type = extractEventType(chunk);
  const data = readChunkData(chunk);

  return {
    type,
    sessionId: readStringRecordValue(data, 'session_id'),
    content: type ? extractContent(data) : extractChunkText(chunk),
    message: readStringRecordValue(data, 'message'),
    title: readStringRecordValue(data, 'title'),
    reasoning: readStringRecordValue(data, 'reasoning'),
    reasoningTitle: readStringRecordValue(data, 'reasoning_title'),
    reasoningContent: readStringRecordValue(data, 'reasoning_content'),
    errorMessage:
      type === 'error' ? readStringRecordValue(data, 'message') || 'AI 服务返回错误。' : null,
  };
}

export function getAiChatFriendlyErrorMessage(error: Error) {
  if (error.name === 'AbortError') {
    return '已停止生成。';
  }

  if (error.message === 'TimeoutError') {
    return '请求超时，请稍后重试。';
  }

  if (error.message === 'StreamTimeoutError') {
    return '长时间没有收到新内容，请稍后重试。';
  }

  if (/status 401|status 403/.test(error.message)) {
    return '当前没有访问该 AI 服务的权限，请检查登录状态或接口鉴权配置。';
  }

  if (/status 404/.test(error.message)) {
    return 'AI 接口地址不可用，请检查接口配置。';
  }

  if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
    return '无法连接到 AI 服务，请检查网络、接口地址或跨域配置。';
  }

  return 'AI 服务暂时不可用，请稍后再试。';
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readTextDelta(payload: unknown): string {
  if (payload == null || payload === '[DONE]') {
    return '';
  }

  if (typeof payload === 'string') {
    const parsedPayload = parseJSON(payload);
    return parsedPayload === payload ? payload : readTextDelta(parsedPayload);
  }

  if (typeof payload !== 'object') {
    return String(payload);
  }

  const data = payload as Record<string, unknown>;
  const choices = data.choices;

  if (Array.isArray(choices)) {
    return choices
      .map((choice) => {
        const item = choice as Record<string, unknown>;
        const delta = item.delta as Record<string, unknown> | undefined;
        const message = item.message as Record<string, unknown> | undefined;

        return (
          readTextDelta(delta?.content) ||
          readTextDelta(message?.content) ||
          readTextDelta(item.text)
        );
      })
      .join('');
  }

  return (
    readTextDelta(data.delta) ||
    readTextDelta(data.content) ||
    readTextDelta(data.message) ||
    readTextDelta(data.answer) ||
    readTextDelta(data.text)
  );
}

function extractChunkText(chunk: SSEOutput) {
  return readTextDelta(chunk.data ?? chunk);
}

function readChunkData(chunk: SSEOutput): unknown {
  return typeof chunk.data === 'string' ? parseJSON(chunk.data) : chunk.data;
}

function readRecordValue(data: unknown, key: string) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  return (data as Record<string, unknown>)[key] ?? null;
}

function readStringRecordValue(data: unknown, key: string) {
  const value = readRecordValue(data, key);
  return typeof value === 'string' ? value : null;
}

function extractEventType(chunk: SSEOutput): AiChatStreamEventType | null {
  const event = (chunk as { event?: unknown }).event;
  const type = (chunk as { type?: unknown }).type;
  const value = typeof event === 'string' ? event : type;

  switch (value) {
    case 'session':
    case 'title':
    case 'reasoning':
    case 'delta':
    case 'done':
    case 'error':
      return value;
    default:
      return null;
  }
}

function extractContent(data: unknown) {
  return readTextDelta(readRecordValue(data, 'content') ?? data);
}
