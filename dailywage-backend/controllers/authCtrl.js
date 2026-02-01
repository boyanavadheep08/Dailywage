const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ message: "All fields required" });
    }

    const [exist] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
    if (exist.length > 0) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)",
      [name, phone, hashed, role]
    );

    const user = { id: result.insertId, name, phone, role };

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ message: "Registered successfully", user, token });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone & Password required" });
    }

    const [users] = await db.query("SELECT * FROM users WHERE phone = ?", [phone]);
    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const userData = users[0];

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = { id: userData.id, name: userData.name, phone: userData.phone, role: userData.role };

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ message: "Login success", user, token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
