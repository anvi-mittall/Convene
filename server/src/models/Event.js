import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000
    },
    category: {
      type: String,
      required: true,
      enum: ['workshop', 'seminar', 'webinar', 'conference', 'other']
    },
    speakerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    speakerBio: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    mode: {
      type: String,
      required: true,
      enum: ['offline', 'online', 'hybrid']
    },
    venue: {
      type: String,
      trim: true,
      maxlength: 200,
      validate: {
        validator: function (v) {
          if (this.mode === 'offline' || this.mode === 'hybrid') {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'Venue is required for offline and hybrid events'
      }
    },
    meetingLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.mode === 'online' || this.mode === 'hybrid') {
            return typeof v === 'string' && /^https?:\/\/.+/i.test(v);
          }
          return true;
        },
        message: 'A valid HTTP(S) meeting link is required for online and hybrid events'
      }
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return this.startTime && v > this.startTime;
        },
        message: 'End time must be strictly after start time'
      }
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 10000
    },
    confirmedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    posterUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['published', 'cancelled'],
      default: 'published'
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

eventSchema.index({ startTime: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ title: 'text', description: 'text', speakerName: 'text' });

export const Event = mongoose.model('Event', eventSchema);
