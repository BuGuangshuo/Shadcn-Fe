import * as React from 'react';

import type { ChatMessage } from '../types';

export function useMessageListScroll({
  messages,
  isConversationLoading,
}: {
  messages: ChatMessage[];
  isConversationLoading: boolean;
}) {
  const [isUserScrolling, setIsUserScrolling] = React.useState(false);
  const messageListRef = React.useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = React.useRef(true);
  const ignoreScrollRef = React.useRef(false);
  const shouldScrollLoadedConversationToTopRef = React.useRef(false);
  const scrollbarHideTimerRef = React.useRef<number | null>(null);

  const updateIsAtBottom = React.useCallback((element: HTMLDivElement) => {
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    isAtBottomRef.current = distanceToBottom <= 48;
  }, []);

  const showUserScrollbar = React.useCallback(() => {
    setIsUserScrolling(true);

    if (scrollbarHideTimerRef.current) {
      window.clearTimeout(scrollbarHideTimerRef.current);
    }

    scrollbarHideTimerRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
    }, 900);
  }, []);

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
      updateIsAtBottom(event.currentTarget);

      if (!ignoreScrollRef.current && event.nativeEvent.isTrusted) {
        showUserScrollbar();
      }
    },
    [showUserScrollbar, updateIsAtBottom],
  );

  const followLatestMessage = React.useCallback(() => {
    shouldScrollLoadedConversationToTopRef.current = false;
    isAtBottomRef.current = true;
  }, []);

  const showLoadedConversationFromTop = React.useCallback(() => {
    shouldScrollLoadedConversationToTopRef.current = true;
    isAtBottomRef.current = false;
  }, []);

  React.useLayoutEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    if (shouldScrollLoadedConversationToTopRef.current) {
      if (isConversationLoading) {
        return;
      }

      ignoreScrollRef.current = true;
      messageList.scrollTo({
        top: 0,
        behavior: 'auto',
      });

      window.requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
        shouldScrollLoadedConversationToTopRef.current = false;
        updateIsAtBottom(messageList);
      });
      return;
    }

    if (!isAtBottomRef.current) {
      return;
    }

    ignoreScrollRef.current = true;
    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: 'auto',
    });

    window.requestAnimationFrame(() => {
      ignoreScrollRef.current = false;
      updateIsAtBottom(messageList);
    });
  }, [isConversationLoading, messages, updateIsAtBottom]);

  React.useEffect(() => {
    return () => {
      if (scrollbarHideTimerRef.current) {
        window.clearTimeout(scrollbarHideTimerRef.current);
      }
    };
  }, []);

  return {
    messageListRef,
    isUserScrolling,
    handleScroll,
    showUserScrollbar,
    followLatestMessage,
    showLoadedConversationFromTop,
  };
}
