import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import printRoutes from './routes/print';
import couponRoutes from './routes/coupons';
import modifierRoutes from './routes/modifiers';
import modifierGroupRoutes from './routes/modifier-groups';

// Initialize Prisma with connection pool settings
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

// Keep connection alive
prisma.$connect().then(() => {
  console.log('Database connected');
}).catch((err) => {
  console.error('Database connection error:', err);
});

// Initialize Express
const app = express();

// Middleware
// Allow broader CORS for mobile apps - authentication still required
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000', 
      'http://localhost:3002', 
      'http://localhost:3003', 
      'http://localhost:3004', 
      'http://localhost:3005',
      'http://localhost:5173', // Android app dev server
      'capacitor://localhost', // Capacitor Android app
      'http://localhost', // Capacitor Android (newer versions)
      'ionic://localhost', // Ionic Capacitor
    ];
    
    // Allow any localhost or 192.168.x.x origin for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || /192\.168\.\d+\.\d+/.test(origin)) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/print', printRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/modifiers', modifierRoutes);
app.use('/api/modifier-groups', modifierGroupRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3001;

// Archive previous day's orders at midnight
async function archivePreviousDayOrders() {
  try {
    // Get current time in Sydney timezone
    const nowInSydney = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const todayMidnight = new Date(nowInSydney);
    todayMidnight.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for database query
    const sydneyOffset = 11 * 60 * 60 * 1000; // AEDT is UTC+11
    const todayMidnightUTC = new Date(todayMidnight.getTime() - sydneyOffset + todayMidnight.getTimezoneOffset() * 60 * 1000);
    
    console.log(`[Archive] Sydney time: ${nowInSydney.toISOString()}, cutoff: ${todayMidnightUTC.toISOString()}`);
    
    const result = await prisma.order.updateMany({
      where: {
        archived: false,
        createdAt: {
          lt: todayMidnightUTC,
        },
      },
      data: {
        archived: true,
      },
    });
    
    console.log(`📦 Archived ${result.count} orders from previous days`);
  } catch (error) {
    console.error('❌ Failed to archive orders:', error);
  }
}

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Schedule midnight archive job (runs at 00:00 every day)
    cron.schedule('0 0 * * *', archivePreviousDayOrders, {
      timezone: 'Australia/Sydney',
    });
    console.log('⏰ Midnight archive job scheduled');

    // Also archive any old orders on startup
    await archivePreviousDayOrders();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
