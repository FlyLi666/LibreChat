import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useSmoothStreamContent } from './useSmoothStreamContent';

function Harness({ text, streaming = true }: { text: string; streaming?: boolean }) {
  const displayed = useSmoothStreamContent(text, { streaming });
  return <div data-testid="displayed">{displayed}</div>;
}

describe('useSmoothStreamContent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not reveal all new text in one render while streaming', () => {
    const { rerender } = render(<Harness text="hello" />);

    rerender(<Harness text="hello world this is a longer response" />);

    const displayed = screen.getByTestId('displayed').textContent ?? '';
    expect(displayed.length).toBeGreaterThan(0);
    expect(displayed.length).toBeLessThan('hello world this is a longer response'.length);
  });

  it('drains to the final text after animation frames', () => {
    render(<Harness text="smooth streaming response" />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('displayed')).toHaveTextContent('smooth streaming response');
  });

  it('renders immediately when not streaming', () => {
    render(<Harness text="settled content" streaming={false} />);

    expect(screen.getByTestId('displayed')).toHaveTextContent('settled content');
  });

  it('bypasses the queue for large appends over the PRD threshold', () => {
    const large = 'x'.repeat(201);
    render(<Harness text={large} />);

    expect(screen.getByTestId('displayed')).toHaveTextContent(large);
  });
});
