const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveMigrationDatabaseUrl, deriveDirectNeonUrl, formatDatabaseError } = require('../src/db/migrate-runner.cjs');

test('migrations prefer explicit direct URLs without changing the query URL', () => {
  const environment = { DATABASE_URL: 'postgresql://local/app', DATABASE_URL_UNPOOLED: 'postgresql://direct/app', POSTGRES_URL_NON_POOLING: 'postgresql://alternate/app' };
  assert.equal(resolveMigrationDatabaseUrl(environment).source, 'DATABASE_URL_UNPOOLED');
  assert.equal(resolveMigrationDatabaseUrl({ DATABASE_URL: environment.DATABASE_URL, POSTGRES_URL_NON_POOLING: environment.POSTGRES_URL_NON_POOLING }).source, 'POSTGRES_URL_NON_POOLING');
  assert.equal(environment.DATABASE_URL, 'postgresql://local/app');
  assert.throws(() => resolveMigrationDatabaseUrl({}), /DATABASE_URL is required/);
});

test('only Neon pooled hosts are converted to direct hosts', () => {
  assert.equal(new URL(deriveDirectNeonUrl('postgresql://user:pass@ep-test-pooler.us-east-2.aws.neon.tech/app')).hostname, 'ep-test.us-east-2.aws.neon.tech');
  assert.equal(deriveDirectNeonUrl('postgresql://local/app'), undefined);
  assert.equal(deriveDirectNeonUrl('not a URL'), undefined);
});

test('database errors redact credentials in messages, detail and hints', () => {
  const message = formatDatabaseError({ code: 'TEST', message: 'postgresql://user:private@host/app', detail: 'DATABASE_URL=postgresql://user:private@host/app', hint: 'password=private' });
  assert(message.includes('TEST'));
  assert(!message.includes('private'));
});
