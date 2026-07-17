import type { ChatMessage, ChatMode } from './types';

export const INITIAL_MESSAGES: ChatMessage[] = [];
export const SELECTED_CONVERSATION_STORAGE_KEY = 'ai-chat:selected-conversation-id';

export const MAX_ATTACHMENT_COUNT = 20;
export const MAX_ATTACHMENT_TOTAL_SIZE = 20 * 1024 * 1024;

export const CHAT_MODE_OPTIONS: Array<{
  value: ChatMode;
  label: string;
  description: string;
}> = [
  { value: 'auto', label: '自动', description: '由服务自动选择回复策略' },
  { value: 'thinking', label: '思考', description: '更深入的分析和推理' },
  { value: 'fast', label: '快速', description: '快速响应，适合简单问题' },
];

export const VOICE_WAVEFORM_BAR_COUNT = 72;
export const VOICE_WAVEFORM_MIN_LEVEL = 0.08;
