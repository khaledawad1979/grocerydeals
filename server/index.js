require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const storesRouter = require('./routes/stores');
const dealsRouter  = require('./routes/deals');

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// In production the React build is served from the same origin — no CORS needed.
// In development allow the React dev server on localhost:3000.
if (!isProd) {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000' }));
}

app.use(express.json());

// Rate limit: 30 requests/minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please wait a moment and try again.' },
});
app.use('/api', limiter);

app.use('/api/stores', storesRouter);
app.use('/api/deals',  dealsRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve React build in production
if (isProd) {
  const buildPath = path.join(__dirname, '../client/build');
  app.use(express.static(buildPath));
  // All non-API routes return the React app
  app.get('*', (_req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`GroceryDeals server running on port ${PORT} [${isProd ? 'production' : 'development'}]`);
});
