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
    fetchRequests(); fetchActiveJob(); fetchProviderBookings();
    fetchProviderServices();  // Warn the provider if services are empty (so they know why requests might be filtered)
    fetchWallet();            // Populate the header wallet balance on dashboard load
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
        fetchProviderBookings();
        fetchWallet();            // Real-time wallet balance sync every 60s
        updateLiveLocation();
    }, PROVIDER_LOCATION_REFRESH_MS);

    window.addEventListener('focus', () => {
        fetchRequests();
        fetchActiveJob();
        fetchProviderBookings();
        fetchWallet();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            fetchRequests();
            fetchActiveJob();
            fetchProviderBookings();
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
        const balance = Number(w && w.balance ? w.balance : 0);
        const toCurrency = (n) => `${CONFIG.currency}${Number(n||0).toFixed(0)}`;
        // All places wallet balance displays in the UI (header pill + wallet page)
        const formatted = toCurrency(balance);
        const wb = document.getElementById('walletBalance'); if (wb) wb.textContent = formatted;
        const wbh = document.getElementById('walletBalanceHeader'); if (wbh) wbh.textContent = formatted;
        const bp = document.getElementById('walletBp'); if (bp) bp.textContent = String(w.bpCount || 0);
        const sg = document.getElementById('walletSugar'); if (sg) sg.textContent = String(w.sugarCount || 0);
        const cb = document.getElementById('walletCombo'); if (cb) cb.textContent = String(w.comboCount || 0);
    } catch (e) { console.error('Wallet load failed', e); }
}
async function fetchProviderBookings() {
    try {
        const token = localStorage.getItem('token');
        const user = getCurrentUser();
        const response = await fetch(`${CONFIG.apiBaseUrl}/bookings/provider/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!response.ok) return;
        const bookings = await response.json();
        renderProviderBookings(bookings || []);
    } catch (error) {
        console.error('Error fetching provider bookings:', error);
    }
}
// ---------- Shared helpers: booking date + status rendering ----------

// Produce a single pretty string combining scheduledDate + timeSlot.
// scheduledDate may be a Date or ISO string (both parse fine).
function formatBookingWhen(booking) {
    const parts = [];
    if (booking && booking.scheduledDate) {
        const d = new Date(booking.scheduledDate);
        if (!isNaN(d.getTime())) {
            parts.push(d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }));
        } else {
            parts.push(String(booking.scheduledDate));
        }
    }
    if (booking && booking.timeSlot) parts.push(String(booking.timeSlot));
    return parts.join(' · ') || null;
}

function scheduledCardHtml(booking) {
    const when = formatBookingWhen(booking);
    if (!when) return '<div class="small text-muted mt-2"><i class="bi bi-lightning-charge me-1"></i>As soon as possible</div>';
    return `<div class="small text-primary fw-bold mt-2 p-2 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded">
                <i class="bi bi-calendar-event me-1"></i>${when}
            </div>`;
}

function statusBadgeHtml(status) {
    const s = String(status || '').replaceAll('_', ' ');
    switch (status) {
        case 'pending':     return `<span class="badge bg-warning text-dark">${s}</span>`;
        case 'accepted':    return `<span class="badge bg-info text-dark">${s}</span>`;
        case 'on_the_way':  return `<span class="badge bg-primary">${s}</span>`;
        case 'completed':   return `<span class="badge bg-success">${s}</span>`;
        case 'cancelled':   return `<span class="badge bg-danger">${s}</span>`;
        default:            return `<span class="badge bg-secondary">${s}</span>`;
    }
}

function bookingCardHtml(booking) {
    const serviceName = booking.serviceId?.name || 'Service';
    const customerName = booking.userId?.name || 'Customer';
    const customerPhone = booking.userId?.mobileNumber || booking.userId?.phone || '';
    const location = booking.userLocation?.address || 'Delhi';
    const price = booking.price ? `₹${booking.price}` : (booking.serviceId?.price ? `₹${booking.serviceId.price}` : '-');
    const sched = scheduledCardHtml(booking);
    const badge = statusBadgeHtml(booking.status);
    const createdAt = booking.createdAt ? new Date(booking.createdAt).toLocaleString() : '';
    return `<div class="col-12 col-md-6 mb-2"><div class="card border-0 shadow-sm h-100"><div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div><h6 class="fw-bold m-0">${serviceName}</h6><small class="text-muted">${customerName}</small></div>
            ${badge}
        </div>
        <div class="small text-muted"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${location}</div>
        ${customerPhone ? `<div class="small mt-1"><a href="tel:${customerPhone}" class="text-decoration-none"><i class="bi bi-telephone me-1"></i>${customerPhone}</a></div>` : ''}
        ${sched}
        <div class="d-flex justify-content-between align-items-center mt-3">
            <small class="text-muted">${createdAt}</small>
            <span class="fw-bold text-primary">${price}</span>
        </div>
    </div></div></div>`;
}

// ---------- Services-configured warning banner ----------
async function fetchProviderServices() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${CONFIG.apiBaseUrl}/provider/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const profile = await res.json();
        const services = Array.isArray(profile.services) ? profile.services : [];
        const warn = document.getElementById('servicesWarningContainer');
        if (!warn) return;
        if (services.length === 0) {
            warn.innerHTML = `<div class="alert alert-warning d-flex align-items-center mb-4" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <div>You have not selected which services you offer yet. New requests are currently showing the full catalog.
                <a href="provider-profile.html" class="alert-link text-decoration-underline">Choose services in your profile</a> to personalize this dashboard.</div>
            </div>`;
        } else {
            warn.innerHTML = '';
        }
    } catch (_) {}
}

// ---------- Assigned bookings: split into sections by status + scheduled date ----------
function renderProviderBookings(bookings) {
    const container = document.getElementById('providerBookingsContainer');
    const count = document.getElementById('providerBookingsCount');
    if (!container) return;
    const all = Array.isArray(bookings) ? bookings : [];

    if (count) count.textContent = `${all.length} booking${all.length === 1 ? '' : 's'}`;
    if (all.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-4">No bookings assigned yet. Accept a new request above to get started.</div>';
        return;
    }

    // Groups order: Upcoming (accepted with scheduled date OR on_the_way) → Accepted (no date) → Completed/Cancelled
    const upcoming = all.filter(b => b.status === 'on_the_way' || (b.status === 'accepted' && (b.scheduledDate || b.timeSlot)));
    const active   = all.filter(b => b.status === 'accepted' && !(b.scheduledDate || b.timeSlot));
    const done     = all.filter(b => ['completed', 'cancelled'].includes(b.status));

    // scheduled bookings first within each group
    const bySchedule = (a, b) => {
        const aT = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
        const bT = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
        if (aT !== bT) return aT - bT;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    };
    upcoming.sort(bySchedule); active.sort(bySchedule); done.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const sectionHtml = (title, items, clsIcon, empty) => {
        const badge = `<span class="badge rounded-pill bg-secondary ms-2">${items.length}</span>`;
        const body = items.length
            ? `<div class="row g-3 mb-3">${items.map(bookingCardHtml).join('')}</div>`
            : `<div class="text-muted small mb-4">${empty}</div>`;
        return `<div class="mb-4"><h6 class="text-muted m-0 mb-3"><i class="bi ${clsIcon} me-1"></i>${title}${badge}</h6>${body}</div>`;
    };

    container.innerHTML =
        sectionHtml('Upcoming & Scheduled', upcoming, 'bi-calendar3-event-fill',  'No scheduled or on-the-way bookings.') +
        sectionHtml('Accepted (As-Soon-As-Possible)', active,    'bi-check2-circle',   'No accepted bookings waiting for action.') +
        sectionHtml('Completed / Cancelled',         done,      'bi-clock-history',   'No past bookings yet.');
}

// ---------- New Requests: scheduled requests bubble to the top with prominent banner ----------
function renderRequests(requests) {
    const requestContainer = document.getElementById('requestContainer');
    const headerLabel = document.querySelector('#requestsSection h6');
    const list = Array.isArray(requests) ? requests : [];

    // Scheduled first, then newest first for immediate requests
    list.sort((a, b) => {
        const aT = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
        const bT = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
        if (aT !== bT) return aT - bT;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (headerLabel) {
        const scheduled = list.filter(r => r.scheduledDate || r.timeSlot).length;
        headerLabel.textContent = `New Requests (${list.length})` +
            (scheduled > 0 ? ` · ${scheduled} scheduled` : '');
    }

    if (list.length === 0) {
        requestContainer.innerHTML = `<div class="text-center text-muted py-5">
            <i class="bi bi-hourglass-split fs-1"></i>
            <p class="mt-2 mb-0">No new requests right now.</p>
            <small class="text-muted">Bookings appear here within 5 seconds of being placed.</small>
        </div>`;
        return;
    }

    let html = '';
    list.forEach(req => {
        const serviceName = req.serviceId ? req.serviceId.name : 'Unknown Service';
        const price = req.price ? `₹${req.price}` : (req.serviceId ? `₹${req.serviceId.price}` : '-');
        const location = req.userLocation && req.userLocation.address ? req.userLocation.address : 'Delhi';
        const customerName = req.userId && req.userId.name ? req.userId.name : 'Customer';
        const customerPhone = (req.userId && (req.userId.mobileNumber || req.userId.phone)) ? (req.userId.mobileNumber || req.userId.phone) : '';
        const sched = scheduledCardHtml(req);
        const createdTime = req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : '';

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
                        <small class="text-muted d-block mb-1"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${location}</small>
                        <small class="text-muted d-block mb-1"><i class="bi bi-clock me-1"></i>Requested ${createdTime}</small>
                        ${sched}
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
        fetchProviderBookings();
        fetchWallet();            // Real-time update: credit is already on the backend, so fetch immediately
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
        fetchProviderBookings();
        fetchWallet();            // Some cancel flows may deduct/refund; keep the header in sync
    } catch (e) { alert('Error cancelling: ' + e.message); }
}
