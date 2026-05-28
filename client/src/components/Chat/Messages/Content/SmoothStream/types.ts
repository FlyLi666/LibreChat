export type StreamBlockKind = 'text' | 'code' | 'math' | 'table';

export type StreamBlockState = 'queued' | 'streaming' | 'animating' | 'revealed';

export type StreamBlock = {
  key: string;
  kind: StreamBlockKind;
  state: StreamBlockState;
  content: string;
  startOffset: number;
  endOffset: number;
};

export type StreamQueueOptions = {
  streaming: boolean;
};
