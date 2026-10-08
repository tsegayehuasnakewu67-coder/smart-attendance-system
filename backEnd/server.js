const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '.env') });

const startServer = async () => {
  await connectDB();

  if (process.env.RUN_EMPLOYEE_MIGRATION === 'true') {
    await require('./utils/migrateEmployees')();
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in backEnd/.env.');
  }

  // ── Scheduled jobs ───────────────────────────────────────────────────────────
  const { scheduleAutoLunchCheckout } = require('./jobs/autoLunchCheckout');
  scheduleAutoLunchCheckout();

  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.use('/api/auth',       require('./routes/authRoutes'));
  app.use('/api/employees',  require('./routes/employeeRoutes'));
  app.use('/api/dashboard',  require('./routes/dashboardRoutes'));
  app.use('/api/users',      require('./routes/userRoutes'));
  app.use('/api/attendance', require('./routes/attendanceRoutes'));
  app.use('/api/reports',    require('./routes/reportsRoutes'));
  app.use('/api/shift',      require('./routes/shiftRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/leaves',       require('./routes/leaveRoutes'));

  app.get('/api/health', (_req, res) => {
    const connected = require('mongoose').connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      message: 'Smart Attendance API is running',
      database: connected ? 'connected' : 'disconnected',
      ts: new Date().toISOString(),
    });
  });

  app.use((req, res) =>
    res.status(404).json({ success: false, message: `${req.method} ${req.originalUrl} not found` })
  );

  app.use((err, _req, res, _next) => {
    console.error('Unhandled API error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.status && err.message ? err.message : 'Server error.',
    });
  });

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () =>
    console.log(`🚀 Server on http://localhost:${PORT} [${process.env.NODE_ENV}]`)
  );

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the existing backend or set PORT to an unused port.`);
    } else {
      console.error('❌ Failed to start HTTP server:', err);
    }
    process.exit(1);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
