const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User'); // Import User model
const { isLocationInDelhi } = require('../utils/delhiValidator');

// @desc    Create new booking
// @route   POST /api/bookings/create
// @access  Private (User)
const createBooking = async (req, res) => {
    const { serviceId, serviceName, location, userLocation } = req.body;
    
    // Support both 'location' (frontend) and 'userLocation' (schema) keys
    const finalLocation = userLocation || location;

    if (!finalLocation || !finalLocation.lat || !finalLocation.lng) {
        res.status(400);
        throw new Error('Valid location data (lat/lng) is required');
    }

    // 1. Validate Delhi Location
    if (!isLocationInDelhi(finalLocation.lat, finalLocation.lng)) {
        res.status(400);
        throw new Error('Service available only in Delhi NCR');
    }

    // 2. Fetch Service Price
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

    const priceOverride = ((service.name || '').trim() === 'Combo Check') ? 109 : service.price;
    const booking = await Booking.create({
        userId: req.user._id,
        serviceId: service._id,
        userLocation: finalLocation,
        price: priceOverride,
        status: 'pending'
    });

    res.status(201).json(booking);
};

// @desc    Get user bookings
// @route   GET /api/bookings/user/:userId
// @access  Private
const getUserBookings = async (req, res) => {
    const bookings = await Booking.find({ userId: req.params.userId })
                                  .populate('serviceId')
                                  .populate('providerId', 'name phone mobileNumber location')
                                  .sort({ createdAt: -1 });
    res.json(bookings);
};

// @desc    Get provider bookings (requests or active)
// @route   GET /api/bookings/provider/:providerId
// @access  Private (Provider)
const getProviderBookings = async (req, res) => {
    // Show only active assigned bookings for the provider
    const bookings = await Booking.find({ 
                                    providerId: req.params.providerId,
                                    status: { $in: ['accepted', 'on_the_way'] }
                                  })
                                  .populate('serviceId')
                                  .populate('userId', 'name phone mobileNumber')
                                  .sort({ createdAt: -1 });
    res.json(bookings);
};

// @desc    Get pending bookings for providers to accept
// @route   GET /api/bookings/pending
// @access  Private (Provider)
const getPendingBookings = async (req, res) => {
    const provider = await User.findById(req.user._id);

    if (!provider || !provider.isActive) {
        res.status(403);
        throw new Error('Provider account is not active');
    }

    // Get Service IDs that match provider's offered services
    // 1. Find Service documents matching names in provider.services
    const services = await Service.find({ name: { $in: provider.services } });
    const serviceIds = services.map(s => s._id);
    const combo = await Service.findOne({ name: 'Combo Check' });
    if (combo && combo._id) serviceIds.push(combo._id);

    // 2. Find pending bookings for these services
    const bookings = await Booking.find({
        status: 'pending',
        serviceId: { $in: serviceIds },
        ignoredBy: { $ne: req.user._id }
    })
    .populate('serviceId')
    .populate('userId', 'name phone');
    
    res.json(bookings);
};

// @desc    Accept booking
// @route   PUT /api/bookings/accept/:bookingId
// @access  Private (Provider)
const acceptBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);

    if (booking) {
        if(booking.status !== 'pending') {
            res.status(400);
            throw new Error('Booking already accepted');
        }

        booking.providerId = req.user._id;
        booking.status = 'accepted';
        booking.providerLocation = req.user.location || { lat: 28.6139, lng: 77.2090 }; // Default if not set
        
        const updatedBooking = await booking.save();
        
        const populatedBooking = await Booking.findById(updatedBooking._id)
            .populate('userId', 'name mobileNumber')
            .populate('providerId', 'name mobileNumber');

        res.json(populatedBooking);
    } else {
        res.status(404);
        throw new Error('Booking not found');
    }
};

// @desc    Start booking (On the way)
// @route   PUT /api/bookings/start/:bookingId
// @access  Private (Provider)
const startBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);

    if (booking && booking.providerId.equals(req.user._id)) {
        booking.status = 'on_the_way';
        const updatedBooking = await booking.save();
        res.json(updatedBooking);
    } else {
        res.status(404);
        throw new Error('Booking not found or authorized');
    }
};

// @desc    Complete booking
// @route   PUT /api/bookings/complete/:bookingId
// @access  Private (Provider)
const completeBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId).populate('serviceId', 'name');
    if (booking && booking.providerId && booking.providerId.equals(req.user._id)) {
        booking.status = 'completed';
        const updatedBooking = await booking.save();
        const serviceName = (booking.serviceId && booking.serviceId.name) || '';
        let credit = 0;
        if (serviceName === 'BP Check') credit = 35;
        else if (serviceName === 'Sugar Check') credit = 35;
        else if (serviceName === 'Combo Check') credit = 50;
        if (credit > 0) {
            const provider = await User.findById(req.user._id);
            if (provider) {
                provider.walletBalance = Number(provider.walletBalance || 0) + credit;
                provider.walletTransactions = provider.walletTransactions || [];
                provider.walletTransactions.push({
                    bookingId: booking._id,
                    serviceName,
                    amount: credit,
                    createdAt: new Date()
                });
                await provider.save();
            }
        }
        res.json(updatedBooking);
    } else {
        res.status(404);
        throw new Error('Booking not found or authorized');
    }
};

const cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }
    if (!booking.providerId || booking.providerId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to cancel this booking');
    }
    if (!['accepted', 'on_the_way'].includes(booking.status)) {
        res.status(400);
        throw new Error('Only active bookings can be cancelled');
    }
    booking.status = 'cancelled';
    const updatedBooking = await booking.save();
    res.json(updatedBooking);
};

const ignoreBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }
    if (booking.status !== 'pending') {
        res.status(400);
        throw new Error('Only pending bookings can be ignored');
    }
    booking.ignoredBy = booking.ignoredBy || [];
    const exists = booking.ignoredBy.find(id => id.toString() === req.user._id.toString());
    if (!exists) {
        booking.ignoredBy.push(req.user._id);
        await booking.save();
    }
    res.json({ message: 'Ignored for this provider' });
};

// @desc    Get active booking for current user
// @route   GET /api/bookings/user/active
// @access  Private (User)
const getActiveBookingForUser = async (req, res) => {
    const booking = await Booking.findOne({
        userId: req.user._id,
        status: { $in: ['accepted', 'on_the_way'] }
    })
    .populate('serviceId')
    .populate('providerId', 'name phone mobileNumber location');
    if (!booking) return res.json(null);
    res.json(booking);
};

// @desc    Update provider live location for active booking
// @route   PUT /api/bookings/provider/location
// @access  Private (Provider)
const updateProviderLiveLocation = async (req, res) => {
    const { lat, lng, bookingId } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        res.status(400);
        throw new Error('Valid lat and lng are required');
    }
    let booking = null;
    if (bookingId) {
        booking = await Booking.findById(bookingId);
        if (!booking || !booking.providerId || !booking.providerId.equals(req.user._id)) {
            res.status(404);
            throw new Error('Active booking not found for this provider');
        }
    } else {
        booking = await Booking.findOne({
            providerId: req.user._id,
            status: { $in: ['accepted', 'on_the_way'] }
        }).sort({ createdAt: -1 });
        if (!booking) {
            res.status(404);
            throw new Error('No active booking to update location');
        }
    }
    booking.providerLocation = { lat, lng };
    await booking.save();
    res.json({ success: true });
};
// @desc    Get user booking statistics
// @route   GET /api/bookings/user/stats
// @access  Private (User)
const getUserBookingStats = async (req, res) => {
    const userId = req.user._id;
    
    const totalBookings = await Booking.countDocuments({ userId });
    const completedBookings = await Booking.countDocuments({ 
        userId, 
        status: 'completed' 
    });
    
    res.json({
        totalBookings,
        completedBookings,
        pendingBookings: totalBookings - completedBookings
    });
};

// @desc    Get provider booking statistics
// @route   GET /api/bookings/provider/stats
// @access  Private (Provider)
const getProviderBookingStats = async (req, res) => {
    const providerId = req.user._id;
    
    const totalBookings = await Booking.countDocuments({ providerId });
    const completedBookings = await Booking.countDocuments({ 
        providerId, 
        status: 'completed' 
    });
    
    res.json({
        totalBookings,
        completedBookings,
        pendingBookings: totalBookings - completedBookings
    });
};

module.exports.getActiveBookingForUser = getActiveBookingForUser;
module.exports.updateProviderLiveLocation = updateProviderLiveLocation;

module.exports = {
    createBooking,
    getUserBookings,
    getProviderBookings,
    getPendingBookings,
    acceptBooking,
    startBooking,
    completeBooking,
    cancelBooking,
    ignoreBooking,
    getUserBookingStats,
    getProviderBookingStats
};
