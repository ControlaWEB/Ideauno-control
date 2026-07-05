import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  async onModuleInit() {
    try {
      const { error } = await this.supabase.rpc('exec_sql_select', {
        sql_text: 'SELECT 1 as ping',
        params: [],
      });
      if (error) throw error;
      console.log('[DB] Conexión a Supabase exitosa');
    } catch (err) {
      console.error('[DB] Error al conectar:', (err as Error).message);
    }
  }

  get storageClient() {
    return this.supabase.storage;
  }

  async query<T = any>(
    text: string,
    params?: Record<string, any>,
  ): Promise<T[]> {
    let processedText = text;
    const values: (string | null)[] = [];

    if (params && typeof params === 'object') {
      let index = 1;
      for (const [key, value] of Object.entries(params)) {
        const regex = new RegExp(`@${key}\\b`, 'g');
        if (processedText.match(regex)) {
          processedText = processedText.replace(regex, `$${index}`);
          values.push(
            value === null || value === undefined ? null : String(value),
          );
          index++;
        }
      }
    }

    const isSelect = /^\s*select/i.test(processedText.trim());

    try {
      return await this.runWithRetry<T>(isSelect, processedText, values);
    } catch (err) {
      console.error(
        'Database query error:',
        err,
        '\nQuery:',
        processedText,
        '\nValues:',
        values,
      );
      throw err;
    }
  }

  // Reintenta ante fallos de RED (fetch failed / connect timeout / reset).
  // El dashboard dispara ~11 queries en paralelo; un micro-corte de conexión
  // a Supabase no debe tumbar el endpoint completo.
  private async runWithRetry<T>(
    isSelect: boolean,
    sqlText: string,
    values: (string | null)[],
    maxAttempts = 3,
  ): Promise<T[]> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (isSelect) {
          const { data, error } = await this.supabase.rpc('exec_sql_select', {
            sql_text: sqlText,
            params: values,
          });
          if (error) throw error;
          return (Array.isArray(data) ? data : []) as T[];
        } else {
          const { error } = await this.supabase.rpc('exec_sql_dml', {
            sql_text: sqlText,
            params: values,
          });
          if (error) throw error;
          return [] as T[];
        }
      } catch (err) {
        lastErr = err;
        // Solo reintenta errores de red transitorios; los de SQL fallan de una.
        if (!this.isTransientNetworkError(err) || attempt === maxAttempts) {
          throw err;
        }
        const backoffMs = 300 * 2 ** (attempt - 1); // 300ms, 600ms
        console.warn(
          `[DB] Fallo de red (intento ${attempt}/${maxAttempts}), reintentando en ${backoffMs}ms`,
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
    throw lastErr;
  }

  private isTransientNetworkError(err: unknown): boolean {
    const msg = JSON.stringify(
      err instanceof Error ? { m: err.message, c: (err as any).cause } : err,
    ).toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('connecttimeout') ||
      msg.includes('und_err') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound') ||
      msg.includes('socket hang up')
    );
  }
}
