const axios = require('axios');

const BASE_URL = 'https://cpaas.messagecentral.com/verification/v3';

const sendOtp = async (mobileNumber) => {
    try {
        const response = await axios.post(`${BASE_URL}/send`, null, { // No body data
            params: {
                countryCode: '91',
                customerId: process.env.MESSAGECENTRAL_CUSTOMER_ID,
                flowType: 'SMS',
                mobileNumber: mobileNumber
            },
            headers: {
                'authToken': process.env.MESSAGECENTRAL_AUTH_TOKEN
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error sending OTP:', error.response?.data || error.message);
        throw new Error('Failed to send OTP');
    }
};

const validateOtp = async (verificationId, code, mobileNumber) => {
    try {
        const response = await axios.get(`${BASE_URL}/validateOtp`, {
            params: {
                verificationId,
                code,
                countryCode: '91',
                mobileNumber,
                customerId: process.env.MESSAGECENTRAL_CUSTOMER_ID
            },
            headers: {
                'authToken': process.env.MESSAGECENTRAL_AUTH_TOKEN
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error validating OTP:', error.response?.data || error.message);
        throw new Error('Failed to validate OTP');
    }
};

module.exports = {
    sendOtp,
    validateOtp
};
