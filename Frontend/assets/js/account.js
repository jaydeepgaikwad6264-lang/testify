document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    const user = getCurrentUser();
    if (!user) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    // Load user data
    loadUserData().then(() => {
        // Only load booking stats after profile loads successfully
        loadBookingStats();
    }).catch(error => {
        // Profile loading error is already handled in loadUserData
    });
    
    // Handle form submission
    document.getElementById('accountForm').addEventListener('submit', handleAccountUpdate);
});

async function loadUserData() {
    try {
        const token = getToken();
        if (!token) {
            showError('Authentication required. Please log in again.');
            setTimeout(() => logout(), 2000);
            return null;
        }

        showLoading();
        
        // Fetch complete user data from backend using phone number
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load profile data');
        }

        const userData = await response.json();
        console.log('Profile data received:', userData); // Debug log
        
        // Update localStorage with fresh data
        const updatedUser = {
            id: userData._id,
            name: userData.name,
            email: userData.email,
            phone: userData.phone || userData.mobileNumber,
            mobileNumber: userData.mobileNumber || userData.phone,
            role: userData.role,
            isActive: userData.isActive,
            status: userData.status
        };
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Ensure we have phone number from either field
        const phoneNumber = userData.phone || userData.mobileNumber || '';
        const email = userData.email || '';
        
        const profileData = {
            _id: userData._id,
            name: userData.name,
            role: userData.role,
            status: userData.role === 'provider' ? (userData.isActive ? 'APPROVED' : 'PENDING') : 'ACTIVE',
            isActive: userData.isActive,
            email: email,
            mobileNumber: phoneNumber
        };
        
        populateProfileData(profileData);
        return profileData;
        
    } catch (error) {
        console.error('Error loading profile:', error);
        let errorMessage = 'Failed to load profile data. ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Please check your internet connection.';
        } else if (error.message.includes('401')) {
            errorMessage += 'Please login again.';
            setTimeout(() => logout(), 2000);
        } else {
            errorMessage += 'Please try again.';
        }
        
        showError(errorMessage);
        return null;
    } finally {
        hideLoading();
    }
}

function populateProfileData(data) {
    // Update user info display
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    const nameInputEl = document.getElementById('nameInput');
    const emailInputEl = document.getElementById('emailInput');
    const mobileInputEl = document.getElementById('mobileInput');
    
    // Ensure we have valid data
    const name = data.name || 'User';
    const email = data.email || '';
    const mobileNumber = data.mobileNumber || '';
    
    if (userNameEl) userNameEl.textContent = name;
    if (userRoleEl) userRoleEl.textContent = data.role === 'provider' ? 'Service Provider' : 'Customer';
    if (nameInputEl) nameInputEl.value = name;
    if (emailInputEl) emailInputEl.value = email;
    if (mobileInputEl) mobileInputEl.value = mobileNumber;
    
    // Update status badge
    updateStatusBadge(data.role, data.status);
}

function updateStatusBadge(role, status) {
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (!statusBadge || !statusText) return;
    
    if (role === 'provider') {
        if (status === 'PENDING') {
            statusBadge.className = 'badge bg-warning';
            statusBadge.textContent = 'Pending Approval';
            statusText.textContent = 'Your provider account is under review';
        } else if (status === 'APPROVED') {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'Approved';
            statusText.textContent = 'Your provider account is active';
        } else {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'Inactive';
            statusText.textContent = 'Your provider account is inactive';
        }
    } else {
        statusBadge.className = 'badge bg-success';
        statusBadge.textContent = 'Active';
        
        // Check if profile is incomplete (empty email/mobile indicates OTP user)
        const emailInputEl = document.getElementById('emailInput');
        const mobileInputEl = document.getElementById('mobileInput');
        const hasEmptyFields = !emailInputEl?.value || !mobileInputEl?.value;
        
        statusText.textContent = hasEmptyFields ? 'Please complete your profile details below' : 'Account is active';
    }
}

async function loadBookingStats() {
    try {
        const token = localStorage.getItem('token');
        const user = getCurrentUser();
        
        if (!token || !user) {
            return; // Silently skip if no auth data
        }
        
        let endpoint = user.role === 'provider' 
            ? `${CONFIG.apiBaseUrl}/bookings/provider/stats`
            : `${CONFIG.apiBaseUrl}/bookings/user/stats`;
            
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return; // Silently skip stats on error
        }
        
        const stats = await response.json();
        
        // Update UI elements if they exist
        const bookingCountEl = document.getElementById('bookingCount');
        const completedCountEl = document.getElementById('completedCount');
        
        if (bookingCountEl) bookingCountEl.textContent = stats.totalBookings || 0;
        if (completedCountEl) completedCountEl.textContent = stats.completedBookings || 0;
        
    } catch (error) {
        // Silently skip stats loading errors
    }
}

async function handleAccountUpdate(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Updating...';
        submitBtn.disabled = true;
        
        const token = localStorage.getItem('token');
        const name = document.getElementById('nameInput').value.trim();
        const email = document.getElementById('emailInput').value.trim();
        
        if (!name) {
            showError('Please enter your name.');
            return;
        }
        
        if (email && !isValidEmail(email)) {
            showError('Please enter a valid email address.');
            return;
        }
        
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                showError('Session expired. Please log in again.');
                setTimeout(() => logout(), 2000);
            } else {
                showError('Unable to update profile. Please try again.');
            }
            return;
        }
        
        const updatedData = await response.json();
        showSuccess('Profile updated successfully!');
        // Reload profile from backend to ensure form reflects MongoDB
        await loadUserData();
        
    } catch (error) {
        showError('Network error. Please check your connection and try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message) {
    showToast(message, 'danger');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showToast(message, type = 'info') {
    // Create toast if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '11';
        document.body.appendChild(toastContainer);
    }
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type === 'danger' ? 'danger' : 'success'} text-white">
                <i class="bi ${type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'} me-2"></i>
                <strong class="me-auto">${type === 'danger' ? 'Error' : 'Success'}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toast = new bootstrap.Toast(document.getElementById(toastId));
    toast.show();
    
    // Remove toast element after it's hidden
    document.getElementById(toastId).addEventListener('hidden.bs.toast', function() {
        this.remove();
    });
}
