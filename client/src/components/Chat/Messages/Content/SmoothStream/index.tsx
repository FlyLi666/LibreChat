import { memo } from 'react';
import Markdown from '../Markdown';
import { useSmoothStreamContent } from './useSmoothStreamContent';
import { useStreamQueue } from './useStreamQueue';
import styles from './style.module.css';

type SmoothStreamProps = {
  text: string;
  isLatestMessage: boolean;
  isStreaming: boolean;
};

const SmoothStream = memo(function SmoothStream({
  text,
  isLatestMessage,
  isStreaming,
}: SmoothStreamProps) {
  const displayed = useSmoothStreamContent(text, { streaming: isStreaming });
  const { renderableText } = useStreamQueue(displayed, { streaming: isStreaming });

  return (
    <div className={isStreaming ? styles.stream : undefined}>
      <Markdown
        content={renderableText}
        isLatestMessage={isLatestMessage}
        isStreaming={isStreaming}
      />
    </div>
  );
});

export default SmoothStream;
