const express = require('express');
const router = express.Router();
const { updateLocation, getDirections } = require('../controllers/location.controller');
const { protect } = require('../middleware/auth.middleware');
const asyncHandler = require('express-async-handler');

router.post('/update', protect, asyncHandler(updateLocation));
router.get('/directions', protect, asyncHandler(getDirections));

module.exports = router;
