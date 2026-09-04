const USER_REFRESH_INTERVAL_MS = 5000;
let __USER_MAP__ = null;
let __USER_ACTIVE_POLL__ = null;
let __lastBookingSnapshot = '';
let __isRefreshingBookings = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) { window.location.href = 'login.html'; return; }
    const user = getCurrentUser();
    document.getElementById('userNameDisplay').textContent = user.name || 'User';
    refreshBookings({ forceRender: true });
    startUserLivePoll();
    window.addEventListener('focus', () => refreshBookings({ forceRender: true }));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshBookings({ forceRender: true });
        }
    });
});

async function loadBookings() {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();
    const response = await fetch(`${CONFIG.apiBaseUrl}/bookings/user/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
    });
    if (!response.ok) {
        if (response.status === 401) { logout(); return []; }
        throw new Error(`Failed to load bookings (${response.status})`);
    }
    return response.json();
}

async function refreshBookings(options = {}) {
    const { forceRender = false } = options;
    if (__isRefreshingBookings) return;
    __isRefreshingBookings = true;
    try {
        const bookings = await loadBookings();
        const snapshot = JSON.stringify((bookings || []).map(b => ({
            id: b._id,
            status: b.status,
            providerId: b.providerId?._id || b.providerId || null,
            providerPhone: b.providerId?.mobileNumber || b.providerId?.phone || '',
            providerName: b.providerId?.name || '',
            providerLat: b.providerLocation?.lat ?? null,
            providerLng: b.providerLocation?.lng ?? null,
            updatedAt: b.updatedAt || b.createdAt
        })));
        if (forceRender || snapshot !== __lastBookingSnapshot) {
            __lastBookingSnapshot = snapshot;
            renderBookings(bookings || []);
        }
    } catch (error) {
        console.error("Error loading bookings:", error);
        document.getElementById('activeBookingContainer').innerHTML = '<div class="alert alert-danger">Failed to load bookings.</div>';
    } finally {
        __isRefreshingBookings = false;
    }
}

function updateProviderLocationOnMap(location) {
    if (__USER_MAP__ && __USER_MAP__.providerMarker) {
        __USER_MAP__.providerMarker.setPosition(new google.maps.LatLng(location.lat, location.lng));
    } else if (__USER_MAP__ && __USER_MAP__.map) {
        __USER_MAP__.providerMarker = new google.maps.Marker({
            position: new google.maps.LatLng(location.lat, location.lng),
            map: __USER_MAP__.map,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new google.maps.Size(40, 40)
            },
            title: 'Provider'
        });
    }
}

function renderBookings(bookings) {
    const activeBookingContainer = document.getElementById('activeBookingContainer');
    const pastBookingsList = document.getElementById('pastBookingsList');
    if (bookings.length === 0) {
        activeBookingContainer.innerHTML = '<div class="text-center text-muted py-5">No active bookings.</div>';
        pastBookingsList.innerHTML = '<div class="text-center text-muted py-3">No booking history.</div>';
        return;
    }
    const activeBookings = bookings.filter(b => ['pending', 'accepted', 'on_the_way'].includes(b.status));
    const pastBookings = bookings.filter(b => ['completed', 'cancelled'].includes(b.status));
    if (activeBookings.length > 0) {
        const activeBooking = activeBookings[0];
        const serviceName = activeBooking.serviceId ? activeBooking.serviceId.name : 'Unknown Service';
        const providerName = activeBooking.providerId ? activeBooking.providerId.name : 'Searching Provider...';
        const providerPhone = (activeBooking.providerId && (activeBooking.providerId.mobileNumber || activeBooking.providerId.phone)) ? (activeBooking.providerId.mobileNumber || activeBooking.providerId.phone) : '';
        const scheduledInfo = (activeBooking.scheduledDate || activeBooking.timeSlot)
            ? `<div class="alert alert-light border mt-3 mb-0">
                    <div class="fw-bold"><i class="bi bi-calendar-event me-1"></i> Scheduled Booking</div>
                    <small class="text-muted">${activeBooking.scheduledDate || 'Flexible date'} ${activeBooking.timeSlot || 'Any time'}</small>
               </div>`
            : '';
        const activeHTML = `
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title m-0 fw-bold">Current Booking</h5>
                        <span class="badge bg-primary">${serviceName}</span>
                    </div>
                    <div class="booking-status-timeline">
                        <div class="timeline-item ${activeBooking.status === 'pending' ? 'active fw-bold text-primary' : ''}">Searching</div>
                        <div class="timeline-item ${activeBooking.status === 'accepted' ? 'active fw-bold text-primary' : ''}">Accepted</div>
                        <div class="timeline-item ${activeBooking.status === 'on_the_way' ? 'active fw-bold text-primary' : ''}">On the Way</div>
                    </div>
                    <div class="provider-info bg-light p-3 rounded-3 d-flex align-items-center mt-3">
                        <div class="bg-white rounded-circle p-2 me-3 border">
                            <i class="bi bi-person-fill fs-3 text-secondary"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="m-0 fw-bold">${providerName}</h6>
                            <small class="text-muted">${activeBooking.providerId ? 'Independent service provider' : 'Waiting for acceptance...'}</small>
                        </div>
                        ${providerPhone ? `<a href="tel:${providerPhone}" class="btn btn-success rounded-circle btn-sm p-2"><i class="bi bi-telephone-fill"></i></a>` : ''}
                    </div>
                    ${scheduledInfo}
                    <div class="mt-3">
                        <div id="userMap" class="map-container shadow-sm border"></div>
                    </div>
                </div>
            </div>
        `;
        activeBookingContainer.innerHTML = activeHTML;
        initUserMap();
        renderActiveBookingOnMap(activeBooking);
    } else {
        activeBookingContainer.innerHTML = '<div class="text-center text-muted py-5">No active bookings. <a href="booking.html">Book Now</a></div>';
    }
    let pastHTML = '';
    pastBookings.forEach(booking => {
        const serviceName = booking.serviceId ? booking.serviceId.name : 'Unknown Service';
        const price = booking.price ? `₹${booking.price}` : (booking.serviceId ? `₹${booking.serviceId.price}` : '-');
        const scheduledInfo = (booking.scheduledDate || booking.timeSlot)
            ? `<div class="small text-primary fw-bold mt-1"><i class="bi bi-calendar-event me-1"></i>${booking.scheduledDate || 'Flexible date'} ${booking.timeSlot || 'Any time'}</div>`
            : '';
        pastHTML += `
            <div class="list-group-item border-0 border-bottom py-3">
                <div class="d-flex justify-content-between">
                    <div>
                        <h6 class="mb-1 fw-bold">${serviceName}</h6>
                        <small class="text-muted">${new Date(booking.createdAt).toLocaleDateString()}</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">${price}</div>
                        <span class="badge bg-success bg-opacity-10 text-success">${booking.status}</span>
                    </div>
                </div>
                ${scheduledInfo}
                ${(booking.reportUrls && booking.reportUrls.length > 0) ? 
                    booking.reportUrls.map((url, index) => `
                        <button class="btn btn-sm btn-outline-secondary mt-2 me-2" onclick="downloadReport('${url}')">
                            <i class="bi bi-file-earmark"></i> Readings ${index + 1}
                        </button>
                    `).join('') : (booking.reportPdfUrl || booking.reportUrl) ? `
                    <button class="btn btn-sm btn-outline-secondary mt-2" onclick="downloadReport('${booking.reportPdfUrl || booking.reportUrl}')">
                        <i class="bi bi-file-earmark-pdf"></i> Download Readings PDF
                    </button>` : ''}
            </div>
        `;
    });
    if(pastBookings.length === 0) {
        pastBookingsList.innerHTML = '<div class="text-center text-muted py-3">No booking history.</div>';
    } else {
        pastBookingsList.innerHTML = pastHTML;
    }
}
function downloadReport(url) {
    const base = CONFIG.apiBaseUrl.replace(/\/api$/, '');
    const u = (url || '').trim();
    const normalized = u.replace(/^\/+/, '/');
    const abs = /^https?:\/\//i.test(normalized) ? normalized : `${base}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
    window.open(abs, '_blank');
}
function initUserMap() {
    const el = document.getElementById('userMap');
    if (!el) return;
    loadGoogleMaps(() => {
        const map = new google.maps.Map(el, { center: { lat: 28.6139, lng: 77.2090 }, zoom: 12 });
        const userMarker = new google.maps.Marker({ position: { lat: 28.6139, lng: 77.2090 }, map, label: 'You' });
        const providerMarker = new google.maps.Marker({ position: { lat: 28.6139, lng: 77.2090 }, map, label: 'Provider' });
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({ map });
        __USER_MAP__ = { map, userMarker, providerMarker, directionsService, directionsRenderer };
    });
}
function renderActiveBookingOnMap(booking) {
    const ctx = __USER_MAP__;
    if (!ctx) return;
    const uLat = booking.userLocation?.lat ?? 28.6139;
    const uLng = booking.userLocation?.lng ?? 77.2090;
    ctx.userMarker.setPosition({ lat: uLat, lng: uLng });
    const pLat = booking.providerLocation?.lat ?? null;
    const pLng = booking.providerLocation?.lng ?? null;
    if (pLat != null && pLng != null) {
        ctx.providerMarker.setPosition({ lat: pLat, lng: pLng });
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: uLat, lng: uLng });
        bounds.extend({ lat: pLat, lng: pLng });
        ctx.map.fitBounds(bounds);
        ctx.directionsService.route({
            origin: { lat: pLat, lng: pLng },
            destination: { lat: uLat, lng: uLng },
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK') { ctx.directionsRenderer.setDirections(result); }
        });
    } else {
        ctx.map.setCenter({ lat: uLat, lng: uLng });
        ctx.map.setZoom(14);
    }
}
function startUserLivePoll() {
    if (__USER_ACTIVE_POLL__) clearInterval(__USER_ACTIVE_POLL__);
    __USER_ACTIVE_POLL__ = setInterval(async () => {
        try {
            if (document.visibilityState !== 'visible') return;
            await refreshBookings();
            const token = localStorage.getItem('token');
            const res = await fetch(`${CONFIG.apiBaseUrl}/bookings/user/active`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            });
            if (!res.ok) return;
            const booking = await res.json();
            if (!booking) return;
            renderActiveBookingOnMap(booking);
        } catch (_) {}
    }, USER_REFRESH_INTERVAL_MS);
}
