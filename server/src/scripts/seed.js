import crypto from 'crypto';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Feedback } from '../models/Feedback.js';

export async function seedAdmin() {
  const existingAdmin = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase().trim() });
  if (existingAdmin) {
    console.log(`ℹ️ Admin already exists: ${existingAdmin.email}`);
    return existingAdmin;
  }

  const passwordHash = await User.hashPassword(env.ADMIN_PASSWORD);
  const admin = await User.create({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash,
    role: 'admin',
    isActive: true
  });

  console.log(`✅ Admin created: ${admin.email}`);
  return admin;
}

export async function seedDemoData() {
  console.log('🚀 Seeding demo organizer, attendees, events, and registrations...');
  const demoPassword = 'Password123!';
  const passwordHash = await User.hashPassword(demoPassword);

  // 1. Create or retrieve demo organizer
  let organizer = await User.findOne({ email: 'organizer@convene.com' });
  if (!organizer) {
    organizer = await User.create({
      name: 'Sarah Connor (Organizer)',
      email: 'organizer@convene.com',
      passwordHash,
      role: 'organizer',
      isActive: true
    });
    console.log(`✅ Created demo organizer: organizer@convene.com`);
  }

  // 2. Create 5 attendees
  const attendeeEmails = [
    'alice@convene.com',
    'bob@convene.com',
    'charlie@convene.com',
    'diana@convene.com',
    'edward@convene.com'
  ];

  const attendees = [];
  for (const email of attendeeEmails) {
    let attendee = await User.findOne({ email });
    if (!attendee) {
      attendee = await User.create({
        name: email.split('@')[0].replace(/^\w/, (c) => c.toUpperCase()) + ' Student',
        email,
        passwordHash,
        role: 'attendee',
        isActive: true
      });
      console.log(`✅ Created demo attendee: ${email}`);
    }
    attendees.push(attendee);
  }

  const now = Date.now();

  // 3. Create 4 demo events:
  // Event A: Past (completed)
  let pastEvent = await Event.findOne({ title: 'Fullstack Microservices with Node.js & Docker' });
  if (!pastEvent) {
    pastEvent = await Event.create({
      title: 'Fullstack Microservices with Node.js & Docker',
      description: 'Comprehensive seminar detailing distributed systems architecture, event-driven orchestration, containerization, and resilience patterns.',
      category: 'workshop',
      speakerName: 'Dr. Martin Fowler',
      speakerBio: 'Enterprise Systems Architect & Distributed Software Author',
      mode: 'online',
      meetingLink: 'https://meet.google.com/convene-demo-past',
      startTime: new Date(now - 7 * 86400000), // 7 days ago
      endTime: new Date(now - 7 * 86400000 + 4 * 3600000), // 7 days ago + 4h
      capacity: 50,
      confirmedCount: 2,
      status: 'published',
      createdBy: organizer._id
    });

    // Register Alice & Bob as attended
    await Registration.create({
      user: attendees[0]._id,
      event: pastEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 7 * 86400000 + 30 * 60000),
      qrToken: crypto.randomBytes(32).toString('hex')
    });

    await Registration.create({
      user: attendees[1]._id,
      event: pastEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 7 * 86400000 + 45 * 60000),
      qrToken: crypto.randomBytes(32).toString('hex')
    });

    // Submit a review from Alice
    await Feedback.create({
      user: attendees[0]._id,
      event: pastEvent._id,
      rating: 5,
      comment: 'Exceptional deep dive into microservices patterns and resilient infrastructure.'
    });

    console.log('✅ Created completed event with attended attendees and feedback review');
  }

  // Event B: Ongoing-capable (live now or starts within 15 min, inside check-in window)
  let liveEvent = await Event.findOne({ title: 'AI-Native Systems & High-Throughput Pipelines' });
  if (!liveEvent) {
    liveEvent = await Event.create({
      title: 'AI-Native Systems & High-Throughput Pipelines',
      description: 'Live interactive coding workshop implementing vector search, streaming LLM outputs, and real-time evaluation harnesses.',
      category: 'seminar',
      speakerName: 'Dr. Fei-Fei Li',
      speakerBio: 'Professor and Co-Director of the Stanford Human-Centered AI Institute',
      mode: 'hybrid',
      venue: 'Auditorium 1, Tech Innovation Hub',
      meetingLink: 'https://meet.google.com/convene-demo-live',
      startTime: new Date(now - 15 * 60000), // started 15 min ago
      endTime: new Date(now + 105 * 60000), // ends in 1h 45m
      capacity: 30,
      confirmedCount: 2,
      status: 'published',
      createdBy: organizer._id
    });

    // Register Charlie (unattended, ready to scan) and Diana (attended)
    await Registration.create({
      user: attendees[2]._id,
      event: liveEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: 'demo-live-token-charlie-11111111111111111111111111111111111111111111'
    });

    await Registration.create({
      user: attendees[3]._id,
      event: liveEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 10 * 60000),
      qrToken: 'demo-live-token-diana-22222222222222222222222222222222222222222222'
    });

    console.log('✅ Created live ongoing event ready for QR scanner check-in');
  }

  // Event C: Upcoming with open seats
  let upcomingOpenEvent = await Event.findOne({ title: 'Zero-Trust Security & Cloud Defense Hands-on' });
  if (!upcomingOpenEvent) {
    upcomingOpenEvent = await Event.create({
      title: 'Zero-Trust Security & Cloud Defense Hands-on',
      description: 'Hands-on laboratory analyzing real-world attack vectors, credential exfiltration, and enforcing zero-trust boundaries.',
      category: 'workshop',
      speakerName: 'Bruce Schneier',
      speakerBio: 'Security Specialist & Public-Interest Technologist',
      mode: 'offline',
      venue: 'Cyber Range Lab, Science Block B',
      startTime: new Date(now + 3 * 86400000), // starts in 3 days
      endTime: new Date(now + 3 * 86400000 + 3 * 3600000),
      capacity: 25,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizer._id
    });

    await Registration.create({
      user: attendees[0]._id,
      event: upcomingOpenEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: crypto.randomBytes(32).toString('hex')
    });

    console.log('✅ Created upcoming event with available seats');
  }

  // Event D: Upcoming at full capacity with waitlist
  let fullEvent = await Event.findOne({ title: 'Quantum Computing Fundamentals & Qubits' });
  if (!fullEvent) {
    fullEvent = await Event.create({
      title: 'Quantum Computing Fundamentals & Qubits',
      description: 'Explore superposition, quantum entanglement, and quantum algorithms through interactive simulator experiments.',
      category: 'conference',
      speakerName: 'Dr. David Deutsch',
      speakerBio: 'Physicist at the Centre for Quantum Computation, Oxford',
      mode: 'online',
      meetingLink: 'https://meet.google.com/convene-demo-quantum',
      startTime: new Date(now + 5 * 86400000), // starts in 5 days
      endTime: new Date(now + 5 * 86400000 + 2 * 3600000),
      capacity: 2, // Low capacity to simulate full house
      confirmedCount: 2,
      status: 'published',
      createdBy: organizer._id
    });

    // 2 Confirmed attendees filling capacity
    await Registration.create({
      user: attendees[0]._id,
      event: fullEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: crypto.randomBytes(32).toString('hex')
    });

    await Registration.create({
      user: attendees[1]._id,
      event: fullEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: crypto.randomBytes(32).toString('hex')
    });

    // 2 Waitlisted attendees
    await Registration.create({
      user: attendees[2]._id,
      event: fullEvent._id,
      status: 'waitlisted',
      queuedAt: new Date(now - 3600000),
      attended: false
    });

    await Registration.create({
      user: attendees[3]._id,
      event: fullEvent._id,
      status: 'waitlisted',
      queuedAt: new Date(now - 1800000),
      attended: false
    });

    console.log('✅ Created full-capacity event with active waitlist');
  }

  console.log('\n=========================================');
  console.log('🔑 DEMO CREDENTIALS FOR TESTING & REVIEW:');
  console.log('=========================================');
  console.log(`👑 ADMIN:`);
  console.log(`   Email:    ${env.ADMIN_EMAIL}`);
  console.log(`   Password: ${env.ADMIN_PASSWORD}\n`);
  console.log(`🎯 ORGANIZER:`);
  console.log(`   Email:    organizer@convene.com`);
  console.log(`   Password: ${demoPassword}\n`);
  console.log(`👥 ATTENDEES (Password: ${demoPassword} for all):`);
  attendeeEmails.forEach((email) => {
    console.log(`   - ${email}`);
  });
  console.log('=========================================\n');
}

export async function runSeed() {
  await connectDB();
  console.log('🌱 Starting seed...');

  try {
    await seedAdmin();

    const isDemo = process.argv.includes('--demo');
    if (isDemo) {
      await seedDemoData();
    }

    console.log('✨ Seed completed successfully.');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// If executed directly from command line
if (process.argv[1]?.endsWith('seed.js')) {
  runSeed();
}
