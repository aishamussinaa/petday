import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let client;
export function database() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('DATABASE_UNAVAILABLE'), { status: 503, code: 'DATABASE_UNAVAILABLE' });
  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, max: 5 }) });
  return client;
}
export async function disconnect() { if (client) await client.$disconnect(); }
