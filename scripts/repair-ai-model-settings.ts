import { config } from 'dotenv';
config();
import { getConfig } from '../packages/config/src/index.js';
import { getDbPool } from '../packages/database/src/client.js';

async function main() {
  const appConfig = getConfig();
  const connectionString = appConfig.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = getDbPool(connectionString);
  console.log('Connecting to database...');

  const selectRes = await pool.query(`
    SELECT user_id, active_ai_provider, active_ai_model
    FROM application_policy
  `);
  console.log('Current application_policy rows:', selectRes.rows);

  const updateRes = await pool.query(`
    UPDATE application_policy
    SET active_ai_model = 'gemini-3.8-flash', updated_at = NOW()
    WHERE active_ai_model = 'gemini-2.5-flash'
       OR active_ai_model = 'gemini-2.5-pro'
       OR active_ai_model LIKE 'gemini-1.5%'
       OR active_ai_model LIKE 'gemini-2.0%'
    RETURNING user_id, active_ai_provider, active_ai_model;
  `);

  console.log(`Updated ${updateRes.rowCount} rows to gemini-3.8-flash:`, updateRes.rows);

  await pool.end();
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
