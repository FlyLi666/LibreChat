import { useMemo } from 'react';
import { getFenceMarker, isFenceClose } from './fenceState';
import type { StreamBlock, StreamBlockKind, StreamQueueOptions } from './types';

const TABLE_DELIMITER_RE = /^ {0,3}\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;
const INLINE_MATH_RE = /(^|[^\\])\$(?!\$)([^$\n]+?)\$/g;

function splitLinesWithEndings(text: string) {
  return text.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line.length > 0) ?? [];
}

function isPipeTableStart(lines: string[], index: number) {
  const current = lines[index]?.trim();
  const next = lines[index + 1]?.trim();
  return Boolean(current?.includes('|') && next && TABLE_DELIMITER_RE.test(next));
}

function isMathBlockStart(line: string) {
  return line.trimStart().startsWith('$$');
}

function pushBlock(
  blocks: StreamBlock[],
  content: string,
  kind: StreamBlockKind,
  startOffset: number,
  streaming: boolean,
) {
  if (!content) {
    return;
  }
  const state = streaming && kind !== 'text' ? 'queued' : 'revealed';
  blocks.push({
    key: `${startOffset}:${kind}:${content.length}`,
    kind,
    state,
    content,
    startOffset,
    endOffset: startOffset + content.length,
  });
}

export function parseStreamBlocks(text: string, streaming: boolean): StreamBlock[] {
  const lines = splitLinesWithEndings(text);
  const blocks: StreamBlock[] = [];
  let textBuffer = '';
  let textStartOffset = 0;
  let offset = 0;
  let index = 0;

  const flushText = () => {
    pushBlock(blocks, textBuffer, 'text', textStartOffset, streaming);
    textBuffer = '';
  };

  while (index < lines.length) {
    const line = lines[index];
    const marker = getFenceMarker(line);

    if (marker) {
      flushText();
      const startOffset = offset;
      let content = line;
      offset += line.length;
      index += 1;

      while (index < lines.length) {
        const next = lines[index];
        content += next;
        offset += next.length;
        index += 1;
        if (isFenceClose(next, marker)) {
          break;
        }
      }

      pushBlock(blocks, content, 'code', startOffset, streaming);
      continue;
    }

    if (isMathBlockStart(line)) {
      flushText();
      const startOffset = offset;
      let content = line;
      offset += line.length;
      index += 1;

      if (line.trim() !== '$$') {
        pushBlock(blocks, content, 'math', startOffset, streaming);
        continue;
      }

      while (index < lines.length) {
        const next = lines[index];
        content += next;
        offset += next.length;
        index += 1;
        if (next.trim() === '$$') {
          break;
        }
      }

      pushBlock(blocks, content, 'math', startOffset, streaming);
      continue;
    }

    if (isPipeTableStart(lines, index)) {
      flushText();
      const startOffset = offset;
      let content = '';

      while (index < lines.length && lines[index].includes('|')) {
        const next = lines[index];
        content += next;
        offset += next.length;
        index += 1;
      }

      pushBlock(blocks, content, 'table', startOffset, streaming);
      continue;
    }

    if (!textBuffer) {
      textStartOffset = offset;
    }
    textBuffer += line;
    offset += line.length;
    index += 1;
  }

  flushText();

  if (streaming) {
    const lastTextBlock = [...blocks].reverse().find((block) => block.kind === 'text');
    if (lastTextBlock) {
      lastTextBlock.state = 'streaming';
    }
  }

  return blocks;
}

export function getRenderableStreamText(blocks: StreamBlock[], streaming: boolean) {
  if (!streaming) {
    return blocks.map((block) => block.content).join('');
  }

  return blocks
    .filter((block) => block.kind === 'text')
    .map((block) => block.content.replace(INLINE_MATH_RE, '$1'))
    .join('');
}

export function useStreamQueue(text: string, { streaming }: StreamQueueOptions) {
  return useMemo(() => {
    const blocks = parseStreamBlocks(text, streaming);
    return {
      blocks,
      renderableText: getRenderableStreamText(blocks, streaming),
      deferredCount: streaming ? blocks.filter((block) => block.kind !== 'text').length : 0,
    };
  }, [streaming, text]);
}
