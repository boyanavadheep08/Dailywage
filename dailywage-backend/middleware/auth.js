const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Get token from Authorization header
    // Format: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = decoded;

    // Continue to next middleware/route
    next();

  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;