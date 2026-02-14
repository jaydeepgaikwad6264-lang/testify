const asyncHandler = require('express-async-handler');

// @desc    Provide public client configuration (safe to expose)
// @route   GET /api/config/maps-key
// @access  Public
const getMapsKey = asyncHandler(async (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ googleMapsApiKey: key ? '***' + key.slice(-6) : '' });
});

// @desc    Provide raw maps key for client (browser must have domain restrictions)
// @route   GET /api/config/maps-key/raw
// @access  Public
const getMapsKeyRaw = asyncHandler(async (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ googleMapsApiKey: key });
});

module.exports = { getMapsKey, getMapsKeyRaw };
