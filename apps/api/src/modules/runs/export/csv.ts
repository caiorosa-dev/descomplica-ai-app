export type CsvValue = string | number | boolean | null;

function cell(value: CsvValue | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 CSV with BOM, comma separator, CRLF line breaks and RFC 4180 quoting, ready for spreadsheets. */
export function toCsv(rows: Record<string, CsvValue>[], columns: string[]): string {
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))];
  return `﻿${lines.map((l) => `${l}\r\n`).join('')}`;
}
