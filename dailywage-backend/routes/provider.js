const express = require('express');
const router = express.Router();
const providerCtrl = require('../controllers/providerCtrl');
const authMiddleware = require('../middleware/auth');

// POST /api/provider/profile - Save or update provider profile (job posting)
router.post('/profile', authMiddleware, providerCtrl.saveProfile);

// GET /api/provider/profile - Get provider profile
router.get('/profile', authMiddleware, providerCtrl.getProfile);

// GET /api/provider/seekers - Browse available workers
router.get('/seekers', authMiddleware, providerCtrl.getSeekers);

// GET /api/provider/jobs - Get all available jobs (for seekers to browse)
router.get('/jobs', authMiddleware, providerCtrl.getJobs);

module.exports = router;