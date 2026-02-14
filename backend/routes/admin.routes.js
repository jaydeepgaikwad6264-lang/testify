const express = require('express');
const router = express.Router();
const { listUsers, listProviders, listBookings, activateProvider, setProviderStatus } = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');

router.get('/users', protect, authorize('admin'), asyncHandler(listUsers));
router.get('/providers', protect, authorize('admin'), asyncHandler(listProviders));
router.get('/bookings', protect, authorize('admin'), asyncHandler(listBookings));
router.put('/provider/:providerId/activate', protect, authorize('admin'), asyncHandler(activateProvider));
router.put('/provider/:providerId/status', protect, authorize('admin'), asyncHandler(setProviderStatus));

module.exports = router;
