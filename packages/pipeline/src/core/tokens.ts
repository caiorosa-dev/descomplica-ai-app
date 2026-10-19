import { decode, encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  return text ? encode(text).length : 0;
}

/** The first `n` tokens of the text (decoded back to a string). */
export function headTokens(text: string, n: number): string {
  if (n <= 0) return '';
  const tokens = encode(text);
  return tokens.length <= n ? text : decode(tokens.slice(0, n));
}

/** The last `n` tokens of the text (decoded back to a string). */
export function tailTokens(text: string, n: number): string {
  if (n <= 0) return '';
  const tokens = encode(text);
  return tokens.length <= n ? text : decode(tokens.slice(-n));
}
