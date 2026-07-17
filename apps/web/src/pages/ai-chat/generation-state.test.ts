import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getChatStatusFromGeneration,
  isActiveGenerationStatus,
  markGenerationMessageStopped,
  mergeGenerationSnapshotMessages,
} from './generation-state.js';

function createSnapshot(
  overrides: Partial<Parameters<typeof mergeGenerationSnapshotMessages>[1]> = {},
): Parameters<typeof mergeGenerationSnapshotMessages>[1] {
  return {
    generation_id: 'generation-1',
    prompt: '问题',
    status: 'thinking',
    reasoning_content: '完整思考',
    content: '完整回答',
    error: null,
    ...overrides,
  };
}

test('active generation statuses only include queued, thinking and answering', () => {
  assert.equal(isActiveGenerationStatus('queued'), true);
  assert.equal(isActiveGenerationStatus('thinking'), true);
  assert.equal(isActiveGenerationStatus('answering'), true);
  assert.equal(isActiveGenerationStatus('completed'), false);
  assert.equal(isActiveGenerationStatus('failed'), false);
});

test('maps generation status to the existing message rendering states', () => {
  assert.equal(getChatStatusFromGeneration('queued'), 'streaming');
  assert.equal(getChatStatusFromGeneration('completed'), 'done');
  assert.equal(getChatStatusFromGeneration('cancelled'), 'stopped');
  assert.equal(getChatStatusFromGeneration('failed'), 'error');
});

test('stopping a generation preserves partial content and closes the streaming message state', () => {
  const message = {
    id: 'assistant-1',
    role: 'assistant' as const,
    content: '部分回答',
    reasoningContent: '部分思考',
    generationStatus: 'answering' as const,
    status: 'streaming' as const,
    time: '10:00',
  };
  const stoppedMessage = markGenerationMessageStopped(message);

  assert.equal(stoppedMessage.content, '部分回答');
  assert.equal(stoppedMessage.reasoningContent, '部分思考');
  assert.equal(stoppedMessage.generationStatus, 'answering');
  assert.equal(stoppedMessage.status, 'stopped');
});

test('cancelled snapshot updates the active assistant message instead of appending a duplicate', () => {
  const messages: Parameters<typeof mergeGenerationSnapshotMessages>[0] = [
    {
      id: 'user-1',
      role: 'user',
      content: '问题',
      status: 'done',
      time: '10:00',
    },
    {
      id: 'assistant-local',
      role: 'assistant',
      content: '',
      reasoningContent: '本地刚收到的思考',
      status: 'stopped',
      time: '10:01',
    },
  ];
  const result = mergeGenerationSnapshotMessages(
    messages,
    createSnapshot({
      status: 'cancelled',
      reasoning_content: '',
      content: '',
    }),
    'assistant-local',
  );

  assert.equal(result.messages.length, 2);
  assert.equal(result.assistantMessageId, 'assistant-local');
  assert.equal(result.messages[1]?.reasoningContent, '本地刚收到的思考');
  assert.equal(result.messages[1]?.status, 'stopped');
});

test('restoring a generation adds the missing user prompt before the assistant message', () => {
  const result = mergeGenerationSnapshotMessages(
    [],
    createSnapshot({
      status: 'cancelled',
      reasoning_content: '部分思考',
      content: '',
    }),
  );

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0]?.role, 'user');
  assert.equal(result.messages[0]?.content, '问题');
  assert.equal(result.messages[1]?.role, 'assistant');
  assert.equal(result.messages[1]?.status, 'stopped');
});

test('restoring a generation does not duplicate an already visible pending prompt', () => {
  const result = mergeGenerationSnapshotMessages(
    [
      {
        id: 'user-current',
        role: 'user',
        content: '问题',
        status: 'done',
        time: '10:00',
      },
    ],
    createSnapshot({
      status: 'thinking',
      reasoning_content: '',
      content: '',
    }),
  );

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages.filter((message) => message.role === 'user').length, 1);
});

test('restored snapshot replaces partial text and reuses the persisted assistant message', () => {
  const messages: Parameters<typeof mergeGenerationSnapshotMessages>[0] = [
    {
      id: 'user-1',
      role: 'user',
      content: '问题',
      status: 'done',
      time: '10:00',
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '完整',
      reasoningContent: '完整',
      status: 'done',
      time: '10:01',
    },
  ];
  const result = mergeGenerationSnapshotMessages(messages, createSnapshot());

  assert.equal(result.assistantMessageId, 'assistant-1');
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1]?.content, '完整回答');
  assert.equal(result.messages[1]?.reasoningContent, '完整思考');
  assert.equal(result.messages[1]?.status, 'streaming');
});

test('queued generation does not overwrite the previous completed assistant turn', () => {
  const messages: Parameters<typeof mergeGenerationSnapshotMessages>[0] = [
    {
      id: 'user-previous',
      role: 'user',
      content: '上一问',
      status: 'done',
      time: '09:59',
    },
    {
      id: 'assistant-previous',
      role: 'assistant',
      content: '上一答',
      status: 'done',
      time: '10:00',
    },
  ];
  const result = mergeGenerationSnapshotMessages(
    messages,
    createSnapshot({
      status: 'queued',
      reasoning_content: '',
      content: '',
    }),
  );

  assert.equal(result.messages.length, 4);
  assert.equal(result.messages[1]?.content, '上一答');
  assert.equal(result.messages[2]?.role, 'user');
  assert.equal(result.messages[2]?.content, '问题');
  assert.equal(result.assistantMessageId, 'generation-generation-1');

  const restoredAgain = mergeGenerationSnapshotMessages(
    result.messages,
    createSnapshot({
      status: 'queued',
      reasoning_content: '',
      content: '',
    }),
  );

  assert.equal(restoredAgain.messages.length, 4);
});

test('creates exactly one transient assistant message when history has not persisted one', () => {
  const messages: Parameters<typeof mergeGenerationSnapshotMessages>[0] = [
    {
      id: 'user-1',
      role: 'user',
      content: '问题',
      status: 'done',
      time: '10:00',
    },
  ];
  const first = mergeGenerationSnapshotMessages(messages, createSnapshot());
  const second = mergeGenerationSnapshotMessages(first.messages, createSnapshot());

  assert.equal(first.messages.length, 2);
  assert.equal(second.messages.length, 2);
  assert.equal(first.assistantMessageId, 'generation-generation-1');
  assert.equal(second.assistantMessageId, first.assistantMessageId);
});

test('failed snapshot preserves generated content and exposes the backend error', () => {
  const result = mergeGenerationSnapshotMessages(
    [],
    createSnapshot({
      status: 'failed',
      error: '模型执行失败',
    }),
  );
  const assistantMessage = result.messages[1];

  assert.equal(result.messages[0]?.role, 'user');
  assert.equal(assistantMessage?.content, '完整回答');
  assert.equal(assistantMessage?.reasoningContent, '完整思考');
  assert.equal(assistantMessage?.errorMessage, '模型执行失败');
  assert.equal(assistantMessage?.status, 'error');
});
