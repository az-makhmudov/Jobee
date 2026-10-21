import { Client } from 'pg';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { getConfig } from '@job-agent/config';
import { assertSafeTestDatabase } from '@job-agent/database';
import { TokenCryptoService } from '../apps/api/src/services/email/token-crypto-service.js';
/** Local-only rehearsal: copies schema, then backs up only a fresh database containing synthetic rows. */
async function main() {
  const config = getConfig();
  const url = new URL(config.DATABASE_URL!);
  assertSafeTestDatabase(url.href);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_isolated'))
    throw Error('Explicit isolated localhost source required');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jobee-recovery-'));
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const source = `jobee_recovery_source_${nonce}_test_isolated`,
    target = `jobee_recovery_restore_${nonce}_test_isolated`;
  const admin = new Client({ connectionString: url.href });
  await admin.connect();
  const created: string[] = [];
  const pgEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: 'disable',
  };
  const run = (command: string, args: string[], database: string) => {
    const result = spawnSync(command, args, {
      env: { ...pgEnv, PGDATABASE: database },
      stdio: 'pipe',
    });
    if (result.status !== 0)
      throw Error(`${command} failed: ${result.stderr?.toString().slice(0, 800)}`);
  };
  const checkedName = (name: string) => {
    if (!/^jobee_recovery_(source|restore)_[a-f0-9]{12}_test_isolated$/.test(name))
      throw Error('Unsafe recovery database name');
    return '"' + name + '"';
  };
  let origin: Client | undefined, restored: Client | undefined;
  try {
    const identity = (await admin.query('select current_database() as database')).rows[0].database;
    if (identity !== url.pathname.slice(1)) throw Error('Source identity mismatch');
    for (const name of [source, target]) {
      await admin.query(`CREATE DATABASE ${checkedName(name)}`);
      created.push(name);
    }
    const schema = path.join(root, 'schema.sql');
    run(
      'pg_dump',
      [
        '--schema-only',
        '--schema=public',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '--file',
        schema,
      ],
      identity,
    );
    run('psql', ['--set', 'ON_ERROR_STOP=1', '--file', schema], source);
    const sourceUrl = new URL(url);
    sourceUrl.pathname = '/' + source;
    origin = new Client({ connectionString: sourceUrl.href });
    await origin.connect();
    const user = crypto.randomUUID(),
      job = crypto.randomUUID(),
      application = crypto.randomUUID(),
      document = crypto.randomUUID();
    const bytes = Buffer.from('Synthetic recovery document. No candidate information.');
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    const filename = 'recovery-fixture.txt';
    const sourceObject = path.join(root, 'source-' + filename);
    const backupObject = path.join(root, 'backup-' + filename);
    const restoredObject = path.join(root, 'restored-' + filename);
    await fs.writeFile(sourceObject, bytes);
    await fs.copyFile(sourceObject, backupObject);
    await fs.unlink(sourceObject);
    await fs.copyFile(backupObject, restoredObject);
    const envelope = new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY).encrypt({
      accessToken: 'synthetic-recovery-token',
    });
    await origin.query('insert into users(id,name,email) values($1,$2,$3)', [
      user,
      'Recovery fixture',
      `recovery-${nonce}@example.test`,
    ]);
    await origin.query(
      'insert into jobs(id,user_id,title,company,description,content_hash) values($1,$2,$3,$4,$5,$6)',
      [job, user, 'Synthetic role', 'Fixture', 'Synthetic recovery vacancy', checksum],
    );
    await origin.query('insert into applications(id,user_id,job_id,status) values($1,$2,$3,$4)', [
      application,
      user,
      job,
      'READY_TO_APPLY',
    ]);
    await origin.query(
      'insert into candidate_documents(id,user_id,document_type,display_name,original_filename,mime_type,size_bytes,storage_key,sha256_checksum) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        document,
        user,
        'MASTER_CV',
        'Synthetic recovery document',
        filename,
        'text/plain',
        bytes.length,
        filename,
        checksum,
      ],
    );
    await origin.query(
      'insert into email_accounts(user_id,provider,email_address,encrypted_tokens) values($1,$2,$3,$4)',
      [user, 'FIXTURE', `mail-${nonce}@example.test`, envelope],
    );
    const backup = path.join(root, 'fixture.dump');
    run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', backup], source);
    run(
      'pg_restore',
      ['--dbname', target, '--exit-on-error', '--no-owner', '--no-acl', backup],
      target,
    );
    const targetUrl = new URL(url);
    targetUrl.pathname = '/' + target;
    restored = new Client({ connectionString: targetUrl.href });
    await restored.connect();
    if ((await restored.query('select current_database() as database')).rows[0].database !== target)
      throw Error('Restore identity mismatch');
    const result = (
      await restored.query(
        'select a.id,d.sha256_checksum,e.encrypted_tokens from applications a join candidate_documents d on d.user_id=a.user_id join email_accounts e on e.user_id=a.user_id where a.user_id=$1',
        [user],
      )
    ).rows;
    if (
      result.length !== 1 ||
      result[0].id !== application ||
      result[0].sha256_checksum !== checksum ||
      result[0].encrypted_tokens !== envelope
    )
      throw Error('Restored identifiers, checksums or token envelope differ');
    if (
      new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY).decrypt<{ accessToken: string }>(
        result[0].encrypted_tokens,
      ).accessToken !== 'synthetic-recovery-token'
    )
      throw Error('Restored token envelope cannot be decrypted');
    if (
      crypto
        .createHash('sha256')
        .update(await fs.readFile(restoredObject))
        .digest('hex') !== checksum
    )
      throw Error('Storage checksum mismatch');
    console.log(
      'PASS: isolated PostgreSQL backup/restore preserves schema, owned IDs, document checksum and encrypted token bytes. Synthetic data only.',
    );
  } finally {
    await origin?.end();
    await restored?.end();
    for (const name of created.reverse()) await admin.query(`DROP DATABASE ${checkedName(name)}`);
    await admin.end();
    await fs.rm(root, { recursive: true, force: true });
  }
  console.log('PASS: both disposable recovery databases and temporary archives removed.');
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown local rehearsal failure');
  console.error(
    'Isolated recovery rehearsal failed. Inspect the local tool/database setup; no production target was used.',
  );
  process.exitCode = 1;
});
