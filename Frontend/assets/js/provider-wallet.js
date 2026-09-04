// Provider Wallet JavaScript

let walletData = null;

// Initialize wallet page
document.addEventListener('DOMContentLoaded', function() {
    if (!getCurrentUser() || getCurrentUser().role !== 'provider') {
        alert('Please login as a provider to access this page');
        window.location.href = 'login.html';
        return;
    }
    loadWalletData();
});

// Load wallet data from backend
async function loadWalletData() {
    try {
        const token = getToken();
        if (!token) {
            alert('Please login to access your wallet');
            window.location.href = 'login.html';
            return;
        }

        showLoading();
        const response = await fetch(`${CONFIG.apiBaseUrl}/provider/wallet`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load wallet data');
        }

        walletData = await response.json();
        displayWalletData(walletData);
        
    } catch (error) {
        console.error('Error loading wallet:', error);
        showError('Failed to load wallet data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Display wallet data
function displayWalletData(data) {
    // Update balance
    document.getElementById('walletBalance').textContent = `₹${data.balance.toLocaleString('en-IN')}`;
    
    // Update service statistics
    document.getElementById('bpCount').textContent = data.bpCount || 0;
    document.getElementById('sugarCount').textContent = data.sugarCount || 0;
    document.getElementById('comboCount').textContent = data.comboCount || 0;
    
    // Display transactions
    displayTransactions(data.transactions);
}

// Display transaction history
function displayTransactions(transactions) {
    const container = document.getElementById('transactionsContainer');
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <h6 class="mb-2">No transactions yet</h6>
                <p class="mb-0">Complete your first booking to see earnings here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(transaction => {
        const isPositive = transaction.amount > 0;
        const date = new Date(transaction.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        return `
            <div class="transaction-item ${isPositive ? '' : 'negative'}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 fw-bold">${transaction.serviceName || 'Service'}</h6>
                        <small class="text-muted">${date}</small>
                    </div>
                    <div class="text-end">
                        <h6 class="mb-1 fw-bold ${isPositive ? 'text-success' : 'text-danger'}">
                            ${isPositive ? '+' : ''}₹${Math.abs(transaction.amount).toLocaleString('en-IN')}
                        </h6>
                        <small class="text-muted">${transaction.bookingId ? 'Booking #' + transaction.bookingId.toString().slice(-6) : ''}</small>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show loading state
function showLoading() {
    document.getElementById('walletBalance').innerHTML = '<div class="spinner-border spinner-border-sm text-light" role="status"></div>';
}

// Hide loading state
function hideLoading() {
    // Balance will be updated by displayWalletData
}

// Show error message
function showError(message) {
    const container = document.getElementById('transactionsContainer');
    container.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

// Initiate withdrawal
function initiateWithdrawal() {
    if (!walletData || walletData.balance <= 0) {
        alert('Insufficient balance for withdrawal');
        return;
    }

    // For now, show a professional message
    // In production, this would integrate with a payment gateway
    alert('Withdrawal feature coming soon! Please contact support for manual withdrawal requests.');
    
    // In a real implementation, you would:
    // 1. Show a withdrawal form
    // 2. Validate bank details
    // 3. Process withdrawal through payment gateway
    // 4. Update wallet balance
    // 5. Create transaction record
}

// Refresh wallet data periodically
setInterval(() => {
    if (document.hidden === false) { // Only refresh when page is visible
        loadWalletData();
    }
}, 30000); // Refresh every 30 seconds

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadWalletData(); // Refresh when user returns to this tab
    }
});