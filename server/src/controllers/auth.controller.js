import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function register(req, res, next) {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await User.hashPassword(password);

  // Role is strictly forced to attendee
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'attendee'
  });

  const token = createToken(user);

  res.status(201).json({
    success: true,
    data: {
      user: sanitizeUser(user),
      token
    },
    message: 'User registered successfully'
  });
}

export async function login(req, res, next) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthenticated('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthenticated('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = createToken(user);

  res.json({
    success: true,
    data: {
      user: sanitizeUser(user),
      token
    }
  });
}

export async function getMe(req, res) {
  res.json({
    success: true,
    data: sanitizeUser(req.user)
  });
}
