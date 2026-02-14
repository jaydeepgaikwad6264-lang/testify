document.addEventListener('DOMContentLoaded', async () => {
  if (!isAuthenticated()) { window.location.href = 'login.html'; return; }
  const user = getCurrentUser();
  if (user.role !== 'provider') { window.location.href = 'index.html'; return; }
  await fetchWallet();
  await fetchHistory();
});

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
  } catch (_) {}
}

async function fetchHistory() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${CONFIG.apiBaseUrl}/provider/history`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) return;
    const bookings = await response.json();
    const c = document.getElementById('historyContainer'); if (!c) return;
    const completed = bookings.filter(b => b.status === 'completed').slice(0, 15);
    if (completed.length === 0) { c.innerHTML = '<div class="text-muted">No completed orders yet</div>'; return; }
    c.innerHTML = completed.map(b => {
      const name = b.serviceId ? b.serviceId.name : 'Service';
      const when = new Date(b.createdAt).toLocaleString();
      const addr = b.userLocation && b.userLocation.address ? b.userLocation.address : '';
      return `<div class="col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="d-flex justify-content-between mb-2"><div class="fw-bold">${name}</div><span class="badge bg-success">completed</span></div><div class="small text-muted">${when}</div><div class="small">${addr}</div></div></div></div>`;
    }).join('');
  } catch (_) {}
}
