const PROVIDER_REQUEST_REFRESH_MS = 5000;
const PROVIDER_LOCATION_REFRESH_MS = 60000;
let __PROVIDER_REQUESTS_TIMER__ = null;
let __PROVIDER_DASHBOARD_SYNC_TIMER__ = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) { window.location.href = 'login.html'; return; }
    const user = getCurrentUser();
    if(!user || user.role !== 'provider') { alert("Access Denied"); window.location.href = 'login.html'; return; }
    if(user.status === 'REJECTED') {
        alert("Your provider account has been rejected. Please contact support.");
        logout();
        return;
    }
    if(user.status !== 'APPROVED' || !user.isActive) {
        alert("Your provider account is under review.");
        window.location.href = 'provider-profile.html';
        return;
    }
    
    // Load provider name
    if (user.name) {
        document.getElementById('providerName').textContent = user.name;
    }
    
    initBell();
    initOnlineToggle();
    fetchRequests(); fetchActiveJob();
    initProviderMap(); 
    setupDashboardAutoRefresh();
});

function setupDashboardAutoRefresh() {
    if (__PROVIDER_REQUESTS_TIMER__) clearInterval(__PROVIDER_REQUESTS_TIMER__);
    if (__PROVIDER_DASHBOARD_SYNC_TIMER__) clearInterval(__PROVIDER_DASHBOARD_SYNC_TIMER__);

    __PROVIDER_REQUESTS_TIMER__ = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        fetchRequests();
    }, PROVIDER_REQUEST_REFRESH_MS);

    __PROVIDER_DASHBOARD_SYNC_TIMER__ = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        fetchActiveJob();
        updateLiveLocation();
    }, PROVIDER_LOCATION_REFRESH_MS);

    window.addEventListener('focus', () => {
        fetchRequests();
        fetchActiveJob();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            fetchRequests();
            fetchActiveJob();
        }
    });
}

async function updateLiveLocation() {
    if (!navigator.geolocation) return;
    
    // Only update if there's an active job
    if (!window.__activeBookingId) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${CONFIG.apiBaseUrl}/location/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ lat: latitude, lng: longitude })
            });
            console.log('Live location updated');
        } catch (e) {
            console.error('Failed to update live location', e);
        }
    }, (err) => {
        console.error('Geolocation error', err);
    });
}

let __lastPendingIds = new Set();
let __isOnline = true;
function initOnlineToggle() {
    const t = document.getElementById('onlineToggle');
    if (!t) { __isOnline = true; return; }
    __isOnline = !!t.checked;
    t.addEventListener('change', () => {
        __isOnline = !!t.checked;
        if (!__isOnline) {
            stopBell();
            document.getElementById('requestContainer').innerHTML = '';
        } else {
            fetchRequests();
        }
    });
}
async function fetchRequests() {
    if (!__isOnline) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${CONFIG.apiBaseUrl}/bookings/pending`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        if(!response.ok) return;
        const requests = await response.json();
        renderRequests(requests);
        const ids = (requests || []).map(r => r._id);
        const hasNew = ids.some(id => !__lastPendingIds.has(id));
        if (hasNew) { triggerBell(); }
        __lastPendingIds = new Set(ids);
    } catch (error) { console.error("Error fetching requests:", error); }
}
async function fetchHistory() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${CONFIG.apiBaseUrl}/provider/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return;
        const bookings = await response.json();
        const c = document.getElementById('historyContainer'); if (!c) return;
        const completed = bookings.filter(b => b.status === 'completed').slice(0, 10);
        if (completed.length === 0) { c.innerHTML = '<div class="text-muted">No completed orders yet</div>'; return; }
        c.innerHTML = completed.map(b => {
            const name = b.serviceId ? b.serviceId.name : 'Service';
            const when = new Date(b.createdAt).toLocaleString();
            const sched = (b.scheduledDate || b.timeSlot) ? `<div class="text-primary small fw-bold">Scheduled: ${b.scheduledDate || ''} ${b.timeSlot || ''}</div>` : '';
            const status = b.status;
            const addr = b.userLocation && b.userLocation.address ? b.userLocation.address : '';
            return `<div class="col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="d-flex justify-content-between mb-2"><div class="fw-bold">${name}</div><span class="badge ${status==='completed'?'bg-success':'bg-secondary'}">${status}</span></div>${sched}<div class="small text-muted">${when}</div><div class="small">${addr}</div></div></div></div>`;
        }).join('');
    } catch (e) { console.error('History load failed', e); }
}
async function fetchWallet() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${CONFIG.apiBaseUrl}/provider/wallet`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const w = await res.json();
        const toCurrency = (n) => `${CONFIG.currency}${Number(n||0).toFixed(0)}`;
        const wb = document.getElementById('walletBalance'); if (wb) wb.textContent = toCurrency(w.balance || 0);
        const bp = document.getElementById('walletBp'); if (bp) bp.textContent = String(w.bpCount || 0);
        const sg = document.getElementById('walletSugar'); if (sg) sg.textContent = String(w.sugarCount || 0);
        const cb = document.getElementById('walletCombo'); if (cb) cb.textContent = String(w.comboCount || 0);
    } catch (e) { console.error('Wallet load failed', e); }
}
function renderRequests(requests) {
    const requestContainer = document.getElementById('requestContainer');
    if (requests.length === 0) { requestContainer.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-hourglass-split fs-1"></i><p>Waiting for bookings...</p></div>'; return; }
    let html = '';
    requests.forEach(req => {
        const serviceName = req.serviceId ? req.serviceId.name : 'Unknown Service';
        const price = req.price ? `₹${req.price}` : (req.serviceId ? `₹${req.serviceId.price}` : '-');
        const location = req.userLocation && req.userLocation.address ? req.userLocation.address : 'Delhi';
        const customerName = req.userId && req.userId.name ? req.userId.name : 'Customer';
        const customerPhone = (req.userId && (req.userId.mobileNumber || req.userId.phone)) ? (req.userId.mobileNumber || req.userId.phone) : '';
        const scheduledInfo = (req.scheduledDate || req.timeSlot) 
            ? `<div class="mt-2 p-2 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded">
                <small class="fw-bold text-dark"><i class="bi bi-calendar-event me-1"></i> Scheduled: ${req.scheduledDate || ''} ${req.timeSlot || ''}</small>
               </div>`
            : '';
        
        html += `
            <div class="card border-0 shadow-sm mb-3 request-card" id="card-${req._id}">
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2">
                        <h6 class="fw-bold m-0">${serviceName}</h6>
                        <span class="text-primary fw-bold">${price}</span>
                    </div>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <strong class="text-dark">${customerName}</strong>
                                ${customerPhone ? `<br><small class="text-muted"><i class="bi bi-telephone me-1"></i><a href="tel:${customerPhone}" class="text-decoration-none">${customerPhone}</a></small>` : ''}
                            </div>
                        </div>
                        <small class="text-muted d-block"><i class="bi bi-geo-alt-fill text-danger"></i> ${location}</small>
                        <small class="text-muted"><i class="bi bi-clock"></i> ${new Date(req.createdAt).toLocaleTimeString()}</small>
                        ${scheduledInfo}
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-danger flex-grow-1" onclick="rejectRequest('${req._id}')">Ignore</button>
                        <button class="btn btn-success flex-grow-1" onclick="acceptRequest('${req._id}')">Accept</button>
                    </div>
                </div>
            </div>
        `;
    });
    requestContainer.innerHTML = html;
}
async function rejectRequest(id) {
    try {
        const token = localStorage.getItem('token');
        await fetch(`${CONFIG.apiBaseUrl}/bookings/ignore/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (_) {}
    const el = document.getElementById(`card-${id}`); if (el) el.remove();
    stopBell();
}
async function acceptRequest(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${CONFIG.apiBaseUrl}/bookings/accept/${id}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.message);
        alert("Booking Accepted!");
        stopBell();
        document.getElementById('requestsSection').classList.add('d-none');
        document.getElementById('activeJobSection').classList.remove('d-none');
        document.getElementById('activeCustomerName').textContent = data.userId?.name || 'Customer';
        document.getElementById('activeCustomerPhone').href = `tel:${data.userId?.mobileNumber}`;
        document.getElementById('activeService').textContent = data.serviceId?.name || 'Service';
        document.getElementById('activeLocation').textContent = data.userLocation?.address || 'Delhi';
        
        const scheduleContainer = document.getElementById('activeScheduleContainer');
        const scheduleText = document.getElementById('activeSchedule');
        if (scheduleContainer && scheduleText) {
            if (data.scheduledDate || data.timeSlot) {
                scheduleContainer.classList.remove('d-none');
                scheduleText.textContent = `${data.scheduledDate || ''} ${data.timeSlot || ''}`;
            } else {
                scheduleContainer.classList.add('d-none');
            }
        }
        
        window.currentJobId = id; localStorage.setItem('currentJobId', id);
        window.__activeBookingId = id;
        renderActiveJobOnMap(data); setupNavigateButton(data);
        updateLiveLocation(); // Update location immediately after accept
        fetchActiveJob();
    } catch (error) { alert("Error accepting booking: " + error.message); }
}
async function fetchActiveJob() {
    try {
        const token = localStorage.getItem('token');
        const user = getCurrentUser();
        const res = await fetch(`${CONFIG.apiBaseUrl}/bookings/provider/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!res.ok) return;
        const bookings = await res.json();
        const active = bookings.find(b => ['accepted', 'on_the_way'].includes(b.status));
        if (active) {
            window.__activeBookingId = active._id;
            document.getElementById('requestsSection').classList.add('d-none');
            document.getElementById('activeJobSection').classList.remove('d-none');
            
            const customerName = active.userId?.name || 'Customer';
            const customerPhone = active.userId?.phone || active.userId?.mobileNumber || '';
            
            document.getElementById('activeCustomerName').textContent = customerName;
            document.getElementById('activeService').textContent = active.serviceId?.name || 'Service';
            document.getElementById('activeLocation').textContent = active.userLocation?.address || 'Delhi';
            
            const scheduleContainer = document.getElementById('activeScheduleContainer');
            const scheduleText = document.getElementById('activeSchedule');
            if (scheduleContainer && scheduleText) {
                if (active.scheduledDate || active.timeSlot) {
                    scheduleContainer.classList.remove('d-none');
                    scheduleText.textContent = `${active.scheduledDate || ''} ${active.timeSlot || ''}`;
                } else {
                    scheduleContainer.classList.add('d-none');
                }
            }
            
            // Update phone link
            const phoneLink = document.getElementById('activeCustomerPhone');
            if (phoneLink) {
                if (customerPhone) {
                    phoneLink.href = `tel:${customerPhone}`;
                    phoneLink.textContent = `Call ${customerPhone}`;
                    phoneLink.style.display = 'block';
                } else {
                    phoneLink.style.display = 'none';
                }
            }
            
            window.currentJobId = active._id; localStorage.setItem('currentJobId', active._id);
            renderActiveJobOnMap(active); setupNavigateButton(active);
            startProviderLiveLocation(active._id);
        } else {
            if (__PROVIDER_LOC_TIMER__) { clearInterval(__PROVIDER_LOC_TIMER__); __PROVIDER_LOC_TIMER__ = null; }
            window.__activeBookingId = null;
            document.getElementById('requestsSection').classList.remove('d-none');
            document.getElementById('activeJobSection').classList.add('d-none');
        }
    } catch (e) { console.error('Failed to fetch active job', e); }
}
let __PROVIDER_MAP__ = null;
let __PROVIDER_LOC_TIMER__ = null;
function initProviderMap() {
    const el = document.getElementById('providerMap');
    if (!el) return;
    loadGoogleMaps(() => {
        const map = new google.maps.Map(el, { center: { lat: 28.6139, lng: 77.2090 }, zoom: 12 });
        const userMarker = new google.maps.Marker({ position: { lat: 28.6139, lng: 77.2090 }, map, label: 'User' });
        const providerMarker = new google.maps.Marker({ position: { lat: 28.6139, lng: 77.2090 }, map, label: 'You' });
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({ map });
        __PROVIDER_MAP__ = { map, userMarker, providerMarker, directionsService, directionsRenderer };
    });
}
// Bell alert
let __bellInterval = null;
let __bellCtx = null;
let __bellStopTimer = null;
let __audioUnlocked = false;
function initBell() {
    const unlock = () => {
        try {
            if (!__bellCtx) {
                __bellCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (__bellCtx.state === 'suspended') {
                __bellCtx.resume().catch(() => {});
            }
            __audioUnlocked = true;
        } catch (_) {}
    };
    ['touchstart','click'].forEach(ev => {
        window.addEventListener(ev, unlock, { once: true, passive: true });
    });
    const t = document.getElementById('onlineToggle');
    if (t) {
        t.addEventListener('change', unlock, { once: true });
    }
}
function triggerBell() {
    if (__bellInterval) return;
    try {
        if (!__bellCtx) {
            __bellCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (__bellCtx.state === 'suspended') {
            // iOS requires a resume after user gesture; attempt resume
            __bellCtx.resume().catch(() => {});
        }
        let step = 0;
        const playBurst = () => {
            const baseFreqs = [784, 988, 1175];
            for (let i = 0; i < baseFreqs.length; i++) {
                const o = __bellCtx.createOscillator();
                const g = __bellCtx.createGain();
                o.type = 'triangle';
                o.frequency.value = baseFreqs[i] + (step % 3) * 20;
                g.gain.value = 0.15;
                o.connect(g); g.connect(__bellCtx.destination);
                o.start();
                setTimeout(() => { o.stop(); }, 600);
            }
            step++;
            if (navigator.vibrate) {
                try { navigator.vibrate(200); } catch (_) {}
            }
        };
        __bellInterval = setInterval(playBurst, 1800);
        if (__bellStopTimer) clearTimeout(__bellStopTimer);
        __bellStopTimer = setTimeout(() => { stopBell(); }, 5 * 60 * 1000);
    } catch (e) { console.error('Bell init failed', e); }
}
function stopBell() {
    if (__bellInterval) { clearInterval(__bellInterval); __bellInterval = null; }
    if (__bellCtx) { try { __bellCtx.close(); } catch (_) {} __bellCtx = null; }
    if (__bellStopTimer) { clearTimeout(__bellStopTimer); __bellStopTimer = null; }
}
function renderActiveJobOnMap(booking) {
    const ctx = __PROVIDER_MAP__; if (!ctx) return;
    const uLat = booking.userLocation?.lat ?? 28.6139; const uLng = booking.userLocation?.lng ?? 77.2090;
    const pLat = booking.providerLocation?.lat ?? 28.6139; const pLng = booking.providerLocation?.lng ?? 77.2090;
    ctx.userMarker.setPosition({ lat: uLat, lng: uLng }); ctx.providerMarker.setPosition({ lat: pLat, lng: pLng });
    const bounds = new google.maps.LatLngBounds(); bounds.extend({ lat: uLat, lng: uLng }); bounds.extend({ lat: pLat, lng: pLng }); ctx.map.fitBounds(bounds);
    ctx.directionsService.route({
        origin: { lat: pLat, lng: pLng }, destination: { lat: uLat, lng: uLng }, travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => { if (status === 'OK') { ctx.directionsRenderer.setDirections(result); } });
}
async function setupNavigateButton(booking) {
    const btn = document.getElementById('navigateBtn'); if (!btn) return;
    btn.onclick = async () => {
        let pLat = booking.providerLocation?.lat ?? null; let pLng = booking.providerLocation?.lng ?? null;
        if (navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) => { navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 }); });
                pLat = pos.coords.latitude; pLng = pos.coords.longitude;
                const ctx = __PROVIDER_MAP__; if (ctx) ctx.providerMarker.setPosition({ lat: pLat, lng: pLng });
            } catch (_) {}
        }
        const uLat = booking.userLocation?.lat ?? 28.6139; const uLng = booking.userLocation?.lng ?? 77.2090;
        const ctx = __PROVIDER_MAP__;
        if (ctx && pLat != null && pLng != null) {
            ctx.directionsService.route({
                origin: { lat: pLat, lng: pLng }, destination: { lat: uLat, lng: uLng }, travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => { if (status === 'OK') ctx.directionsRenderer.setDirections(result); });
        } else {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(uLat + ',' + uLng)}&travelmode=driving`;
            window.open(url, '_blank');
        }
    };
}
function startProviderLiveLocation(bookingId) {
    if (__PROVIDER_LOC_TIMER__) { clearInterval(__PROVIDER_LOC_TIMER__); __PROVIDER_LOC_TIMER__ = null; }
    if (!navigator.geolocation) return;
    __PROVIDER_LOC_TIMER__ = setInterval(async () => {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 });
            });
            const lat = pos.coords.latitude, lng = pos.coords.longitude;
            const token = localStorage.getItem('token');
            await fetch(`${CONFIG.apiBaseUrl}/bookings/provider/location`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lat, lng, bookingId })
            });
            // update local map quickly
            const ctx = __PROVIDER_MAP__;
            if (ctx) {
                ctx.providerMarker.setPosition({ lat, lng });
            }
        } catch (_) {}
    }, 1000);
}
async function completeJob() {
    const fileInput = document.getElementById('reportUpload');
    if(fileInput.files.length === 0) { alert("Please upload the medical readings first."); return; }
    if(fileInput.files.length > 2) { alert("You can upload maximum 2 files."); return; }
    
    const formData = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('report', fileInput.files[i]);
    }
    
    const bookingId = window.currentJobId || localStorage.getItem('currentJobId'); 
    if (!bookingId) { alert("No active booking found."); return; }
    
    try {
        const token = localStorage.getItem('token');
        const uploadRes = await fetch(`${CONFIG.apiBaseUrl}/report/upload/${bookingId}`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` }, 
            body: formData 
        });
        const uploadData = await uploadRes.json(); 
        if(!uploadRes.ok) throw new Error(uploadData.message);
        
        const completeRes = await fetch(`${CONFIG.apiBaseUrl}/bookings/complete/${bookingId}`, { 
            method: 'PUT', 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const completeData = await completeRes.json(); 
        if (!completeRes.ok) throw new Error(completeData.message || 'Failed to mark completed');
        
        alert("Job Completed & Readings Sent!"); 
        localStorage.removeItem('currentJobId');
        window.__activeBookingId = null;
        document.getElementById('activeJobSection').classList.add('d-none');
        document.getElementById('requestsSection').classList.remove('d-none');
        fetchRequests();
        fetchActiveJob();
    } catch (error) { alert("Error completing job: " + error.message); }
}
async function cancelJob() {
    const bookingId = window.currentJobId || localStorage.getItem('currentJobId'); if (!bookingId) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${CONFIG.apiBaseUrl}/bookings/cancel/${bookingId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Failed to cancel');
        alert('Service cancelled.'); localStorage.removeItem('currentJobId');
        window.__activeBookingId = null;
        document.getElementById('activeJobSection').classList.add('d-none');
        document.getElementById('requestsSection').classList.remove('d-none');
        fetchRequests();
        fetchActiveJob();
    } catch (e) { alert('Error cancelling: ' + e.message); }
}
