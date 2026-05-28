import { getStreamCharStyle } from './streamAnimationMeta';

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const SKIP_TAGS = new Set(['pre', 'code', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'svg']);

function hasClass(node: HastNode, className: string) {
  const raw = node.properties?.className;
  if (Array.isArray(raw)) {
    return raw.includes(className);
  }
  return typeof raw === 'string' && raw.split(/\s+/).includes(className);
}

function shouldSkipNode(node: HastNode) {
  return Boolean(node.tagName && (SKIP_TAGS.has(node.tagName) || hasClass(node, 'katex')));
}

function toCharNode(char: string, index: number): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['hezi-stream-char'],
      style: getStreamCharStyle(index),
    },
    children: [{ type: 'text', value: char }],
  };
}

function transformChildren(node: HastNode, skip: boolean, offset: { current: number }) {
  if (!node.children?.length) {
    return;
  }

  const nextChildren: HastNode[] = [];
  const childSkip = skip || shouldSkipNode(node);

  for (const child of node.children) {
    if (!childSkip && child.type === 'text' && child.value) {
      for (const char of Array.from(child.value)) {
        if (/\s/.test(char)) {
          nextChildren.push({ type: 'text', value: char });
        } else {
          nextChildren.push(toCharNode(char, offset.current));
        }
        offset.current += 1;
      }
      continue;
    }

    transformChildren(child, childSkip, offset);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

export function rehypeStreamAnimated() {
  return (tree: HastNode) => {
    transformChildren(tree, false, { current: 0 });
  };
}
