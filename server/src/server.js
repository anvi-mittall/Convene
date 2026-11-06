import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startReminderCron } from './services/reminders.js';

async function bootstrap() {
  await connectDB();

  // Start cron scheduler for 24-hour event reminders
  startReminderCron();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 ${env.APP_NAME} server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  const shutdown = async () => {
    console.log('\nShutting down server...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
