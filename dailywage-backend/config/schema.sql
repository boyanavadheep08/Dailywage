-- Create database
CREATE DATABASE IF NOT EXISTS dailywage;
USE dailywage;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('seeker', 'provider') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seekers table
CREATE TABLE IF NOT EXISTS seekers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  expected_wage DECIMAL(10, 2) NOT NULL,
  hours_availability ENUM('Full day', 'Half day', 'Custom') NOT NULL,
  custom_hours INT DEFAULT NULL,
  location VARCHAR(255) NOT NULL,
  experience ENUM('Less than 1 year', '1-3 years', '3+ years') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seeker work types (many-to-many relationship)
CREATE TABLE IF NOT EXISTS seeker_work_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seeker_id INT NOT NULL,
  work_type ENUM(
    'Agriculture Labour',
    'Construction',
    'Plumbing',
    'Electrical',
    'Painting',
    'Housekeeping',
    'Others'
  ) NOT NULL,
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE
);

-- Seeker available days (many-to-many relationship)
CREATE TABLE IF NOT EXISTS seeker_available_days (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seeker_id INT NOT NULL,
  day ENUM('Today', 'Tomorrow', 'Weekdays', 'Weekends') NOT NULL,
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE
);

-- Providers table
CREATE TABLE IF NOT EXISTS providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  work_type ENUM(
    'Agriculture Labour',
    'Construction',
    'Plumbing',
    'Electrical',
    'Painting',
    'Housekeeping',
    'Others'
  ) NOT NULL,
  budget_per_day DECIMAL(10, 2) NOT NULL,
  workers_needed INT NOT NULL CHECK (workers_needed >= 1),
  working_hours ENUM('Half day', 'Full day', 'Custom') NOT NULL,
  custom_hours INT DEFAULT NULL,
  location VARCHAR(255) NOT NULL,
  work_start_time TIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_seeker_user_id ON seekers(user_id);
CREATE INDEX idx_provider_user_id ON providers(user_id);
CREATE INDEX idx_seeker_work_types_seeker_id ON seeker_work_types(seeker_id);
CREATE INDEX idx_seeker_available_days_seeker_id ON seeker_available_days(seeker_id);
CREATE INDEX idx_seekers_location ON seekers(location);
CREATE INDEX idx_providers_location ON providers(location);
// ── GET SEEKER PROFILE WITH STATS ──
exports.getSeekerProfileWithStats = async (req, res) => {
  try {
    // Get seeker id from user_id
    const [seekers] = await db.query(
      'SELECT id FROM seekers WHERE user_id = ?',
      [req.user.id]
    );

    if (seekers.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profile = await getSeekerProfile(seekers[0].id);

    // Get work stats
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN jr.status = 'accepted' THEN 1 ELSE 0 END) as accepted_jobs,
        AVG(jr.provider_rating) as average_rating
       FROM job_requests jr
       WHERE jr.seeker_id = ?`,
      [req.user.id]
    );

    // Get completed work history
    const [workHistory] = await db.query(
      `SELECT 
        jr.*,
        u.name as provider_name,
        p.work_type,
        p.budget_per_day,
        p.location
       FROM job_requests jr
       JOIN users u ON jr.provider_id = u.id
       LEFT JOIN providers p ON p.user_id = jr.provider_id
       WHERE jr.seeker_id = ? AND jr.status = 'accepted'
       ORDER BY jr.created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      profile,
      stats: {
        totalJobs: stats[0].total_jobs || 0,
        acceptedJobs: stats[0].accepted_jobs || 0,
        averageRating: parseFloat(stats[0].average_rating || 0).toFixed(1)
      },
      workHistory
    });

  } catch (err) {
    console.error('Get seeker profile with stats error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── RATE PROVIDER AFTER JOB COMPLETION ──
exports.rateProvider = async (req, res) => {
  try {
    const { requestId, rating, review } = req.body;

    if (!requestId || !rating) {
      return res.status(400).json({ message: 'Request ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Verify the request belongs to this seeker and is accepted
    const [requests] = await db.query(
      'SELECT * FROM job_requests WHERE id = ? AND seeker_id = ? AND status = "accepted"',
      [requestId, req.user.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Job request not found or not completed' });
    }

    // Update provider rating
    await db.query(
      'UPDATE job_requests SET provider_rating = ?, provider_review = ? WHERE id = ?',
      [rating, review || null, requestId]
    );

    res.json({ message: 'Provider rated successfully' });

  } catch (err) {
    console.error('Rate provider error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};