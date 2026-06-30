const mongoose = require('mongoose');

async function connectDatabase() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[DATABASE] Connected to MongoDB successfully.');
  } catch (err) {
    console.error('[DATABASE] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DATABASE] Disconnected from MongoDB.');
  });
}

module.exports = { connectDatabase };