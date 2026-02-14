const User = require('../models/User');
const Booking = require('../models/Booking');
const { isLocationInDelhi } = require('../utils/delhiValidator');

// @desc    Get provider profile
// @route   GET /api/provider/profile
// @access  Private (Provider)
const getProviderProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            location: user.location,
            services: user.services,
            experience: user.experience,
            isActive: user.isActive,
            documentsVerified: user.documentsVerified
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Update provider profile
// @route   PUT /api/provider/profile
// @access  Private (Provider)
const updateProviderProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.phone = req.body.phone || user.phone;
        
        if (req.body.services) user.services = req.body.services;
        if (req.body.experience) user.experience = req.body.experience;
        
        // Handle Location Update
        if (req.body.location) {
            const { lat, lng } = req.body.location;
            if (isLocationInDelhi(lat, lng)) {
                user.location = { lat, lng };
                // Application submitted; activation requires admin approval
                user.isActive = false;
            } else {
                res.status(400);
                throw new Error('Location must be within Delhi NCR to activate profile');
            }
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            location: updatedUser.location,
            services: updatedUser.services,
            token: req.headers.authorization.split(' ')[1] // Just echo back or re-sign if needed
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

module.exports = { getProviderProfile, updateProviderProfile };

const getProviderHistory = async (req, res) => {
    const bookings = await Booking.find({
        providerId: req.user._id,
        status: { $in: ['completed', 'cancelled'] }
    })
    .populate('serviceId')
    .populate('userId', 'name phone')
    .sort({ createdAt: -1 });
    res.json(bookings);
};

const getProviderWallet = async (req, res) => {
    const user = await User.findById(req.user._id).select('walletBalance walletTransactions');
    const tx = (user && user.walletTransactions) || [];
    let bpCount = 0, sugarCount = 0, comboCount = 0;
    tx.forEach(t => {
        const name = (t.serviceName || '').trim();
        if (name === 'BP Check') bpCount++;
        else if (name === 'Sugar Check') sugarCount++;
        else if (name === 'Combo Check') comboCount++;
    });
    res.json({
        balance: Number((user && user.walletBalance) || 0),
        bpCount,
        sugarCount,
        comboCount,
        transactions: tx.slice(-20).reverse()
    });
};

module.exports.getProviderHistory = getProviderHistory;
module.exports.getProviderWallet = getProviderWallet;
