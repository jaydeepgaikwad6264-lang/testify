document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) { window.location.href = 'login.html'; return; }
    const user = getCurrentUser();
    document.getElementById('userNameDisplay').textContent = user.name || 'User';
    loadBookings();
});
async function loadBookings() {
    try {
        const token = localStorage.getItem('token');
        const user = getCurrentUser();
        const response = await fetch(`${CONFIG.apiBaseUrl}/bookings/user/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const bookings = await response.json();
        renderBookings(bookings);
    } catch (error) {
        console.error("Error loading bookings:", error);
        document.getElementById('activeBookingContainer').innerHTML = '<div class="alert alert-danger">Failed to load bookings.</div>';
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
                    <div class="mt-3">
                        <div id="userMap" class="map-container shadow-sm border"></div>
                    </div>
                </div>
            </div>
        `;
        activeBookingContainer.innerHTML = activeHTML;
        initUserMap();
        renderActiveBookingOnMap(activeBooking);
        startUserLivePoll();
    } else {
        activeBookingContainer.innerHTML = '<div class="text-center text-muted py-5">No active bookings. <a href="booking.html">Book Now</a></div>';
    }
    let pastHTML = '';
    pastBookings.forEach(booking => {
        const serviceName = booking.serviceId ? booking.serviceId.name : 'Unknown Service';
        const price = booking.serviceId ? `₹${booking.serviceId.price}` : '-';
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
                ${(booking.reportPdfUrl || booking.reportUrl) ? `
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
let __USER_MAP__ = null;
let __USER_ACTIVE_POLL__ = null;
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
            const token = localStorage.getItem('token');
            const res = await fetch(`${CONFIG.apiBaseUrl}/bookings/user/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;
            const booking = await res.json();
            if (!booking) return;
            // Update call button to provider number if available
            const container = document.getElementById('activeBookingContainer');
            if (container && booking.providerId?.mobileNumber) {
                const btns = container.querySelectorAll('a[href^="tel:"]');
                if (btns.length === 0) {
                    // Re-render to ensure call button present
                    loadBookings();
                }
            }
            renderActiveBookingOnMap(booking);
        } catch (_) {}
    }, 1000);
}
