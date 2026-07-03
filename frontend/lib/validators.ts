// lib/validators.ts — Reglas de validación compartidas por todos los formularios.
// Deben coincidir con el backend (backend/src/common/validation/patterns.ts).
import * as z from 'zod';

/* ── Regex ── */
export const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñüÜ\s.'-]+$/;
export const TELEFONO_MX = /^\d{10}$/;
export const CLABE_RE = /^\d{18}$/;
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
export const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
export const MONTO_RE = /^\d+(\.\d{1,2})?$/; // máx. 2 decimales, sin notación científica

/* ── Límites (alineados con la BD / backend) ── */
export const MAX_NOMBRE = 120;
export const MAX_EMAIL = 254;
export const MAX_TEXTO_CORTO = 200;
export const MAX_TEXTO_LARGO = 2000;
export const MAX_MONTO = 999_999_999_999;
export const MAX_SUPERFICIE = 1_000_000;

/* ── Mensajes ── */
export const MSG = {
  requerido: 'Este campo es requerido.',
  soloLetras: 'Solo se permiten letras, espacios y acentos.',
  telefono: 'El teléfono debe tener exactamente 10 dígitos.',
  clabe: 'La CLABE debe tener exactamente 18 dígitos.',
  rfc: 'El RFC no tiene un formato válido.',
  curp: 'La CURP no tiene un formato válido.',
  email: 'Ingresa un correo electrónico válido.',
  monto: 'Ingresa un monto válido (máximo 2 decimales).',
  montoPositivo: 'El monto debe ser mayor a cero.',
  fechaFutura: 'La fecha no puede ser futura.',
  fechaPasada: 'La fecha no puede ser anterior a hoy.',
};

/* ── Piezas zod reutilizables ── */

export const zNombre = z
  .string()
  .trim()
  .min(1, MSG.requerido)
  .max(MAX_NOMBRE, `Máximo ${MAX_NOMBRE} caracteres.`)
  .regex(SOLO_LETRAS, MSG.soloLetras);

export const zNombreOpcional = z
  .string()
  .trim()
  .max(MAX_NOMBRE, `Máximo ${MAX_NOMBRE} caracteres.`)
  .refine((v) => v === '' || SOLO_LETRAS.test(v), MSG.soloLetras)
  .optional()
  .or(z.literal(''));

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, MSG.requerido)
  .max(MAX_EMAIL)
  .email(MSG.email);

export const zEmailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL)
  .refine((v) => v === '' || z.string().email().safeParse(v).success, MSG.email)
  .optional()
  .or(z.literal(''));

export const zTelefono = z.string().trim().regex(TELEFONO_MX, MSG.telefono);
export const zTelefonoOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || TELEFONO_MX.test(v), MSG.telefono)
  .optional()
  .or(z.literal(''));

export const zRfcOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || RFC_RE.test(v), MSG.rfc)
  .optional()
  .or(z.literal(''));

export const zCurpOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || CURP_RE.test(v), MSG.curp)
  .optional()
  .or(z.literal(''));

export const zClabe = z.string().trim().regex(CLABE_RE, MSG.clabe);

/** Monto en string (inputs de texto): requerido, > 0, máx 2 decimales. */
export const zMontoStr = z
  .string()
  .trim()
  .min(1, MSG.requerido)
  .regex(MONTO_RE, MSG.monto)
  .refine((v) => Number.parseFloat(v) > 0, MSG.montoPositivo)
  .refine((v) => Number.parseFloat(v) <= MAX_MONTO, 'El monto excede el máximo permitido.');

/** Monto opcional en string: vacío o número válido ≥ 0 con máx 2 decimales. */
export const zMontoStrOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || (MONTO_RE.test(v) && Number.parseFloat(v) <= MAX_MONTO), MSG.monto)
  .optional()
  .or(z.literal(''));

/* ── Fechas ── */

/** Fecha ISO (AAAA-MM-DD) que no puede ser futura (p. ej. nacimiento, captación). */
export const zFechaNoFutura = z
  .string()
  .trim()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Fecha inválida.')
  .refine((v) => v === '' || new Date(v + 'T00:00:00') <= new Date(), MSG.fechaFutura)
  .optional()
  .or(z.literal(''));

/** Fecha ISO cualquiera (válida si no está vacía). */
export const zFechaOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Fecha inválida.')
  .optional()
  .or(z.literal(''));

/* ── Helpers de parseo/normalización ── */

/** parseFloat seguro: NaN/Infinity → fallback. */
export function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Deja solo dígitos (para teléfono/CLABE mientras se escribe). */
export function soloDigitos(value: string, maxLen?: number): string {
  const d = value.replace(/\D+/g, '');
  return maxLen ? d.slice(0, maxLen) : d;
}

/** Formatea MXN sin crashear con null/undefined/NaN. */
export function formatMoney(value: unknown): string {
  const n = toNumber(value, 0);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

/** Mensaje de error legible desde una respuesta axios (backend Nest). */
export function getApiErrorMessage(err: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ');
  if (typeof msg === 'string' && msg.length > 0) return msg;
  return fallback;
}
