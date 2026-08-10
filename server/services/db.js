const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT,
      name        TEXT,
      picture     TEXT,
      zip         TEXT,
      radius      INTEGER DEFAULT 10,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      last_seen   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function upsertUser({ id, email, name, picture }) {
  const res = await pool.query(
    `INSERT INTO users (id, email, name, picture, last_seen)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           name  = EXCLUDED.name,
           picture = EXCLUDED.picture,
           last_seen = NOW()
     RETURNING *`,
    [id, email, name, picture]
  );
  return res.rows[0];
}

async function updatePrefs(id, { zip, radius }) {
  const res = await pool.query(
    `UPDATE users SET zip = $2, radius = $3 WHERE id = $1 RETURNING *`,
    [id, zip, radius]
  );
  return res.rows[0];
}

async function getUser(id) {
  const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

module.exports = { init, upsertUser, updatePrefs, getUser };
