
import AppError from '../utils/AppError.js';

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log everything for now (can be improved with a logger later)
    console.error('[GlobalErrorHandler]', err);

    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // Production: simplified response
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }

    // Programming or other unknown error: don't leak details
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
};

export default errorHandler;
