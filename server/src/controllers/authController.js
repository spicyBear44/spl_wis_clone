const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/token");

async function register(req, res) {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ message: "Name, username, and password are required." });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return res.status(409).json({ message: "Username is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username: normalizedUsername,
      passwordHash
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username is already taken." });
    }
    return res.status(500).json({ message: "Registration failed.", error: error.message });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username: (username || "").trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isValid = await bcrypt.compare(password || "", user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed.", error: error.message });
  }
}

module.exports = { register, login };
