/* Crea las cuentas admin iniciales. Escribe las credenciales a un archivo, nunca a stdout. */
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const ADMINS = [
  { name: 'Angel Ramos',        email: 'angelraamos1@gmail.com',   role: 'Admin' },
  { name: 'Miguel Borbón',      email: 'mborbon@controlaweb.mx',   role: 'Super Admin' },
  { name: 'Juan Carlos Barraza', email: 'juan.barraza@ideauno.mx', role: 'Admin' },
];

const tempPassword = () =>
  'Idea-' + crypto.randomBytes(4).toString('hex') + '!';

(async () => {
  const outFile = process.argv[2];
  if (!outFile) throw new Error('uso: node seed-admins.js <archivoCredenciales>');

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const creds = [];
  for (const a of ADMINS) {
    const pass = tempPassword();
    const hash = await bcrypt.hash(pass, 10);
    const row = {
      id: crypto.randomUUID(),
      name: a.name,
      email: a.email,
      role: a.role,
      status: 'Active',
      password_hash: hash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('usuarios').insert(row);
    if (error) throw new Error(`${a.email}: ${error.message}`);
    creds.push({ nombre: a.name, correo: a.email, rol: a.role, password_temporal: pass });
    console.log(`creado: ${a.email} (${a.role})`);
  }

  const body =
    'CREDENCIALES INICIALES — Idea Uno Control\n' +
    'Generadas: ' + new Date().toISOString() + '\n' +
    'Cambiar la contraseña en el primer login. Borrar este archivo después de repartirlas.\n\n' +
    creds
      .map((c) => `${c.rol.padEnd(12)} | ${c.correo.padEnd(28)} | ${c.password_temporal}  (${c.nombre})`)
      .join('\n') + '\n';
  fs.writeFileSync(outFile, body, 'utf8');
  console.log('\nCredenciales escritas en:', outFile);
})().catch((e) => {
  console.error('SEED FAIL:', e.message);
  process.exit(1);
});
