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
