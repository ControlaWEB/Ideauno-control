// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
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
