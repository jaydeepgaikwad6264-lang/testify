const express = require('express');
const router = express.Router();
const { getMapsKey, getMapsKeyRaw } = require('../controllers/config.controller');
const asyncHandler = require('express-async-handler');

router.get('/maps-key', asyncHandler(getMapsKey));
router.get('/maps-key/raw', asyncHandler(getMapsKeyRaw));

module.exports = router;
