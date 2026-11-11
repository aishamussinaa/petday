import { Router } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { database } from './db.js';
import { ApiError, credentials } from './validation.js';

const production = process.env.NODE_ENV === 'production';
const cookieName = production ? '__Host-petday_session' : 'petday_session';
const lifetime = 7 * 86400000;
const options = { httpOnly: true, sameSite: 'lax', secure: production, path: '/' };
const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const origins = (process.env.APP_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(value => value.trim());
if (production && origins.some(origin => !origin.startsWith('https://'))) throw new Error('Production APP_ORIGIN requires HTTPS');

export async function session(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const token = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const db = database();
  req.session = token && /^[\w-]{43}$/.test(token) ? await db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { select: { id: true, email: true } } } }) : null;
  if (req.session && req.session.expiresAt <= new Date()) { await db.session.deleteMany({ where: { tokenHash: req.session.tokenHash } }); req.session = null; res.clearCookie(cookieName, options); }
  next();
}
export function requireUser(req, _res, next) {
  if (!req.session?.user) throw new ApiError(401, 'AUTH_REQUIRED');
  next();
}
export function csrf(req, _res, next) {
  if (!origins.includes(req.get('Origin')) || !safeEqual(req.get('X-CSRF-Token'), req.session?.csrfToken)) throw new ApiError(403, 'CSRF_INVALID');
  next();
}
async function newSession(req, res, userId = null) {
  const token = secret();
  const created = await database().$transaction(async tx => {
    if (req.session) await tx.session.deleteMany({ where: { tokenHash: req.session.tokenHash } });
    return tx.session.create({ data: { tokenHash: digest(token), csrfToken: secret(), userId, expiresAt: new Date(Date.now() + lifetime) }, include: { user: { select: { id: true, email: true } } } });
  });
  res.cookie(cookieName, token, { ...options, maxAge: lifetime });
  return created;
}
async function rate(key, maximum) {
  const hashed = digest(key);
  const until = new Date(Date.now() + 15 * 60000);
  const [entry] = await database().$queryRaw`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${hashed}, 1, ${until})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN ${until} ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  if (entry.count > maximum) throw new ApiError(429, 'TOO_MANY_ATTEMPTS');
}
const hashOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
let dummyHash;
export const auth = Router();
auth.use(session);
auth.get('/session', async (req, res) => {
  if (!req.session) { await rate(`session:${req.ip}`, 150); req.session = await newSession(req, res); }
  res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
});
auth.post(['/register', '/login'], csrf, async (req, res) => {
  await rate(`auth-ip:${req.ip}`, 40);
  const { email, password } = credentials(req.body);
  await rate(`auth-email:${email}`, 8);
  let user;
  if (req.path === '/register') {
    try { user = await database().user.create({ data: { email, passwordHash: await argon2.hash(password, hashOptions) } }); }
    catch (error) { if (error.code === 'P2002') throw new ApiError(409, 'EMAIL_EXISTS', { email: 'EMAIL_EXISTS' }); throw error; }
  } else {
    user = await database().user.findUnique({ where: { email } });
    dummyHash ??= argon2.hash(secret(), hashOptions);
    const matches = await argon2.verify(user?.passwordHash || await dummyHash, password);
    if (!user || !matches) throw new ApiError(401, 'INVALID_CREDENTIALS');
  }
  const created = await newSession(req, res, user.id);
  res.status(req.path === '/register' ? 201 : 200).json({ user: created.user, csrfToken: created.csrfToken });
});
auth.post('/logout', csrf, async (req, res) => {
  await database().session.deleteMany({ where: { tokenHash: req.session.tokenHash } });
  res.clearCookie(cookieName, options);
  res.status(204).end();
});
