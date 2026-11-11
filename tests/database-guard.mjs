// No reset/truncate/drop. Even test cleanup can only operate on an explicitly named test DB.
export function testDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) return null;
  const test = new URL(value);
  const name = decodeURIComponent(test.pathname.slice(1));
  if (!name.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a database ending with _test');
  if (process.env.DATABASE_URL) {
    const real = new URL(process.env.DATABASE_URL);
    if (test.host === real.host && test.pathname === real.pathname) throw new Error('Test and personal database must be different');
  }
  return value;
}
