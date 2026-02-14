const express = require('express');
const router = express.Router();
const { 
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
    getProviderBookingStats,
    getActiveBookingForUser,
    updateProviderLiveLocation
} = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');

// User Routes
router.post('/create', protect, authorize('user'), asyncHandler(createBooking));
router.get('/user/:userId', protect, authorize('user'), asyncHandler(getUserBookings));
router.get('/user/stats', protect, authorize('user'), asyncHandler(getUserBookingStats));
router.get('/user/active', protect, authorize('user'), asyncHandler(getActiveBookingForUser));

// Provider Routes
router.get('/pending', protect, authorize('provider'), asyncHandler(getPendingBookings));
router.get('/provider/:providerId', protect, authorize('provider'), asyncHandler(getProviderBookings));
router.get('/provider/stats', protect, authorize('provider'), asyncHandler(getProviderBookingStats));
router.put('/provider/location', protect, authorize('provider'), asyncHandler(updateProviderLiveLocation));
router.put('/accept/:bookingId', protect, authorize('provider'), asyncHandler(acceptBooking));
router.put('/start/:bookingId', protect, authorize('provider'), asyncHandler(startBooking));
router.put('/complete/:bookingId', protect, authorize('provider'), asyncHandler(completeBooking));
router.put('/cancel/:bookingId', protect, authorize('provider'), asyncHandler(cancelBooking));
router.put('/ignore/:bookingId', protect, authorize('provider'), asyncHandler(ignoreBooking));

module.exports = router;
