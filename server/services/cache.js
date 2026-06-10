/**
 * Simple in-memory cache with TTL.
 * Stores deal results keyed by "zip:radius" so repeat searches are instant.
 */
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const store = new Map(); // key → { data, expiresAt }
const jobs  = new Map(); // key → 'running' | 'done' | 'error'

function key(zip, radius) {
  return `${zip}:${radius}`;
}

function get(zip, radius) {
  const entry = store.get(key(zip, radius));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key(zip, radius)); return null; }
  return entry.data;
}

function set(zip, radius, data) {
  store.set(key(zip, radius), { data, expiresAt: Date.now() + TTL_MS });
  jobs.set(key(zip, radius), 'done');
}

function jobStatus(zip, radius) {
  return jobs.get(key(zip, radius)) || 'idle';
}

function setJobStatus(zip, radius, status) {
  jobs.set(key(zip, radius), status);
}

function clearExpired() {
  const now = Date.now();
  for (const [k, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(k);
  }
}

// Sweep every 30 minutes
setInterval(clearExpired, 30 * 60 * 1000);

module.exports = { get, set, jobStatus, setJobStatus };
