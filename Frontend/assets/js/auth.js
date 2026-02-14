async function registerUser(userData) {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || 'Registration failed'); }
        return data;
    } catch (error) { throw error; }
}
async function loginUser(credentials) {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || 'Login failed'); }
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({
            id: data._id, name: data.name, role: data.role, isActive: data.isActive
        }));
        return data;
    } catch (error) { throw error; }
}

async function sendOtp(mobileNumber) {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileNumber })
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || 'Failed to send OTP'); }
        return data;
    } catch (error) { throw error; }
}

async function verifyOtp(otpData) {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(otpData)
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || 'OTP verification failed'); }
        
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify({
                id: data._id, name: data.name, role: data.role, isActive: data.isActive
            }));
        }
        return data;
    } catch (error) { throw error; }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}
function isAuthenticated() { return !!localStorage.getItem('token'); }
function getCurrentUser() { return JSON.parse(localStorage.getItem('user')); }
