const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const DASH = '—';

/** Intl uses a non-breaking space after the currency symbol; plain spaces read better in tables and tests. */
const plainSpaces = (s: string) => s.replace(/ /g, ' ');

export const formatCurrencyBRL = (n: number) => plainSpaces(brl.format(n));

export function formatDate(iso: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes} min ${seconds} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export function formatPercent(n: number | null): string {
  return n === null || !Number.isFinite(n) ? DASH : `${(n * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatScore(n: number | null): string {
  return n === null || !Number.isFinite(n) ? DASH : n.toFixed(3).replace('.', ',');
}

export const formatUsd = (n: number) => `US$ ${usd.format(n)}`;

export const formatNumber = (n: number) => n.toLocaleString('pt-BR');
