const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    const isServerError = statusCode >= 500;

    res.status(statusCode).json({
        message: process.env.NODE_ENV === 'production' && isServerError
            ? 'Internal server error'
            : err.message,
        ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack })
    });
};

module.exports = { errorHandler };
