import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthenticated('UNAUTHENTICATED', 'Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      throw ApiError.unauthenticated('UNAUTHENTICATED', 'Invalid or expired token');
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthenticated('UNAUTHENTICATED', 'User no longer active or found');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.sub);
    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}
