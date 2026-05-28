import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import SmoothStream from './index';

jest.mock('../Markdown', () => ({
  __esModule: true,
  default: ({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
    <div data-testid="markdown" data-streaming={String(!!isStreaming)}>
      {content}
    </div>
  ),
}));

describe('SmoothStream', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes streaming state to Markdown so expensive highlighting can be skipped', () => {
    render(
      <RecoilRoot>
        <SmoothStream text="streaming text" isLatestMessage={true} isStreaming={true} />
      </RecoilRoot>,
    );

    expect(screen.getByTestId('markdown')).toHaveAttribute('data-streaming', 'true');
  });

  it('renders settled content without streaming mode', () => {
    render(
      <RecoilRoot>
        <SmoothStream text="settled text" isLatestMessage={false} isStreaming={false} />
      </RecoilRoot>,
    );

    expect(screen.getByTestId('markdown')).toHaveAttribute('data-streaming', 'false');
  });

  it('defers fenced code blocks while streaming', () => {
    jest.useFakeTimers();
    render(
      <RecoilRoot>
        <SmoothStream
          text={['Intro', '```ts', 'const value = 1;', '```', 'Outro'].join('\n')}
          isLatestMessage={true}
          isStreaming={true}
        />
      </RecoilRoot>,
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('markdown')).toHaveTextContent('Intro');
    expect(screen.getByTestId('markdown')).toHaveTextContent('Outro');
    expect(screen.getByTestId('markdown')).not.toHaveTextContent('const value = 1;');
  });

  it('defers markdown tables while streaming', () => {
    jest.useFakeTimers();
    render(
      <RecoilRoot>
        <SmoothStream
          text={['Before', '| A | B |', '| - | - |', '| 1 | 2 |', 'After'].join('\n')}
          isLatestMessage={true}
          isStreaming={true}
        />
      </RecoilRoot>,
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('markdown')).toHaveTextContent('Before');
    expect(screen.getByTestId('markdown')).toHaveTextContent('After');
    expect(screen.getByTestId('markdown')).not.toHaveTextContent('| A | B |');
  });

  it('renders deferred rich blocks when settled', () => {
    render(
      <RecoilRoot>
        <SmoothStream
          text={[
            'Before',
            '$$x^2$$',
            '| A | B |',
            '| - | - |',
            '| 1 | 2 |',
            '```ts',
            'const value = 1;',
            '```',
          ].join('\n')}
          isLatestMessage={false}
          isStreaming={false}
        />
      </RecoilRoot>,
    );

    expect(screen.getByTestId('markdown')).toHaveTextContent('$$x^2$$');
    expect(screen.getByTestId('markdown')).toHaveTextContent('| A | B |');
    expect(screen.getByTestId('markdown')).toHaveTextContent('const value = 1;');
  });
});
