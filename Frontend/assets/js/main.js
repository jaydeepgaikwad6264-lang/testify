app.options('*', cors(corsOptions));// Global configuration
// Global configuration
const runtimeConfig = window.__APP_CONFIG__ || {};
const CONFIG = {
    appName: 'Testify',
    allowedCity: 'Delhi',
    currency: '₹',
    apiBaseUrl: runtimeConfig.apiBaseUrl || 'https://testify-backend-vhjp.onrender.com/api',
    googleMapsApiKey: runtimeConfig.googleMapsApiKey || ''
};
(() => {
    const h = window.location.hostname;
    const isPrivate =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '::1' ||
        /^192\.168\./.test(h) ||
        /^10\./.test(h) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h);
    if (isPrivate) {
        CONFIG.apiBaseUrl = `http://${h}:5000/api`;
    }
})();
// Static CONFIG is the source of truth with optional deploy-time overrides
function isLocationInDelhi(lat, lng) { return true; }
function formatCurrency(amount) { return `${CONFIG.currency}${amount}`; }
function getToken() { return localStorage.getItem('token'); }
function showLoading() {
    let el = document.getElementById('globalLoader');
    if (!el) {
        el = document.createElement('div');
        el.id = 'globalLoader';
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.background = 'rgba(0,0,0,0.25)';
        el.style.zIndex = '2000';
        el.innerHTML = '<div class="spinner-border text-primary" role="status" style="width:3rem;height:3rem;"></div>';
        document.body.appendChild(el);
    } else {
        el.style.display = 'flex';
    }
}
function hideLoading() {
    const el = document.getElementById('globalLoader');
    if (el) el.style.display = 'none';
}
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if(item.getAttribute('href') && currentPath.includes(item.getAttribute('href'))) {
            item.classList.add('active');
        }
    });
});
function loadGoogleMaps(callback) {
    if (window.google && window.google.maps) { if (typeof callback === 'function') callback(); return; }
    const existing = document.getElementById('gmaps-script');
    if (existing) { window.__gmaps_init_cb = callback; return; }
    const inject = (key) => {
        const script = document.createElement('script');
        script.id = 'gmaps-script';
        const cbName = '__onGoogleMapsLoaded';
        window[cbName] = function() {
            if (typeof window.__gmaps_init_cb === 'function') {
                window.__gmaps_init_cb();
                window.__gmaps_init_cb = null;
            } else if (typeof callback === 'function') {
                callback();
            }
        };
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${cbName}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    };
    let key = runtimeConfig.googleMapsApiKey || localStorage.getItem('gm_api_key') || CONFIG.googleMapsApiKey || '';
    if (key) {
        inject(key);
    } else {
        fetch(`${CONFIG.apiBaseUrl}/config/maps-key/raw`)
            .then(r => r.json())
            .then(json => {
                key = json.googleMapsApiKey || '';
                if (key) {
                    inject(key);
                } else {
                    console.error('Google Maps API key missing. Set localStorage gm_api_key or CONFIG.googleMapsApiKey.');
                }
            })
            .catch(err => {
                console.error('Failed to fetch maps key', err);
            });
    }
}
function isGoogleMapsReady() { return !!(window.google && window.google.maps); }

// Function to fetch user details by phone number (for cross-user contact)
async function getUserByPhone(phoneNumber) {
    try {
        const token = getToken();
        if (!token) {
            console.error('No authentication token available');
            return null;
        }

        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/user-by-phone/${encodeURIComponent(phoneNumber)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn('User not found with phone number:', phoneNumber);
                return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const userData = await response.json();
        return userData;
    } catch (error) {
        console.error('Error fetching user by phone:', error);
        return null;
    }
}
