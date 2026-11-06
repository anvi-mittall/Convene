# Convene | Workshop & Seminar Management Platform

**Convene** is a full-stack MERN-based platform that streamlines the end-to-end management of workshops, seminars, and webinars. It connects administrators, organizers, and attendees through a centralized system with smart registration, automated attendance tracking, and event management.

### ✨ Key Features
- **Event Management:** Create, update, manage, and explore events.
- **Smart Registration:** Atomic seat booking with automatic FIFO waitlist promotion.
- **Attendance Tracking:** QR code scanning with manual check-in support.
- **Digital Certificates:** Automatically generate downloadable PDF certificates.
- **Event Resources:** Upload and download presentations and documents.
- **Feedback System:** Collect attendee ratings and reviews.
- **Automated Notifications:** Scheduled email reminders and event updates.
- **Admin Analytics:** Monitor users, registrations, and platform performance.

### 🛠️ Tech Stack
**Frontend:** React.js, Vite, Tailwind CSS  
**Backend:** Node.js, Express.js  
**Database:** MongoDB, Mongoose  
**Libraries & Tools:** JWT, Zod, PDFKit, Nodemailer, Vitest, QR Code

### 🚀 Highlights
- Role-based authentication and authorization.
- Concurrency-safe registration handling.
- Automated waitlist management.
- RESTful API architecture.
- Automated testing for reliability and edge cases.

### ⚙️ Installation & Setup
1. Clone the repository.
2. Install dependencies in both `client` and `server`.
3. Configure environment variables using `.env.example`.
4. Seed the database using `npm run seed`.
5. Run the frontend and backend development servers using `npm run dev`.