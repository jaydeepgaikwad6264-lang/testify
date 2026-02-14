document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) { window.location.href = 'login.html'; return; }
    const user = getCurrentUser();
    if (!user || user.role !== 'user') { alert('Please login as a customer to book.'); window.location.href = 'index.html'; return; }
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    if(serviceParam) {
        const serviceSelect = document.getElementById('serviceSelect');
        if(serviceSelect) { serviceSelect.value = serviceParam; updatePrice(); }
    }
    initMap();
    loadServices();
});
const SERVICE_NAME_BY_KEY = { 'bp': 'BP Check', 'sugar': 'Sugar Check', 'combo': 'Combo Check' };
let SERVICES = []; let SERVICE_ID_BY_NAME = {};
function updatePrice() {
    const service = document.getElementById('serviceSelect').value;
    const priceDisplay = document.getElementById('priceDisplay');
    const etaDisplay = document.getElementById('etaDisplay');
    const name = SERVICE_NAME_BY_KEY[service];
    const svc = SERVICES.find(s => s.name === name);
    if (svc) { priceDisplay.textContent = `${CONFIG.currency}${svc.price}`; etaDisplay.textContent = `${svc.duration || 15} mins`; }
    else {
        if(service === 'bp') { priceDisplay.textContent = '₹79'; etaDisplay.textContent = '15 mins'; }
        else if (service === 'sugar') { priceDisplay.textContent = '₹79'; etaDisplay.textContent = '15 mins'; }
        else if (service === 'combo') { priceDisplay.textContent = '₹109'; etaDisplay.textContent = '30 mins'; }
        else { priceDisplay.textContent = '-'; etaDisplay.textContent = '-'; }
    }
}
function initMap() {
    const mapContainer = document.getElementById('map');
    const locationInput = document.getElementById('locationInput');
    if (!mapContainer) return;
    loadGoogleMaps(() => {
        try {
            const defaultLat = 28.6139, defaultLng = 77.2090;
            const map = new google.maps.Map(mapContainer, { center: { lat: defaultLat, lng: defaultLng }, zoom: 13 });
            const marker = new google.maps.Marker({ position: { lat: defaultLat, lng: defaultLng }, map, draggable: true });
            const geocoder = new google.maps.Geocoder();
            marker.addListener('dragend', () => {
                const pos = marker.getPosition();
                updateLocationInput(pos.lat(), pos.lng(), geocoder, locationInput);
            });
            if (locationInput) {
                const autocomplete = new google.maps.places.Autocomplete(locationInput, { fields: ['geometry', 'formatted_address', 'address_components'] });
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();
                        map.setCenter({ lat, lng });
                        marker.setPosition({ lat, lng });
                        locationInput.dataset.lat = String(lat);
                        locationInput.dataset.lng = String(lng);
                        locationInput.value = place.formatted_address || locationInput.value;
                        if (place.address_components) {
                            fillAddressFields(place.address_components);
                        }
                    }
                });
            }
            window.__TESTIFY_MAP__ = { map, marker, geocoder };
        } catch (e) {
            console.error('Google Map init failed', e);
            mapContainer.innerHTML = '<div class="d-flex justify-content-center align-items-center h-100 text-muted bg-light"><p>Map failed to load.</p></div>';
        }
    });
}
function detectLocation() {
    const locationInput = document.getElementById('locationInput');
    if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude;
            const ctx = window.__TESTIFY_MAP__;
            if (ctx && ctx.map && ctx.marker) {
                ctx.map.setCenter({ lat, lng }); ctx.map.setZoom(15); ctx.marker.setPosition({ lat, lng });
                updateLocationInput(lat, lng, ctx.geocoder, locationInput);
            } else {
                locationInput.dataset.lat = String(lat); locationInput.dataset.lng = String(lng);
                locationInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                fillAddressFields([]);
            }
            alert('Live location detected.');
        },
        (err) => { console.error('Geolocation error', err); alert('Unable to fetch live location.'); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}
function updateLocationInput(lat, lng, geocoder, locationInput) {
    if (!locationInput) return;
    locationInput.dataset.lat = String(lat); locationInput.dataset.lng = String(lng);
    if (geocoder) {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                locationInput.value = results[0].formatted_address;
                const comps = results[0].address_components || [];
                fillAddressFields(comps);
            } else {
                locationInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }
        });
    } else { locationInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}
function fillAddressFields(components) {
    const byType = (type) => {
        const comp = (components || []).find(c => (c.types || []).includes(type));
        return comp ? comp.long_name : '';
    };
    
    // Extract detailed address components
    const streetNumber = byType('street_number');
    const route = byType('route');
    const premise = byType('premise');
    const sublocality = byType('sublocality_level_1') || byType('sublocality');
    const neighborhood = byType('neighborhood');
    const locality = byType('locality');
    const administrativeArea2 = byType('administrative_area_level_2');
    const administrativeArea1 = byType('administrative_area_level_1');
    const postalCode = byType('postal_code');
    
    // Build house number/address
    let houseNumber = '';
    if (streetNumber) houseNumber += streetNumber + ' ';
    if (route) houseNumber += route;
    if (!houseNumber && premise) houseNumber = premise;
    if (!houseNumber && sublocality) houseNumber = sublocality;
    
    // Build area/landmark
    let area = '';
    if (neighborhood) area = neighborhood;
    else if (sublocality && !houseNumber.includes(sublocality)) area = sublocality;
    
    // Set form fields
    const houseInput = document.getElementById('houseInput');
    const areaInput = document.getElementById('areaInput');
    const cityInput = document.getElementById('cityInput');
    const stateInput = document.getElementById('stateInput');
    const districtInput = document.getElementById('districtInput');
    const pinInput = document.getElementById('pinInput');
    
    if (houseInput) houseInput.value = houseNumber.trim();
    if (areaInput) areaInput.value = area;
    if (cityInput) cityInput.value = locality || administrativeArea2 || '';
    if (stateInput) stateInput.value = administrativeArea1 || '';
    if (districtInput) districtInput.value = administrativeArea2 || locality || '';
    if (pinInput) pinInput.value = postalCode || '';
}
async function loadServices() {
    try {
        const res = await fetch(`${CONFIG.apiBaseUrl}/services`);
        const data = await res.json();
        if (Array.isArray(data)) {
            SERVICES = data; SERVICE_ID_BY_NAME = {};
            SERVICES.forEach(s => { SERVICE_ID_BY_NAME[s.name] = s._id; });
            updatePrice();
        }
    } catch (e) { console.error('Failed to load services', e); }
}
async function createBooking() {
    const customerName = document.getElementById('customerName').value.trim();
    const serviceKey = document.getElementById('serviceSelect').value;
    const location = document.getElementById('locationInput').value;
    const lat = document.getElementById('locationInput').dataset.lat || "28.6139";
    const lng = document.getElementById('locationInput').dataset.lng || "77.2090";
    const house = (document.getElementById('houseInput') && document.getElementById('houseInput').value) || '';
    const area = (document.getElementById('areaInput') && document.getElementById('areaInput').value) || '';
    const city = (document.getElementById('cityInput') && document.getElementById('cityInput').value) || '';
    const state = (document.getElementById('stateInput') && document.getElementById('stateInput').value) || '';
    const district = (document.getElementById('districtInput') && document.getElementById('districtInput').value) || '';
    const pin = (document.getElementById('pinInput') && document.getElementById('pinInput').value) || '';
    const token = localStorage.getItem('token');
    
    if(!customerName) { alert("Please enter your name."); return; }
    if(!serviceKey) { alert("Please select a service."); return; }
    if(!location) { alert("Please select a location."); return; }
    try {
        const serviceName = SERVICE_NAME_BY_KEY[serviceKey];
        let serviceId = SERVICE_ID_BY_NAME[serviceName];
        if (!serviceId) { await loadServices(); serviceId = SERVICE_ID_BY_NAME[serviceName]; }

        const orderResp = await fetch(`${CONFIG.apiBaseUrl}/payment/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                serviceId,
                serviceName,
                location: { address: location, house, area, city, state, district, pin, lat: parseFloat(lat), lng: parseFloat(lng) }
            })
        });
        const orderText = await orderResp.text();
        let orderData = {};
        try { orderData = JSON.parse(orderText); } catch (_) {}
        if (!orderResp.ok) {
            if (orderResp.status === 401) { logout(); return; }
            if (orderResp.status === 403) { throw new Error('Access denied. Login as a customer.'); }
            throw new Error(orderData.message || `Failed to create payment order (${orderResp.status})`);
        }

        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Testify',
            description: serviceName,
            order_id: orderData.orderId,
            prefill: {},
            notes: {
                service_id: serviceId || '',
                service_name: serviceName
            },
            theme: { color: '#0d6efd' },
            handler: async function (response) {
                try {
                    const verifyResp = await fetch(`${CONFIG.apiBaseUrl}/payment/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            serviceId,
                            serviceName,
                            customerName,
                            location: { address: location, house, area, city, state, district, pin, lat: parseFloat(lat), lng: parseFloat(lng) }
                        })
                    });
                    const verifyText = await verifyResp.text();
                    let verifyData = {};
                    try { verifyData = JSON.parse(verifyText); } catch (_) {}
                    if (!verifyResp.ok) {
                        if (verifyResp.status === 401) { logout(); return; }
                        throw new Error(verifyData.message || `Payment verification failed (${verifyResp.status})`);
                    }
                    alert('Booking Confirmed! ID: ' + verifyData._id);
                    window.location.href = 'user-dashboard.html';
                } catch (e) {
                    console.error('Verification error', e);
                    alert('Payment verification failed: ' + e.message);
                }
            }
        };

        if (!window.Razorpay) { throw new Error('Payment library failed to load'); }
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
            console.error('Payment failed', resp.error);
            alert('Payment failed. Please try again.');
        });
        rzp.open();
    } catch (error) { console.error(error); alert('Booking Error: ' + error.message); }
}
