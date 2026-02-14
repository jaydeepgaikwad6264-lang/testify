const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadReport, getReport } = require('../controllers/report.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const asyncHandler = require('express-async-handler');

// Multer Config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'reports');
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
        cb(null, dir);
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const checkFileType = (file, cb) => {
    const filetypes = /pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Error: PDFs Only!');
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

router.post('/upload/:bookingId', protect, authorize('provider'), upload.single('report'), asyncHandler(uploadReport));
router.get('/:bookingId', protect, asyncHandler(getReport));

module.exports = router;
