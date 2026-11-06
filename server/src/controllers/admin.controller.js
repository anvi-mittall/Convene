import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getUsers(req, res) {
  const { q, role } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter = {};
  if (role) filter.role = role;

  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } }
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: formatPaginatedResponse(users, total, page, limit)
  });
}

export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  if (id === req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You cannot change your own role');
  }

  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw ApiError.notFound('NOT_FOUND', 'User not found');
  }

  if (targetUser.role === 'admin') {
    throw ApiError.forbidden('FORBIDDEN', 'Cannot change the role of an administrator');
  }

  targetUser.role = role;
  await targetUser.save();

  res.json({
    success: true,
    data: targetUser,
    message: `User role updated to ${role}`
  });
}

export async function updateUserActiveStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (id === req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You cannot change your own active status');
  }

  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw ApiError.notFound('NOT_FOUND', 'User not found');
  }

  targetUser.isActive = isActive;
  await targetUser.save();

  res.json({
    success: true,
    data: targetUser,
    message: `User active status set to ${isActive}`
  });
}

export async function getAdminStats(req, res) {
  const [totalUsers, totalEvents, totalConfirmedRegistrations, totalAttended] = await Promise.all([
    User.countDocuments({}),
    Event.countDocuments({}),
    Registration.countDocuments({ status: 'confirmed' }),
    Registration.countDocuments({ attended: true })
  ]);

  const confirmedOrAttended = await Registration.countDocuments({
    $or: [{ status: 'confirmed' }, { attended: true }]
  });

  const overallAttendanceRate = confirmedOrAttended > 0
    ? Math.round((totalAttended / confirmedOrAttended) * 100)
    : 0;

  // Top events by registrations (max 10: title, confirmed)
  const topEvents = await Event.find({})
    .sort({ confirmedCount: -1 })
    .limit(10)
    .select('title confirmedCount');

  const topEventsByRegistrations = topEvents.map((e) => ({
    _id: e._id,
    title: e.title,
    confirmed: e.confirmedCount
  }));

  // Events by category
  const categories = ['workshop', 'seminar', 'webinar', 'conference', 'other'];
  const categoryCounts = await Event.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  const catMap = Object.fromEntries(categoryCounts.map((c) => [c._id, c.count]));
  const eventsByCategory = categories.map((cat) => ({
    category: cat,
    count: catMap[cat] || 0
  }));

  // Registrations last 30 days (all days included, zero-count if none)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const regAgg = await Registration.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  const regMap = Object.fromEntries(regAgg.map((r) => [r._id, r.count]));
  const registrationsLast30Days = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    registrationsLast30Days.push({
      date: dateStr,
      count: regMap[dateStr] || 0
    });
  }

  res.json({
    success: true,
    data: {
      totalUsers,
      totalEvents,
      totalConfirmedRegistrations,
      overallAttendanceRate,
      topEventsByRegistrations,
      eventsByCategory,
      registrationsLast30Days
    }
  });
}
