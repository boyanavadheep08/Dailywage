const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { saveProfile, getProfile } = require('../controllers/seekerCtrl');

// POST /api/seeker/profile - save or update profile
router.post('/profile', authMiddleware, saveProfile);

// GET /api/seeker/profile - get current user's profile
router.get('/profile', authMiddleware, getProfile);

module.exports = router;