import { EModelEndpoint } from 'librechat-data-provider';
import { shouldPreserveNewChatDraft } from '../useNewConvo';

describe('shouldPreserveNewChatDraft', () => {
  it('keeps typed text and staged files when the user switches model by preset', () => {
    expect(
      shouldPreserveNewChatDraft({
        preset: {
          endpoint: EModelEndpoint.openAI,
          model: 'gpt-4o',
        },
      }),
    ).toBe(true);
  });

  it('keeps typed text and staged files when the user switches model by template hint', () => {
    expect(
      shouldPreserveNewChatDraft({
        template: {
          endpoint: EModelEndpoint.google,
          model: 'gemini-2.5-pro',
        },
      }),
    ).toBe(true);
  });

  it('clears typed text and staged files only for a true new chat', () => {
    expect(shouldPreserveNewChatDraft({})).toBe(false);
    expect(shouldPreserveNewChatDraft({ template: { title: 'New Chat' } })).toBe(false);
  });
});
