async function fetchJSON(url, token) {
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const text = await res.text(); let data = {};
  try { data = JSON.parse(text); } catch (_) {}
  if (!res.ok) throw new Error(data.message || `Failed: ${res.status}`);
  return data;
}

function renderTable(containerId, headers, rows) {
  const container = document.getElementById(containerId);
  const thead = `<thead><tr>${headers.map(h => `<th class="text-nowrap">${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  container.innerHTML = `<table class="table table-sm table-striped">${thead}${tbody}</table>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') return;
  try {
    const [users, providers, orders] = await Promise.all([
      fetchJSON(`${CONFIG.apiBaseUrl}/admin/users`, token),
      fetchJSON(`${CONFIG.apiBaseUrl}/admin/providers`, token),
      fetchJSON(`${CONFIG.apiBaseUrl}/admin/bookings`, token),
    ]);
    try {
      document.getElementById('metricUsers').textContent = users.length;
      document.getElementById('metricProviders').textContent = providers.length;
      document.getElementById('metricPendingProviders').textContent = providers.filter(p => p.status === 'PENDING').length;
      document.getElementById('metricOrders').textContent = orders.length;
    } catch (_) {}
    renderTable('usersTable', ['Name', 'Email', 'Phone', 'Role', 'Active', 'Created'],
      users.map(u => [u.name, u.email, u.phone, u.role, u.isActive ? 'Yes' : 'No', new Date(u.createdAt).toLocaleString()]));
    renderTable('providersTable', ['Name', 'Email', 'Phone', 'Status', 'Services', 'Experience', 'Location', 'Action'],
      providers.map(p => [
        p.name, p.email, p.phone, p.status === 'APPROVED' ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-warning text-dark">Pending</span>', (p.services || []).join(', '), (p.experience || 0) + 'y',
        p.location ? `${p.location.lat?.toFixed(5)}, ${p.location.lng?.toFixed(5)}` : '-',
        p.status === 'APPROVED' 
          ? `<button class="btn btn-sm btn-outline-warning" onclick="setProviderStatus('${p._id}','PENDING')">Mark Pending</button>`
          : `<button class="btn btn-sm btn-primary" onclick="setProviderStatus('${p._id}','APPROVED')">Activate</button>`
      ]));
    renderTable('ordersTable', ['Booking ID', 'User', 'Provider', 'Service', 'Price', 'Status', 'Created'],
      orders.map(b => [
        b._id, (b.userId && b.userId.name) || '-', (b.providerId && b.providerId.name) || '-', (b.serviceId && b.serviceId.name) || '-',
        typeof b.price === 'number' ? `${CONFIG.currency}${b.price}` : '-', b.status, new Date(b.createdAt).toLocaleString()
      ]));
  } catch (e) {
    console.error('Admin load error:', e);
  }
});

async function setProviderStatus(id, status) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${CONFIG.apiBaseUrl}/admin/provider/${id}/status`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert(status === 'APPROVED' ? 'Provider activated' : 'Provider marked pending');
    location.reload();
  } catch (e) { alert('Update failed: ' + e.message); }
}
