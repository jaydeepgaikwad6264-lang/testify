const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: false // Changed from true
    },
    email: {
        type: String,
        required: false, // Changed from true
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: false, // Changed from true
        unique: true,
        sparse: true // Allow multiple nulls
    },
    mobileNumber: { // Added per requirement
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false // Changed from true
    },
    role: {
        type: String,
        enum: ['user', 'provider', 'admin'],
        default: 'user'
    },
    status: { // Added per requirement for Provider
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    isProfileComplete: { // Added per requirement
        type: Boolean,
        default: false
    },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    services: [{
        type: String // e.g. "BP Check", "Sugar Check"
    }],
    experience: {
        type: Number, // Years of experience
        default: 0
    },
    documentsVerified: {
        type: Boolean,
        default: false
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    walletTransactions: [{
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        serviceName: { type: String },
        amount: { type: Number },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
