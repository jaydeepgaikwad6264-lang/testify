const express = require('express');
const router = express.Router();
const { getServices } = require('../controllers/service.controller');
const asyncHandler = require('express-async-handler');

router.get('/', asyncHandler(getServices));

module.exports = router;
