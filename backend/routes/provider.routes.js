const express = require('express');
const router = express.Router();
const { getProviderProfile, updateProviderProfile, getProviderHistory, getProviderWallet } = require('../controllers/provider.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');

router.get('/profile', protect, authorize('provider'), asyncHandler(getProviderProfile));
router.put('/profile', protect, authorize('provider'), asyncHandler(updateProviderProfile));
router.get('/history', protect, authorize('provider'), asyncHandler(getProviderHistory));
router.get('/wallet', protect, authorize('provider'), asyncHandler(getProviderWallet));

module.exports = router;
