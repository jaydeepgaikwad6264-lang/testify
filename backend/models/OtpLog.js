const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema({
    mobileNumber: {
        type: String,
        required: true
    },
    verificationId: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('OtpLog', otpLogSchema);
