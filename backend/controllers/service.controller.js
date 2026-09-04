const Service = require('../models/Service');
const asyncHandler = require('express-async-handler');

// @desc    List active services
// @route   GET /api/services
// @access  Public
const getServices = asyncHandler(async (req, res) => {
    let services = await Service.find({ isActive: true })
        .select('_id name price duration isActive')
        .sort({ name: 1 })
        .lean();
    services = services.map(s => {
        if ((s.name || '').trim() === 'Combo Check') {
            return { _id: s._id, name: s.name, price: 109, duration: s.duration, isActive: s.isActive };
        }
        return s;
    });
    res.json(services);
});

module.exports = {
    getServices
};
