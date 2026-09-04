const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const validateEnv = () => {
    const required = ['MONGO_URI', 'JWT_SECRET'];
    if (process.env.NODE_ENV === 'production') {
        required.push('CORS_ORIGINS');
    }
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
    if ((process.env.JWT_SECRET || '').length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
    if (process.env.NODE_ENV !== 'production') {
        console.log('Razorpay configured:', hasRazorpay);
    }
};

// Connect to MongoDB with retry
const connectDB = async (retries = 5, delayMs = 2000) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`MongoDB Connected: ${conn.connection.host}`);
        }
    } catch (error) {
        if (retries <= 0) {
            console.error(`MongoDB connection failed: ${error.message}`);
            process.exit(1);
        }
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`MongoDB connection retry in ${delayMs}ms... (${retries} left)`);
        }
        await new Promise(r => setTimeout(r, delayMs));
        return connectDB(retries - 1, delayMs);
    }
};

let server;
const startServer = async () => {
    validateEnv();
    await connectDB();
    server = app.listen(PORT, () => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Server running on port ${PORT}`);
        }
    });
};

startServer();

const gracefulShutdown = async (signal) => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`${signal} received. Closing server...`);
        }
        if (server) {
            await new Promise(res => server.close(res));
        }
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Graceful shutdown error:', err);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
