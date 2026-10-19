import type { SourceFormat } from '@app/shared';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

import type { LineDocument } from '../types';

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'center',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'html',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);
const DROPPED_TAGS = ['script', 'style', 'noscript', 'template', 'nav', 'header', 'footer', 'head'];
const STRIKETHROUGH_TAGS = ['s', 'del', 'strike'];

/**
 * Walks the DOM collecting inline text; every block boundary or <br> closes a line. This yields one line per
 * p/li/h1–h6/td and per div without block children, without losing loose text inside containers.
 */
export function extractHtmlString(
  html: string,
  options: { dropStrikethrough: boolean },
  format: SourceFormat = 'html',
): LineDocument {
  const $ = cheerio.load(html);
  $(DROPPED_TAGS.join(',')).remove();
  if (options.dropStrikethrough) $(STRIKETHROUGH_TAGS.join(',')).remove();

  const texts: string[] = [];
  let buffer = '';
  const flush = () => {
    const text = buffer.replace(/\s+/g, ' ').trim();
    if (text) texts.push(text);
    buffer = '';
  };
  const walk = (node: AnyNode) => {
    if (node.type === 'text') {
      buffer += node.data;
      return;
    }
    if (node.type !== 'tag' && node.type !== 'root') return;
    const name = node.type === 'tag' ? node.name.toLowerCase() : 'root';
    if (name === 'br') return flush();
    const block = BLOCK_TAGS.has(name);
    if (block) flush();
    for (const child of node.children) walk(child);
    if (block) flush();
  };
  walk($.root()[0] as AnyNode);
  flush();

  return {
    format,
    pages: [
      { number: 1, height: texts.length, lines: texts.map((text, i) => ({ id: i, text, y: i, height: 1, page: 1 })) },
    ],
  };
}

export function extractHtml(buffer: Uint8Array, options: { dropStrikethrough: boolean }): LineDocument {
  return extractHtmlString(new TextDecoder('utf-8').decode(buffer), options);
}
