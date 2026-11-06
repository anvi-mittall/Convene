import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    status: {
      type: String,
      enum: ['confirmed', 'waitlisted', 'cancelled'],
      required: true
    },
    qrToken: {
      type: String,
      sparse: true,
      unique: true
    },
    attended: {
      type: Boolean,
      default: false
    },
    attendedAt: {
      type: Date
    },
    queuedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index on (user, event)
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
registrationSchema.index({ event: 1, status: 1, queuedAt: 1 });

export const Registration = mongoose.model('Registration', registrationSchema);
