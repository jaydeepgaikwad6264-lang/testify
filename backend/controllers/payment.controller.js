const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { isLocationInDelhi } = require('../utils/delhiValidator');

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

const createOrder = async (req, res) => {
    const { serviceId, serviceName, location, userLocation } = req.body;
    let key_id = process.env.RAZORPAY_KEY_ID;
    let key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
        try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
        key_id = process.env.RAZORPAY_KEY_ID;
        key_secret = process.env.RAZORPAY_KEY_SECRET;
    }

    if (!key_id || !key_secret) {
        res.status(500);
        throw new Error('Payment gateway not configured');
    }

    const finalLocation = userLocation || location;
    if (!finalLocation || !finalLocation.lat || !finalLocation.lng) {
        res.status(400);
        throw new Error('Valid location data (lat/lng) is required');
    }
    if (!isLocationInDelhi(finalLocation.lat, finalLocation.lng)) {
        res.status(400);
        throw new Error('Service available only in Delhi NCR');
    }

    let service = null;
    if (serviceId) {
        service = await Service.findById(serviceId);
    }
    if (!service && serviceName) {
        service = await Service.findOne({ name: serviceName });
    }
    if (!service) {
        res.status(404);
        throw new Error('Service not found');
    }

    const effectivePrice = ((service.name || '').trim() === 'Combo Check') ? 109 : Number(service.price);
    const amountPaise = Math.round(effectivePrice * 100);
    const uid = (req.user && req.user._id) ? req.user._id.toString().slice(-6) : 'user';
    let receipt = `rcpt_${Date.now().toString(36)}_${uid}`;
    if (receipt.length > 40) {
        receipt = receipt.slice(0, 40);
    }

    const payload = {
        amount: amountPaise,
        currency: 'INR',
        receipt,
        payment_capture: 1
    };

    let order;
    try {
        const resp = await axios.post(`${RAZORPAY_BASE_URL}/orders`, payload, {
            auth: { username: key_id, password: key_secret }
        });
        order = resp.data;
    } catch (err) {
        const status = (err && err.response && err.response.status) ? err.response.status : 500;
        if (status === 401) {
            res.status(502);
            throw new Error('Payment provider auth failed: invalid Razorpay API keys');
        }
        const detail = (err && err.response && err.response.data && err.response.data.error && err.response.data.error.description)
            ? `: ${err.response.data.error.description}`
            : '';
        res.status(502);
        throw new Error(`Payment provider error (${status})${detail}`);
    }

    res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: key_id,
        service: { _id: service._id, name: service.name, price: effectivePrice },
        location: finalLocation
    });
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, serviceId, serviceName, location, userLocation, scheduledDate, timeSlot } = req.body;
    let key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
        try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
        key_secret = process.env.RAZORPAY_KEY_SECRET;
    }

    if (!key_secret) {
        res.status(500);
        throw new Error('Payment gateway not configured');
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400);
        throw new Error('Missing payment verification fields');
    }

    const expectedSignature = crypto
        .createHmac('sha256', key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    if (!isValid) {
        res.status(400);
        throw new Error('Invalid payment signature');
    }

    const finalLocation = userLocation || location;
    if (!finalLocation || !finalLocation.lat || !finalLocation.lng) {
        res.status(400);
        throw new Error('Valid location data (lat/lng) is required');
    }
    if (!isLocationInDelhi(finalLocation.lat, finalLocation.lng)) {
        res.status(400);
        throw new Error('Service available only in Delhi NCR');
    }

    let service = null;
    if (serviceId) {
        service = await Service.findById(serviceId);
    }
    if (!service && serviceName) {
        service = await Service.findOne({ name: serviceName });
    }
    if (!service) {
        res.status(404);
        throw new Error('Service not found');
    }

    const effectivePrice2 = ((service.name || '').trim() === 'Combo Check') ? 109 : Number(service.price);
    const booking = await Booking.create({
        userId: req.user._id,
        serviceId: service._id,
        userLocation: finalLocation,
        price: effectivePrice2,
        status: 'pending',
        paymentStatus: 'paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        scheduledDate: scheduledDate || null,
        timeSlot: timeSlot || null
    });

    res.status(201).json(booking);
};

const handleWebhook = async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] || '';

    if (!webhookSecret) {
        return res.status(200).json({ received: true });
    }

    const rawBodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBodyStr)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    try {
        const parsed = Buffer.isBuffer(req.body) ? JSON.parse(rawBodyStr) : req.body;
        const event = parsed.event;
        const payload = parsed.payload || {};

        if (event === 'payment.captured' && payload && payload.payment) {
            const payment = payload.payment.entity || {};
            const orderId = payment.order_id;
            const paymentId = payment.id;
            await Booking.updateMany(
                { razorpayOrderId: orderId },
                { $set: { razorpayPaymentId: paymentId, paymentStatus: 'paid' } }
            );
        } else if (event === 'payment.failed' && payload && payload.payment) {
            const payment = payload.payment.entity || {};
            const orderId = payment.order_id;
            await Booking.updateMany(
                { razorpayOrderId: orderId },
                { $set: { paymentStatus: 'failed' } }
            );
        }
    } catch (_) {}

    res.status(200).json({ received: true });
};

module.exports = {
    createOrder,
    verifyPayment,
    handleWebhook
};
