import express from 'express';
import { auth } from './auth.js';
import { tasks } from './tasks.js';
import { pets } from './pets.js';

export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }); next(); });
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', auth);
app.use('/api/pets/:petId/tasks', tasks);
app.use('/api/pets', pets);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'API_NOT_FOUND' } }));
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND' } }));

app.use((error, _req, res, _next) => {
  if (res.headersSent) return _next(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { code: 'PHOTO_TOO_LARGE', fields: { photo: 'PHOTO_TOO_LARGE' } } });
  if (error.name === 'MulterError') return res.status(400).json({ error: { code: 'INVALID_PHOTO', fields: { photo: 'INVALID_PHOTO' } } });
  if (error.status && error.code) return res.status(error.status).json({ error: { code: error.code, fields: error.fields } });
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'BODY_TOO_LARGE' } });
  }
  const unavailable = ['P1000', 'P1001', 'P1002', 'P2021', 'P2022', 'ECONNREFUSED', '28P01', '42P01', '3D000'].includes(error.code);
  console.error('API failure:', /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'INTERNAL_ERROR');
  res.status(unavailable ? 503 : 500).json({ error: { code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR' } });
});
