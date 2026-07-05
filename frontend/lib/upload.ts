import { notify } from './toast';

// Límites de tamaño de archivo (deben reflejar los del backend).
export const MB = 1024 * 1024;
export const ESCRITURA_LIMIT = 30 * MB; // escrituras / documento de propiedad
export const DEFAULT_DOC_LIMIT = 2 * MB; // cualquier otro documento
export const TEMPLATE_LIMIT = 20 * MB; // plantillas / formatos

// Keys de archivo (por formulario) que representan la escritura y permiten 50 MB.
const ESCRITURA_KEYS = new Set(['escritura', 'doc_propiedad']);

export const docLimitForKey = (key: string) =>
  ESCRITURA_KEYS.has(key) ? ESCRITURA_LIMIT : DEFAULT_DOC_LIMIT;

// Valida el tamaño contra un límite explícito; muestra toast y devuelve false si excede.
export function checkFileSize(file: File, limitBytes: number): boolean {
  if (file.size > limitBytes) {
    notify.error(`El archivo supera el máximo de ${Math.round(limitBytes / MB)} MB.`);
    return false;
  }
  return true;
}

// Valida un documento según su key (escritura 50 MB, el resto 2 MB).
export function checkDocSize(file: File, key: string): boolean {
  return checkFileSize(file, docLimitForKey(key));
}

// Verifica que estén presentes los documentos obligatorios (marcados con *).
// Muestra toast con el primer faltante y devuelve false para bloquear el envío.
export function ensureRequiredDocs(
  files: Record<string, File | undefined>,
  required: { key: string; label: string }[],
): boolean {
  const missing = required.find((r) => !files[r.key]);
  if (missing) {
    notify.error(`Falta subir el documento obligatorio: ${missing.label}.`);
    return false;
  }
  return true;
}

// Callback de error de react-hook-form: resume los fallos de validación en un
// toast lateral y lleva el foco/scroll al primer campo con error.
export function notifyFormErrors(errs: Record<string, any>) {
  const msgs = Object.values(errs)
    .map((e: any) => e?.message)
    .filter((m: any): m is string => typeof m === 'string');
  if (msgs.length === 0) {
    notify.error('Revisa los campos marcados en rojo antes de guardar.');
  } else if (msgs.length === 1) {
    notify.error(msgs[0]);
  } else {
    notify.error(`${msgs[0]} (y ${msgs.length - 1} campo(s) más por corregir).`);
  }
  const firstKey = Object.keys(errs)[0];
  if (firstKey && typeof document !== 'undefined') {
    const el = document.querySelector<HTMLElement>(`[name="${firstKey}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus?.();
  }
}
