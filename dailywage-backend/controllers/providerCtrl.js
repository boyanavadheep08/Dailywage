const db = require('../config/db');

// ── SAVE OR UPDATE PROVIDER PROFILE ──
exports.saveProfile = async (req, res) => {
  try {
    const {
      workType,
      budgetPerDay,
      workersNeeded,
      workingHours,
      customHours,
      location,
      workStartTime
    } = req.body;

    // Validate required fields
    if (!workType) {
      return res.status(400).json({ message: 'Work type is required' });
    }
    if (!budgetPerDay) {
      return res.status(400).json({ message: 'Budget per day is required' });
    }
    if (!workersNeeded || workersNeeded < 1) {
      return res.status(400).json({ message: 'Workers needed must be at least 1' });
    }
    if (!workingHours) {
      return res.status(400).json({ message: 'Working hours is required' });
    }
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    // Check if provider profile already exists
    const [existing] = await db.query(
      'SELECT id FROM providers WHERE user_id = ?',
      [req.user.id]
    );

    let providerId;

    if (existing.length > 0) {
      // Update existing profile
      providerId = existing[0].id;
      
      await db.query(
        `UPDATE providers 
         SET work_type = ?,
             budget_per_day = ?,
             workers_needed = ?,
             working_hours = ?,
             custom_hours = ?,
             location = ?,
             work_start_time = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          workType,
          budgetPerDay,
          workersNeeded,
          workingHours,
          workingHours === 'Custom' ? customHours : null,
          location,
          workStartTime || null,
          providerId
        ]
      );
    } else {
      // Insert new profile
      const [result] = await db.query(
        `INSERT INTO providers (user_id, work_type, budget_per_day, workers_needed, working_hours, custom_hours, location, work_start_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          workType,
          budgetPerDay,
          workersNeeded,
          workingHours,
          workingHours === 'Custom' ? customHours : null,
          location,
          workStartTime || null
        ]
      );
      providerId = result.insertId;
    }

    // Fetch the complete profile to return
    const profile = await getProviderProfile(providerId);

    res.json({ message: 'Profile saved successfully', profile });
  } catch (err) {
    console.error('Save provider profile error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET PROVIDER PROFILE ──
exports.getProfile = async (req, res) => {
  try {
    // Get provider id from user_id
    const [providers] = await db.query(
      'SELECT id FROM providers WHERE user_id = ?',
      [req.user.id]
    );

    if (providers.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profile = await getProviderProfile(providers[0].id);
    res.json(profile);
  } catch (err) {
    console.error('Get provider profile error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET AVAILABLE SEEKERS (WORKERS) ──
exports.getSeekers = async (req, res) => {
  try {
    const { workType, maxBudget, location } = req.query;

    // Build dynamic query
    let query = `
      SELECT 
        s.id,
        s.user_id,
        s.expected_wage,
        s.hours_availability,
        s.custom_hours,
        s.location,
        s.experience,
        u.name,
        u.phone
      FROM seekers s
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Add filters if provided
    if (workType) {
      query += ` AND s.id IN (
        SELECT seeker_id FROM seeker_work_types WHERE work_type = ?
      )`;
      params.push(workType);
    }

    if (maxBudget) {
      query += ` AND s.expected_wage <= ?`;
      params.push(parseFloat(maxBudget));
    }

    if (location) {
      query += ` AND s.location LIKE ?`;
      params.push(`%${location}%`);
    }

    query += ` ORDER BY s.created_at DESC LIMIT 50`;

    const [seekers] = await db.query(query, params);

    // Get work types for each seeker
    const seekersWithDetails = await Promise.all(
      seekers.map(async (seeker) => {
        const [workTypes] = await db.query(
          'SELECT work_type FROM seeker_work_types WHERE seeker_id = ?',
          [seeker.id]
        );

        const [availableDays] = await db.query(
          'SELECT day FROM seeker_available_days WHERE seeker_id = ?',
          [seeker.id]
        );

        return {
          id: seeker.id,
          userId: {
            id: seeker.user_id,
            name: seeker.name,
            phone: seeker.phone
          },
          workTypes: workTypes.map(wt => wt.work_type),
          expectedWage: parseFloat(seeker.expected_wage),
          hoursAvailability: seeker.hours_availability,
          customHours: seeker.custom_hours,
          availableDays: availableDays.map(ad => ad.day),
          location: seeker.location,
          experience: seeker.experience
        };
      })
    );

    res.json({ seekers: seekersWithDetails });
  } catch (err) {
    console.error('Get seekers error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET AVAILABLE JOBS (FOR SEEKERS TO BROWSE) ──
exports.getJobs = async (req, res) => {
  try {
    const { workType, minBudget, location } = req.query;

    // Build dynamic query
    let query = `
      SELECT 
        p.id,
        p.user_id,
        p.work_type,
        p.budget_per_day,
        p.workers_needed,
        p.working_hours,
        p.custom_hours,
        p.location,
        p.work_start_time,
        p.created_at,
        u.name,
        u.phone
      FROM providers p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Add filters if provided
    if (workType) {
      query += ` AND p.work_type = ?`;
      params.push(workType);
    }

    if (minBudget) {
      query += ` AND p.budget_per_day >= ?`;
      params.push(parseFloat(minBudget));
    }

    if (location) {
      query += ` AND p.location LIKE ?`;
      params.push(`%${location}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT 50`;

    const [jobs] = await db.query(query, params);

    const formattedJobs = jobs.map(job => ({
      id: job.id,
      employerId: job.user_id,
      workType: job.work_type,
      budgetPerDay: parseFloat(job.budget_per_day),
      workersNeeded: job.workers_needed,
      workingHours: job.working_hours,
      customHours: job.custom_hours,
      location: job.location,
      workStartTime: job.work_start_time,
      createdAt: job.created_at,
      employer: {
        name: job.name,
        phone: job.phone
      }
    }));

    res.json({ jobs: formattedJobs });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Helper function to get complete provider profile
async function getProviderProfile(providerId) {
  // Get main profile with user details
  const [profiles] = await db.query(
    `SELECT 
      p.*,
      u.name,
      u.phone
     FROM providers p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`,
    [providerId]
  );

  if (profiles.length === 0) {
    return null;
  }

  const profile = profiles[0];

  return {
    id: profile.id,
    userId: {
      id: profile.user_id,
      name: profile.name,
      phone: profile.phone
    },
    workType: profile.work_type,
    budgetPerDay: parseFloat(profile.budget_per_day),
    workersNeeded: profile.workers_needed,
    workingHours: profile.working_hours,
    customHours: profile.custom_hours,
    location: profile.location,
    workStartTime: profile.work_start_time,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}
