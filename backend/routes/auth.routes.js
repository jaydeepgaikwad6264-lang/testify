const express = require('express');
const router = express.Router();
const { registerUser, loginUser, sendOtpController, verifyOtpController, getProfile, updateProfile, getUserByPhone } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const asyncHandler = require('express-async-handler');
const { check, validationResult } = require('express-validator');

const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      return next(new Error(errors.array()[0].msg));
    }
    next();
  }
];

router.post(
  '/send-otp',
  validate([
    check('mobileNumber').trim().notEmpty().withMessage('Mobile number is required')
  ]),
  asyncHandler(sendOtpController)
);

router.post(
  '/verify-otp',
  validate([
    check('mobileNumber').trim().notEmpty().withMessage('Mobile number is required'),
    check('otp').trim().notEmpty().withMessage('OTP is required'),
    check('verificationId').trim().notEmpty().withMessage('Verification ID is required')
  ]),
  asyncHandler(verifyOtpController)
);

router.post(
  '/register',
  validate([
    check('name').trim().notEmpty().withMessage('Name is required'),
    check('email').optional().isEmail().withMessage('Invalid email'),
    check('phone').trim().notEmpty().withMessage('Phone is required'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    check('role').optional().isIn(['user', 'provider']).withMessage('Invalid role')
  ]),
  asyncHandler(registerUser)
);

router.post(
  '/login',
  validate([
    check('email').optional().isEmail().withMessage('Invalid email'),
    check('phone').optional().notEmpty().withMessage('Phone is required when email not provided'),
    check('password').notEmpty().withMessage('Password is required')
  ]),
  asyncHandler(loginUser)
);

// Profile routes (protected)
router.get('/profile', protect, asyncHandler(getProfile));
router.put(
  '/profile',
  protect,
  validate([
    check('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    check('email').optional().isEmail().withMessage('Invalid email format')
  ]),
  asyncHandler(updateProfile)
);

// Get user by phone number (protected route for cross-user contact)
router.get('/user-by-phone/:phone', protect, asyncHandler(getUserByPhone));

module.exports = router;
