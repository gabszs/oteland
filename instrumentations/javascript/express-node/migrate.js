const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ /* sua config */ });

async function migrate() {
  // Tabela de controle das migrations já aplicadas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM migrations WHERE filename = $1', [file]
    );
    if (rowCount > 0) continue; // já aplicada

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
    console.log(`✅ Migration aplicada: ${file}`);
  }
}

module.exports = migrate;
