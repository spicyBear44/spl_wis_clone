const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/token");
const { sendPasswordResetEmail } = require("../utils/mailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RESET_SUCCESS_MESSAGE = "If an account with that email exists, a reset link has been sent.";
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

function serializeUser(user) {
  const profilePhoto = user.profilePhoto || "";

  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    profilePhoto,
    profilePicture: profilePhoto
  };
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function register(req, res) {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "Name, username, email, and password are required." });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });
    if (existingUser?.username === normalizedUsername) {
      return res.status(409).json({ message: "Username is already taken." });
    }
    if (existingUser?.email === normalizedEmail) {
      return res.status(409).json({ message: "Email is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.email || error.keyValue?.email) {
        return res.status(409).json({ message: "Email is already taken." });
      }
      return res.status(409).json({ message: "Username is already taken." });
    }
    return res.status(500).json({ message: "Registration failed.", error: error.message });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    const identifier = (username || "").trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid username/email or password." });
    }

    const isValid = await bcrypt.compare(password || "", user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid username/email or password." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed.", error: error.message });
  }
}

async function me(req, res) {
  return res.json({ user: serializeUser(req.user) });
}

async function forgotPassword(req, res) {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.json({ message: PASSWORD_RESET_SUCCESS_MESSAGE });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: PASSWORD_RESET_SUCCESS_MESSAGE });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetLink = `${clientUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink
    });

    return res.json({ message: PASSWORD_RESET_SUCCESS_MESSAGE });
  } catch (error) {
    return res.status(500).json({ message: "Could not process password reset.", error: error.message });
  }
}

async function resetPassword(req, res) {
  try {
    const token = req.params.token || "";
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or expired." });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = "";
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: "Password updated. You can now log in." });
  } catch (error) {
    return res.status(500).json({ message: "Could not reset password.", error: error.message });
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword };
