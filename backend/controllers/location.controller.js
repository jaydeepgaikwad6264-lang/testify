const User = require('../models/User');

// @desc    Update provider location
// @route   POST /api/location/update
// @access  Private
const updateLocation = async (req, res) => {
    const { lat, lng } = req.body;
    
    const user = await User.findById(req.user._id);
    if (user) {
        user.location = { lat, lng };
        await user.save();
        res.json({ message: 'Location updated', location: user.location });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Get directions (Mock or Proxy to Google)
// @route   GET /api/location/directions
// @access  Private
const getDirections = async (req, res) => {
    const { originLat, originLng, destLat, destLng } = req.query;

    // In production, call Google Maps Directions API here
    // For MVP, return mock distance/duration
    
    // Calculate simple haversine distance for mock
    // This is just a placeholder response
    
    res.json({
        distance: { text: "5.2 km", value: 5200 },
        duration: { text: "15 mins", value: 900 },
        // Polyline would come from Google API
        polyline: "mock_polyline_string" 
    });
};

module.exports = { updateLocation, getDirections };
