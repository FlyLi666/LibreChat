import { getActiveAssistantId, getConversationRoutePath, isNewConversationRoute } from './routes';

describe('chat route helpers', () => {
  it('preserves the assistant route layer when opening a conversation from assistant new', () => {
    expect(getActiveAssistantId('/agent/lobe-ai/new')).toBe('lobe-ai');
    expect(
      getConversationRoutePath({
        pathname: '/agent/lobe-ai/new',
        conversationId: 'abc',
      }),
    ).toBe('/agent/lobe-ai/abc');
  });

  it('preserves the assistant route layer when navigating an assistant conversation to new', () => {
    expect(
      getConversationRoutePath({
        pathname: '/agent/lobe-ai/abc',
        conversationId: 'new',
      }),
    ).toBe('/agent/lobe-ai/new');
  });

  it('falls back to the normal chat route outside assistant pages', () => {
    expect(
      getConversationRoutePath({
        pathname: '/c/new',
        conversationId: 'abc',
      }),
    ).toBe('/c/abc');
  });

  it('preserves search params when provided', () => {
    expect(
      getConversationRoutePath({
        pathname: '/agent/lobe-ai/new',
        conversationId: 'conversation-1',
        search: '?model=gpt-5',
      }),
    ).toBe('/agent/lobe-ai/conversation-1?model=gpt-5');
  });

  it('detects new conversation routes in chat and assistant layers', () => {
    expect(isNewConversationRoute('/c/new')).toBe(true);
    expect(isNewConversationRoute('/agent/lobe-ai/new')).toBe(true);
    expect(isNewConversationRoute('/agent/lobe-ai/conversation-1')).toBe(false);
    expect(isNewConversationRoute('/agent/lobe-ai/settings')).toBe(false);
  });
});
