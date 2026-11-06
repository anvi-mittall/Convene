import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../.mongo-data');

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

console.log('🚀 Initializing MongoDB service on port 27017...');

try {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbPath: dbPath,
      storageEngine: 'wiredTiger'
    }
  });

  console.log('✅ MongoDB is running and ready for connections at: mongodb://127.0.0.1:27017/convene');
  console.log(`📁 Database directory: ${dbPath}`);

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down MongoDB...');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  if (err.message && err.message.includes('EADDRINUSE')) {
    console.log('ℹ️ A MongoDB instance is already running on port 27017.');
  } else {
    console.error('❌ Failed to start MongoDB:', err);
    process.exit(1);
  }
}
