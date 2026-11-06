import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import mongoose from 'mongoose';

function checkNoMongoOperators(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      throw ApiError.badRequest('VALIDATION_ERROR', `Invalid property name: ${key}`);
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      checkNoMongoOperators(obj[key]);
    }
  }
}

export const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId'
});

export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        checkNoMongoOperators(req.params);
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        checkNoMongoOperators(req.query);
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        checkNoMongoOperators(req.body);
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
