const Booking = require('../models/Booking');
const path = require('path');
const fs = require('fs');

// @desc    Upload medical report
// @route   POST /api/report/upload/:bookingId
// @access  Private (Provider)
const uploadReport = async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (booking) {
        // Construct file URL (assuming local storage for MVP)
        // In production, upload to S3/Cloudinary and store URL
        const fileUrl = `/uploads/reports/${req.file.filename}`;
        
        booking.reportPdfUrl = fileUrl;
        booking.reportUploadedAt = new Date();
        await booking.save();

        res.json({ message: 'Report uploaded successfully', url: fileUrl });
    } else {
        // Clean up uploaded file if booking not found
        fs.unlinkSync(req.file.path);
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
        booking.providerId.toString() !== req.user._id.toString()
    ) {
        res.status(403);
        throw new Error('Not authorized to view this report');
    }

    if (!booking.reportPdfUrl) {
        res.status(404);
        throw new Error('Report not available yet');
    }

    res.json({ url: booking.reportPdfUrl });
};

module.exports = { uploadReport, getReport };
