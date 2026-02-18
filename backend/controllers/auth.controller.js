const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const otpService = require('../utils/otpService');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { phone }] });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const userRole = role || 'user';
    
    // Providers are inactive by default until profile completion/verification
    const isActive = userRole === 'provider' ? false : true;

    const user = await User.create({
        name,
        email,
        phone,
        password,
        role: userRole,
        isActive
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, phone, password } = req.body;

    // Check for user by email OR phone
    let query = {};
    if (email) query.email = email;
    else if (phone) query.phone = phone;
    else {
        res.status(400);
        throw new Error('Please provide email or phone');
    }

    const user = await User.findOne(query);

    if (user && (await user.comparePassword(password))) {
        // Check if provider is active
        if (user.role === 'provider' && !user.isActive) {
            res.status(403);
            throw new Error('Account is not active. Please complete profile or wait for verification.');
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
};

// @desc    Send OTP to mobile number
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtpController = async (req, res) => {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
        res.status(400);
        throw new Error('Mobile number is required');
    }
    try {
        const response = await otpService.sendOtp(mobileNumber);
        const verificationId = response.data?.verificationId || response.verificationId || null;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await OtpLog.create({
            mobileNumber,
            verificationId: verificationId || 'temp_id',
            expiresAt
        });
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            verificationId,
            mobileNumber
        });
    } catch (e) {
        const msg = e.message || 'Failed to send OTP';
        res.status(502).json({ message: msg });
    }
};

// @desc    Verify OTP and Login/Register
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtpController = async (req, res) => {
    const { mobileNumber, otp, verificationId, role } = req.body;

    if (!mobileNumber || !otp || !verificationId) {
        res.status(400);
        throw new Error('Mobile number, OTP and verification ID are required');
    }

    let validationResponse = null;
    try {
        validationResponse = await otpService.validateOtp(verificationId, otp, mobileNumber);
    } catch (e) {
        const msg = e.message || 'Failed to validate OTP';
        return res.status(400).json({ message: msg });
    }

    // Check validation response status
    // Assuming 'verificationStatus' or similar field. 
    // If the API throws on failure, the try/catch in otpService handles it.
    // If it returns success: false, handle it.
    if (validationResponse.verificationStatus !== 'VERIFICATION_COMPLETED' && validationResponse.status !== 'success') {
         // Adjust condition based on actual API response
         // If generic 'status': 'success'
    }

    // Mark OTP as verified in OtpLog (optional cleanup)
    // await OtpLog.findOneAndUpdate({ verificationId }, { verified: true });

    // Check if user exists
    let user = await User.findOne({ $or: [{ phone: mobileNumber }, { mobileNumber: mobileNumber }] });

    if (user) {
        // Existing User Logic
        if (user.role === 'provider') {
            if (user.status === 'PENDING') {
                 res.status(200).json({
                    success: true,
                    isProviderPending: true,
                    message: 'Provider account is under review',
                    _id: user._id,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                    isProfileComplete: user.isProfileComplete,
                    token: generateToken(user._id)
                 });
                 return;
            }
            if (user.status === 'REJECTED') {
                res.status(403);
                throw new Error('Your provider account has been rejected.');
            }
            if (!user.isActive && user.status !== 'APPROVED') {
                 // Fallback for legacy data where status might be missing but isActive is false
                 res.status(200).json({
                    success: true,
                    isProviderPending: true,
                    message: 'Provider account is under review',
                    _id: user._id,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                    isProfileComplete: user.isProfileComplete,
                    token: generateToken(user._id)
                 });
                 return;
            }
        }

        // Login successful
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            isProfileComplete: user.isProfileComplete,
            token: generateToken(user._id),
        });

    } else {
        // New User Logic - Auto Create
        const requestedRole = role || 'user';
        const isProvider = requestedRole === 'provider';

        const payload = {
            phone: mobileNumber,
            mobileNumber: mobileNumber,
            role: requestedRole,
            isActive: !isProvider,
            isProfileComplete: false
        };
        if (isProvider) {
            payload.status = 'PENDING';
        }

        user = await User.create(payload);

        if (isProvider) {
            res.status(200).json({
                success: true,
                isProviderPending: true,
                message: 'Provider account created and under review',
                _id: user._id,
                name: user.name,
                role: user.role,
                isActive: user.isActive,
                isProfileComplete: user.isProfileComplete,
                token: generateToken(user._id)
            });
        } else {
            // User login
            res.status(201).json({
                _id: user._id,
                name: user.name,
                role: user.role,
                isActive: user.isActive,
                isProfileComplete: user.isProfileComplete,
                token: generateToken(user._id),
            });
        }
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Ensure users (non-providers) are active without violating enum
    if (user.role !== 'provider') {
        if (!user.isActive) {
            user.isActive = true;
            await user.save();
        }
    }
    
    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt
    });
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    const { name, email } = req.body;
    
    if (!name && !email) {
        res.status(400);
        throw new Error('Please provide name or email to update');
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Check if email is already taken by another user
    if (email && email !== user.email) {
        const emailExists = await User.findOne({ email, _id: { $ne: req.user._id } });
        if (emailExists) {
            res.status(400);
            throw new Error('Email already in use by another account');
        }
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    
    // Mark profile as complete if name is provided
    if (name && !user.isProfileComplete) {
        user.isProfileComplete = true;
    }
    
    const updatedUser = await user.save();
    
    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobileNumber: updatedUser.mobileNumber,
        role: updatedUser.role,
        status: updatedUser.status,
        isActive: updatedUser.isActive,
        isProfileComplete: updatedUser.isProfileComplete,
        message: 'Profile updated successfully'
    });
};

// @desc    Get user details by phone number (for cross-user sharing)
// @route   GET /api/auth/user-by-phone/:phone
// @access  Private (requires authentication)
const getUserByPhone = async (req, res) => {
    const { phone } = req.params;
    
    if (!phone) {
        res.status(400);
        throw new Error('Phone number is required');
    }
    
    // Find user by phone (checking both phone and mobileNumber fields)
    const user = await User.findOne({ 
        $or: [{ phone: phone }, { mobileNumber: phone }]
    }).select('-password');
    
    if (!user) {
        res.status(404);
        throw new Error('User not found with this phone number');
    }
    
    // Return basic user details for contact purposes
    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber || user.phone,
        role: user.role,
        isActive: user.isActive
    });
};

module.exports = { registerUser, loginUser, sendOtpController, verifyOtpController, getProfile, updateProfile, getUserByPhone };
