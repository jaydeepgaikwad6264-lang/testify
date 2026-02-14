const User = require('../models/User');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

const listUsers = async (req, res) => {
    const users = await User.find().select('_id name email phone role isActive services experience createdAt');
    res.json(users);
};

const listProviders = async (req, res) => {
    const providers = await User.find({ role: 'provider' }).select('_id name email phone isActive status services experience location createdAt');
    res.json(providers);
};

const listBookings = async (req, res) => {
    const bookings = await Booking.find()
        .populate('userId', 'name phone')
        .populate('providerId', 'name phone')
        .populate('serviceId', 'name price')
        .sort({ createdAt: -1 });
    res.json(bookings);
};

const activateProvider = async (req, res) => {
    const provider = await User.findById(req.params.providerId);
    if (!provider || provider.role !== 'provider') {
        res.status(404);
        throw new Error('Provider not found');
    }
    provider.isActive = true;
    provider.status = 'APPROVED';
    await provider.save();
    res.json({ message: 'Provider activated', providerId: provider._id });
};

const setProviderStatus = async (req, res) => {
    const provider = await User.findById(req.params.providerId);
    if (!provider || provider.role !== 'provider') {
        res.status(404);
        throw new Error('Provider not found');
    }
    const { status } = req.body || {};
    if (!['APPROVED', 'PENDING'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status. Use APPROVED or PENDING');
    }
    provider.status = status;
    provider.isActive = status === 'APPROVED';
    await provider.save();
    res.json({ message: 'Provider status updated', providerId: provider._id, status, isActive: provider.isActive });
};

module.exports = { listUsers, listProviders, listBookings, activateProvider, setProviderStatus };
