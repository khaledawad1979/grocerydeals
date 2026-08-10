const express = require('express');
const router  = express.Router();
const db      = require('../services/db');

// POST /api/user/sync — called after login to upsert profile
router.post('/sync', async (req, res) => {
  const { sub, email, name, picture } = req.body;
  if (!sub) return res.status(400).json({ error: 'Missing user id' });
  try {
    const user = await db.upsertUser({ id: sub, email, name, picture });
    res.json(user);
  } catch (err) {
    console.error('[User] sync failed:', err.message);
    res.status(500).json({ error: 'Could not save profile' });
  }
});

// PATCH /api/user/prefs — save ZIP + radius preference
router.patch('/prefs', async (req, res) => {
  const { sub, zip, radius } = req.body;
  if (!sub) return res.status(400).json({ error: 'Missing user id' });
  try {
    const user = await db.updatePrefs(sub, { zip, radius });
    res.json(user);
  } catch (err) {
    console.error('[User] prefs failed:', err.message);
    res.status(500).json({ error: 'Could not update preferences' });
  }
});

// GET /api/user/:id — load profile
router.get('/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Could not load profile' });
  }
});

module.exports = router;
