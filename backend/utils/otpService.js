const axios = require('axios');

const BASE_URL = 'https://cpaas.messagecentral.com/verification/v3';

const ensureConfigured = () => {
    const cid = process.env.MESSAGECENTRAL_CUSTOMER_ID;
    const tok = process.env.MESSAGECENTRAL_AUTH_TOKEN;
    if (!cid || !tok) {
        const msg = 'OTP service not configured';
        throw new Error(msg);
    }
    return { cid, tok };
};

const sendOtp = async (mobileNumber) => {
    const { cid, tok } = ensureConfigured();
    try {
        const response = await axios.post(`${BASE_URL}/send`, null, {
            params: {
                countryCode: '91',
                customerId: cid,
                flowType: 'SMS',
                mobileNumber: mobileNumber
            },
            headers: {
                authToken: tok
            }
        });
        return response.data;
    } catch (error) {
        const detail = error.response?.data?.message || error.response?.data || error.message;
        throw new Error(`OTP send failed: ${detail}`);
    }
};

const validateOtp = async (verificationId, code, mobileNumber) => {
    const { cid, tok } = ensureConfigured();
    try {
        const response = await axios.get(`${BASE_URL}/validateOtp`, {
            params: {
                verificationId,
                code,
                countryCode: '91',
                mobileNumber,
                customerId: cid
            },
            headers: {
                authToken: tok
            }
        });
        return response.data;
    } catch (error) {
        const detail = error.response?.data?.message || error.response?.data || error.message;
        throw new Error(`OTP validate failed: ${detail}`);
    }
};

module.exports = {
    sendOtp,
    validateOtp
};
