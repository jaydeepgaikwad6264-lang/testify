const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'on_the_way', 'completed', 'cancelled'],
        default: 'pending'
    },
    userLocation: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String },
        house: { type: String },
        area: { type: String },
        city: { type: String },
        state: { type: String },
        district: { type: String },
        pin: { type: String }
    },
    providerLocation: {
        lat: { type: Number },
        lng: { type: Number }
    },
    reportPdfUrl: {
        type: String
    },
    reportUploadedAt: {
        type: Date
    },
    price: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['created', 'paid', 'failed', 'refunded'],
        default: 'created'
    },
    ignoredBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    }
}, { timestamps: true });

// Indexes for frequent queries
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, status: 1 });
bookingSchema.index({ serviceId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
