const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Payment webhook raw body MUST be available for signature verification
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// CORS (fail closed in production unless explicit origins are configured)
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && (origin.startsWith('file://') || /localhost|127\.0\.0\.1/.test(origin))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
};
app.use(cors(corsOptions));

// Body Parsers with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Basic rate limiting (tighter on auth & payments)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Serve static files (Uploaded Reports)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  index: false,
  maxAge: isProduction ? '1h' : 0
}));

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/location', require('./routes/location.routes'));
app.use('/api/report', require('./routes/report.routes'));
app.use('/api/provider', require('./routes/provider.routes'));
app.use('/api/services', require('./routes/service.routes'));
app.use('/api/config', require('./routes/config.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
let paymentRoutes = null;
try {
    paymentRoutes = require('./routes/payment.routes');
    if (process.env.NODE_ENV !== 'production') console.log('Payment routes loaded');
} catch (e) {
    if (process.env.NODE_ENV !== 'production') console.error('Payment routes load error', e && e.message ? e.message : e);
}
app.use('/api/payment', paymentLimiter, paymentRoutes || express.Router());

// Health Check
app.get('/api/health', (req, res) => { res.json({ status: 'ok' }); });

// Error Handling
app.use(errorHandler);

module.exports = app;
