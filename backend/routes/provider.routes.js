const express = require('express');
const router = express.Router();
const { getProviderProfile, updateProviderProfile, getProviderHistory, getProviderWallet, uploadDocuments } = require('../controllers/provider.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');
const upload = require('../middleware/upload.middleware');

router.get('/profile', protect, authorize('provider'), asyncHandler(getProviderProfile));
router.put('/profile', protect, authorize('provider'), asyncHandler(updateProviderProfile));
router.post('/upload-documents', protect, authorize('provider'), upload.array('documents', 5), asyncHandler(uploadDocuments));
router.get('/history', protect, authorize('provider'), asyncHandler(getProviderHistory));
router.get('/wallet', protect, authorize('provider'), asyncHandler(getProviderWallet));

module.exports = router;
