const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');

router.post('/create-order', protect, authorize('user'), asyncHandler(createOrder));
router.post('/verify', protect, authorize('user'), asyncHandler(verifyPayment));
router.post('/webhook', asyncHandler(handleWebhook)); // public webhook endpoint

module.exports = router;
