import { Transform } from 'class-transformer';

/**
 * Patrones y límites compartidos por los DTOs.
 * Deben coincidir con las reglas del frontend (frontend/lib/validators.ts).
 */

/**
 * El frontend manda '' en campos opcionales vacíos; sin esto, @IsEmail/@Matches
 * rechazarían el string vacío. '' se trata como "no enviado".
 */
export const EmptyToUndefined = () =>
  Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  );
export const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñüÜ\s.'-]+$/;
export const TELEFONO_MX = /^\d{10}$/;
export const CLABE = /^\d{18}$/;
export const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
export const CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
export const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_NOMBRE = 120;
export const MAX_EMAIL = 254;
export const MAX_TEXTO_CORTO = 200;
export const MAX_TEXTO_LARGO = 2000;
export const MAX_MONTO = 999_999_999_999; // tope razonable para montos MXN
export const MAX_SUPERFICIE = 1_000_000; // m²

export const MSG = {
  soloLetras: 'Solo se permiten letras, espacios y acentos.',
  telefono: 'El teléfono debe tener exactamente 10 dígitos.',
  clabe: 'La CLABE debe tener exactamente 18 dígitos.',
  rfc: 'El RFC no tiene un formato válido.',
  curp: 'La CURP no tiene un formato válido.',
  fecha: 'La fecha debe tener formato AAAA-MM-DD.',
  email: 'El correo electrónico no es válido.',
};
