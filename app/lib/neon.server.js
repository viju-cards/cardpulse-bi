// neon.server.js – direkte Verbindung zur Neon-Postgres-DB (Cardmarket-Daten).
// Läuft NUR serverseitig (.server.js). Sessions bleiben separat bei Prisma.
import pg from "pg";

// Eine einzige Pool-Instanz für die ganze App. Im Dev-Modus lädt der Server
// bei jeder Änderung neu – damit dabei nicht ständig neue Pools entstehen,
// merken wir uns den Pool an einer globalen Stelle und nutzen ihn wieder.
let pool = global._cardpulsePool;

if (!pool) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL_NEON,
    ssl: { rejectUnauthorized: false },
  });
  global._cardpulsePool = pool;
}

export { pool };