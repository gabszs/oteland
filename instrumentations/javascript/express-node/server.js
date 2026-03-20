const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());

// ── Swagger Configuration ─────────────────────────────────────────────────────

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OTel Demo Node.js API',
      version: '1.0.0',
      description: 'Demo Node.js app com Redis + PostgreSQL para testar OTel auto-instrumentation via K8s CRD',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Parsers de connection string ───────────────────────────────────────────────

/**
 * Parseia o formato StackExchange/Redis usado no .NET:
 *   "192.168.1.3:6379,defaultDatabase=0,abortConnect=false"
 * e converte para as opções que o ioredis entende.
 */
function parseRedisUrl(url) {
  const parts = url.split(',');
  const [host, port] = parts[0].split(':');

  const opts = { host, port: parseInt(port || '6379'), lazyConnect: true };

  for (const part of parts.slice(1)) {
    const [key, value] = part.split('=');
    if (key === 'defaultDatabase') opts.db = parseInt(value);
    if (key === 'password')        opts.password = value;
    if (key === 'ssl' && value === 'true') opts.tls = {};
  }

  return opts;
}

// ── Conexões ──────────────────────────────────────────────────────────────────

// Postgres: string padrão  postgresql://user:pass@host:port/db
const POSTGRES_URL = process.env.POSTGRES_URL
  || 'postgresql://app_user:app_password@192.168.1.3:5455/loglog';

const pool = new Pool({ connectionString: POSTGRES_URL });

// Redis: formato StackExchange  host:port,defaultDatabase=N,...
const REDIS_URL = process.env.REDIS_URL
  || '192.168.1.3:6379,defaultDatabase=0,abortConnect=false';

const redis = new Redis(parseRedisUrl(REDIS_URL));

// ── Migrations ────────────────────────────────────────────────────────────────

const MIGRATIONS = [
  {
    name: '001_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: '002_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL,
        email      TEXT        NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
];

async function runMigrations() {
  console.log('🔄 Verificando migrations...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of MIGRATIONS) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM migrations WHERE name = $1',
      [migration.name]
    );

    if (rowCount > 0) {
      console.log(`  ✔ ${migration.name} (já aplicada)`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      await client.query('COMMIT');
      console.log(`  ✅ ${migration.name} aplicada`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration "${migration.name}" falhou: ${err.message}`);
    } finally {
      client.release();
    }
  }
  console.log('✅ Migrations concluídas');
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /health:
 *   get:
 *     description: Retorna o status da aplicação
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * @openapi
 * /users:
 *   post:
 *     description: Cria um novo usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 */
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name e email são obrigatórios' });
  }

  const { rows } = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [name, email]
  );
  const user = rows[0];

  await redis.setex(`user:${user.id}`, 300, JSON.stringify(user));

  res.status(201).json(user);
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     description: Busca um usuário pelo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *       404:
 *         description: Usuário não encontrado
 */
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `user:${id}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({ ...JSON.parse(cached), source: 'cache' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows.length) {
    return res.status(404).json({ error: 'usuário não encontrado' });
  }

  const user = rows[0];
  await redis.setex(cacheKey, 300, JSON.stringify(user));
  res.json({ ...user, source: 'db' });
});

/**
 * @openapi
 * /users:
 *   get:
 *     description: Lista todos os usuários
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
app.get('/users', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  res.json(rows);
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     description: Remove um usuário pelo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Usuário removido
 */
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  await redis.del(`user:${id}`);
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.status(204).end();
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

async function start() {
  await redis.connect();
  console.log('✅ Redis conectado');

  await runMigrations();

  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📖 Documentação Swagger disponível em http://localhost:${PORT}/api-docs`);
  });
}

start().catch(err => {
  console.error('❌ Erro ao iniciar:', err.message);
  process.exit(1);
});
