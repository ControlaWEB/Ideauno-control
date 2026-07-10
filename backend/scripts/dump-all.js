/* Dump completo de la BD a JSON via supabase-js (service key). No modifica nada. */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const TABLES = [
  'usuarios','advisors','teams','properties','copropietarios',
  'bridge_propiedad_propietarios','fact_captaciones','clients','dim_clientes',
  'operations','bridge_operacion_asesores','commissions','fact_ama_asesor',
  'config_parametros_comision','fact_pagos','fact_solicitudes_contrato',
  'dim_plantillas','compliance_cases','dim_documentos','notifications','audit_logs',
];

(async () => {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('uso: node dump-all.js <outDir>');
  fs.mkdirSync(outDir, { recursive: true });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const summary = {};
  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select('*');
    if (error) throw new Error(`${t}: ${error.message}`);
    fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(data, null, 2), 'utf8');
    summary[t] = data.length;
    console.log(`${t}: ${data.length}`);
  }
  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify({ fecha: new Date().toISOString(), tablas: summary }, null, 2),
    'utf8',
  );
  console.log('\nBACKUP OK ->', outDir);
})().catch((e) => {
  console.error('BACKUP FAIL:', e.message);
  process.exit(1);
});
