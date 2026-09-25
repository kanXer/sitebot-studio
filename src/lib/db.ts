import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  isMemoryMode: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
  isMemoryMode: false,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export function isUsingMemoryDb(): boolean {
  if (cached.isMemoryMode) return true;
  const uri = process.env.MONGODB_URI;
  if (
    !uri ||
    uri.includes('cluster0.xxxxx.mongodb.net') ||
    uri.includes('username:password') ||
    uri.includes('db_user:db_password') ||
    uri.includes('dummy_user')
  ) {
    cached.isMemoryMode = true;
    return true;
  }
  return false;
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI;

  // If no URI or default placeholder is present, operate in memory fallback mode
  if (
    !uri ||
    uri.includes('cluster0.xxxxx.mongodb.net') ||
    uri.includes('username:password') ||
    uri.includes('db_user:db_password') ||
    uri.includes('dummy_user')
  ) {
    cached.isMemoryMode = true;
    return null;
  }

  if (cached.conn) {
    cached.isMemoryMode = false;
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        cached.isMemoryMode = false;
        console.log('MongoDB connected successfully via standard non-SRV connection.');
        return mongooseInstance;
      })
      .catch((err) => {
        console.warn(
          'MongoDB connection could not be established. Seamlessly operating in in-memory mode:',
          err.message
        );
        cached.isMemoryMode = true;
        return null as any;
      });
  }

  try {
    cached.conn = await cached.promise;
    if (!cached.conn) {
      cached.isMemoryMode = true;
    }
  } catch {
    cached.promise = null;
    cached.isMemoryMode = true;
  }

  return cached.conn;
}
