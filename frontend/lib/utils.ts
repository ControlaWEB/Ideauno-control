// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency = 'MXN'): string {
  const n = Number(amount);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  // Fecha inválida: Intl.format lanzaría RangeError y tiraría la página
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function getInitials(name: string | null | undefined): string {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '—';
}

export function pldStatus(amount: number): 'alert' | 'warning' | 'ok' {
  const threshold = 941412.75;
  if (amount >= threshold) return 'alert';
  if (amount >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function pldLabel(status: 'alert' | 'warning' | 'ok'): string {
  return { alert: 'PLD Requerido', warning: 'Revisar', ok: 'OK' }[status];
}
