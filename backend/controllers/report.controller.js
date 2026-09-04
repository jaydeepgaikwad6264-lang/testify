const Booking = require('../models/Booking');
const path = require('path');
const fs = require('fs');

// @desc    Upload medical report
// @route   POST /api/report/upload/:bookingId
// @access  Private (Provider)
const uploadReport = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('No files uploaded');
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (booking) {
        // Construct file URLs
        const fileUrls = req.files.map(file => `/uploads/reports/${file.filename}`);
        
        booking.reportUrls = fileUrls;
        booking.reportUploadedAt = new Date();
        await booking.save();

        res.json({ message: 'Reports uploaded successfully', urls: fileUrls });
    } else {
        // Clean up uploaded files if booking not found
        req.files.forEach(file => fs.unlinkSync(file.path));
        res.status(404);
        throw new Error('Booking not found');
    }
};

// @desc    Get report
// @route   GET /api/report/:bookingId
// @access  Private (User/Provider)
const getReport = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    // Check authorization
    if (
        booking.userId.toString() !== req.user._id.toString() &&
        (booking.providerId && booking.providerId.toString() !== req.user._id.toString())
    ) {
        res.status(403);
        throw new Error('Not authorized to view this report');
    }

    if (!booking.reportUrls || booking.reportUrls.length === 0) {
        res.status(404);
        throw new Error('Reports not available yet');
    }

    res.json({ urls: booking.reportUrls });
};

module.exports = { uploadReport, getReport };
