/* Borra de Storage los archivos de los documentos eliminados, leyendo storage_path del respaldo. */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const backupFile = process.argv[2];
  if (!backupFile) throw new Error('uso: node clean-storage.js <dim_documentos.json>');

  const docs = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const bucket = process.env.STORAGE_BUCKET || 'documentos';
  const paths = [...new Set(docs.map((d) => d.storage_path).filter(Boolean))];
  console.log(`bucket=${bucket} · rutas a borrar: ${paths.length}`);
  if (!paths.length) return console.log('nada que borrar');

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
  console.log(`borrados: ${data ? data.length : 0}`);
})().catch((e) => {
  console.error('CLEAN FAIL:', e.message);
  process.exit(1);
});
