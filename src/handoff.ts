/**
 * ハンドオフプロンプトのパーサー
 *
 * エージェント応答から :::HANDOFF::: マーカーで囲まれたMarkdownを抽出する。
 * HITLと同じパターンだが、JSONではなく生Markdownを扱う。
 */

export function parseHandoffFromResult(text: string): {
  handoff: string | null;
  cleanText: string;
} {
  const regex = /:::HANDOFF:::\s*([\s\S]*?)\s*:::END_HANDOFF:::/;
  const match = text.match(regex);

  if (!match) return { handoff: null, cleanText: text };

  const handoff = match[1].trim();
  if (!handoff) return { handoff: null, cleanText: text };

  const cleanText = text.replace(regex, "").trim();
  return { handoff, cleanText };
}
