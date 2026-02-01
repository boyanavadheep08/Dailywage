const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true
}));

app.use(express.json());

// Test database connection
db.getConnection()
  .then(connection => {
    console.log('✅ MySQL Connected Successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL Connection Failed:', err.message);
    process.exit(1);
  });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/seeker', require('./routes/seeker'));
app.use('/api/provider', require('./routes/provider'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});