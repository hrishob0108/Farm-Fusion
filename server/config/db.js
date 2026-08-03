import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

export const connectDB = async () => {
  let mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/farm-fusion-ai';
  console.log(`[MongoDB] Connecting to database...`);
  
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log(`\n==================================================`);
    console.log(`🌱 [MongoDB Connected Successfully!]`);
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    console.log(`==================================================\n`);
    return true;
  } catch (error) {
    console.warn(`[MongoDB Primary Connection Notice] ${error.message}`);
    
    // Automatic fallback converting Atlas SRV to standard direct replica set URI
    if (mongoUri.includes('mongodb+srv://') && mongoUri.includes('cluster0.p1tqslk.mongodb.net')) {
      try {
        console.log(`[MongoDB] Retrying with direct Atlas node connection...`);
        const fallbackUri = mongoUri
          .replace('mongodb+srv://', 'mongodb://')
          .replace('cluster0.p1tqslk.mongodb.net', 'cluster0-shard-00-00.p1tqslk.mongodb.net:27017,cluster0-shard-00-01.p1tqslk.mongodb.net:27017,cluster0-shard-00-02.p1tqslk.mongodb.net:27017')
          + (mongoUri.includes('?') ? '&ssl=true&authSource=admin' : '?ssl=true&authSource=admin');

        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 10000
        });

        console.log(`\n==================================================`);
        console.log(`🌱 [MongoDB Atlas Connected Successfully via Direct Nodes!]`);
        console.log(`Host: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`);
        console.log(`==================================================\n`);
        return true;
      } catch (fallbackErr) {
        console.error(`[MongoDB Direct Node Connection Error] ${fallbackErr.message}`);
      }
    }

    return false;
  }
};
