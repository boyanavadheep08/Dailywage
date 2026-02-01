const db = require('../config/db');

// ── SAVE OR UPDATE SEEKER PROFILE ──
exports.saveProfile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const {
      workTypes,
      expectedWage,
      hoursAvailability,
      customHours,
      availableDays,
      location,
      experience
    } = req.body;

    // Validate required fields
    if (!workTypes || !Array.isArray(workTypes) || workTypes.length === 0) {
      return res.status(400).json({ message: 'Select at least one work type' });
    }
    if (!expectedWage) {
      return res.status(400).json({ message: 'Expected wage is required' });
    }
    if (!hoursAvailability) {
      return res.status(400).json({ message: 'Hours availability is required' });
    }
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    await connection.beginTransaction();

    // Check if seeker profile already exists
    const [existing] = await connection.query(
      'SELECT id FROM seekers WHERE user_id = ?',
      [req.user.id]
    );

    let seekerId;

    if (existing.length > 0) {
      // Update existing profile
      seekerId = existing[0].id;
      
      await connection.query(
        `UPDATE seekers 
         SET expected_wage = ?, 
             hours_availability = ?, 
             custom_hours = ?, 
             location = ?, 
             experience = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          expectedWage,
          hoursAvailability,
          hoursAvailability === 'Custom' ? customHours : null,
          location,
          experience || null,
          seekerId
        ]
      );

      // Delete old work types and available days
      await connection.query('DELETE FROM seeker_work_types WHERE seeker_id = ?', [seekerId]);
      await connection.query('DELETE FROM seeker_available_days WHERE seeker_id = ?', [seekerId]);
      
    } else {
      // Insert new profile
      const [result] = await connection.query(
        `INSERT INTO seekers (user_id, expected_wage, hours_availability, custom_hours, location, experience)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          expectedWage,
          hoursAvailability,
          hoursAvailability === 'Custom' ? customHours : null,
          location,
          experience || null
        ]
      );
      seekerId = result.insertId;
    }

    // Insert work types
    if (workTypes && workTypes.length > 0) {
      const workTypeValues = workTypes.map(type => [seekerId, type]);
      await connection.query(
        'INSERT INTO seeker_work_types (seeker_id, work_type) VALUES ?',
        [workTypeValues]
      );
    }

    // Insert available days
    if (availableDays && availableDays.length > 0) {
      const dayValues = availableDays.map(day => [seekerId, day]);
      await connection.query(
        'INSERT INTO seeker_available_days (seeker_id, day) VALUES ?',
        [dayValues]
      );
    }

    await connection.commit();

    // Fetch the complete profile to return
    const profile = await getSeekerProfile(seekerId);

    res.json({ message: 'Profile saved successfully', profile });

  } catch (err) {
    await connection.rollback();
    console.error('Save seeker profile error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    connection.release();
  }
};

// ── GET SEEKER PROFILE ──
exports.getProfile = async (req, res) => {
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
    res.json(profile);

  } catch (err) {
    console.error('Get seeker profile error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Helper function to get complete seeker profile
async function getSeekerProfile(seekerId) {
  // Get main profile with user details
  const [profiles] = await db.query(
    `SELECT 
      s.*,
      u.name,
      u.phone
     FROM seekers s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [seekerId]
  );

  if (profiles.length === 0) {
    return null;
  }

  const profile = profiles[0];

  // Get work types
  const [workTypes] = await db.query(
    'SELECT work_type FROM seeker_work_types WHERE seeker_id = ?',
    [seekerId]
  );

  // Get available days
  const [availableDays] = await db.query(
    'SELECT day FROM seeker_available_days WHERE seeker_id = ?',
    [seekerId]
  );

  return {
    id: profile.id,
    userId: {
      id: profile.user_id,
      name: profile.name,
      phone: profile.phone
    },
    workTypes: workTypes.map(wt => wt.work_type),
    expectedWage: parseFloat(profile.expected_wage),
    hoursAvailability: profile.hours_availability,
    customHours: profile.custom_hours,
    availableDays: availableDays.map(ad => ad.day),
    location: profile.location,
    experience: profile.experience,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

module.exports.getSeekerProfile = getSeekerProfile;
