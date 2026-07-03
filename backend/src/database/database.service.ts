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
      if (isSelect) {
        const { data, error } = await this.supabase.rpc('exec_sql_select', {
          sql_text: processedText,
          params: values,
        });
        if (error) throw error;
        return (Array.isArray(data) ? data : []) as T[];
      } else {
        const { error } = await this.supabase.rpc('exec_sql_dml', {
          sql_text: processedText,
          params: values,
        });
        if (error) throw error;
        return [] as T[];
      }
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
}
