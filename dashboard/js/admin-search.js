// public/js/admin-search.js

document.addEventListener('DOMContentLoaded', () => {
    const searchType = document.getElementById('admin-search-type');
    const searchInput = document.getElementById('admin-search-input');
    const btnSearch = document.getElementById('btn-admin-search');
    const searchResults = document.getElementById('admin-search-results');

    // Update placeholder based on selected search type
    const updatePlaceholder = () => {
        if (searchType.value === 'bike') {
            searchInput.placeholder = "Enter Bicycle Code (Leave empty to show all bikes)";
        } else {
            searchInput.placeholder = "Enter Phone, First Name, or Last Name (Leave empty to show all)";
        }
    };
    searchType.addEventListener('change', updatePlaceholder);
    updatePlaceholder();

    // UI Template: Bike Profile Card (Pure View Only)
    const renderBikeCard = (bike) => `
        <div class="card border p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold mb-0 ${bike.is_disabled ? 'text-muted' : 'text-dark'}">Bike #${bike.code} ${bike.is_disabled ? '<span class="badge bg-secondary ms-1" style="font-size:0.65rem;">OFFLINE</span>' : ''}</h6>
                <span class="badge ${bike.status === 'Good' ? 'bg-success' : (bike.status === 'Broken' ? 'bg-danger' : 'bg-warning')}">${bike.status}</span>
            </div>
            <div class="small text-muted mb-2">📍 Location: <span class="text-dark fw-semibold">${bike.location || 'Unknown'}</span></div>
            <div class="d-flex flex-column gap-1 border-top pt-2 mt-2">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="small fw-semibold text-muted">Lock Code:</span>
                    <span class="small fw-bold text-dark font-monospace">${bike.lock_code}</span>
                </div>
            </div>
        </div>
    `;

    // UI Template: Member Result Card (Contains color-coded Trust Points, view-only)
    const renderMemberCard = (member) => {
        let trustColor = 'success';
        let trustPoints = parseInt(member.trust_points) || 100;

        // Color code logic based on trust points
        if (trustPoints < 50) trustColor = 'danger';
        else if (trustPoints < 80) trustColor = 'warning';

        const isFrozen = member.points_frozen == 1 || member.points_frozen === true || member.points_frozen === 'true';
        const frozenBadge = isFrozen ? '<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px; font-weight: 600;">FROZEN</span>' : '';

        return `
        <div class="card border p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold text-dark mb-0">👤 ${member.firstname} ${member.lastname} ${frozenBadge}</h6>
            </div>
            <div class="small text-muted mb-3">📱 <span class="text-dark font-monospace">${member.phone_number}</span></div>
            
            <div class="border-top pt-3 mt-1 d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <span class="small fw-semibold text-muted">Trust Points:</span>
                    <span class="badge bg-${trustColor} fs-6">${trustPoints}</span>
                </div>
            </div>
        </div>
        `;
    };

    // Handle Search Button Click
    btnSearch.addEventListener('click', async () => {
        const type = searchType.value;
        const query = searchInput.value.trim();

        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            searchResults.innerHTML = `<div class="alert alert-danger py-2 small border-0">Unauthorized: Please sign in under the "Settings" tab first.</div>`;
            return;
        }

        searchResults.innerHTML = `<div class="text-center small text-muted my-3">Searching database...</div>`;

        try {
            const res = await fetch(`/api/admin/search/${type === 'bike' ? 'bicycles' : 'members'}?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) {
                searchResults.innerHTML = `<div class="alert alert-danger py-2 small border-0">Session expired or unauthorized. Please sign in under the "Settings" tab first.</div>`;
                return;
            }

            const data = await res.json();

            if (data.success && data.data.length > 0) {
                if (type === 'bike') {
                    searchResults.innerHTML = data.data.map(b => renderBikeCard({
                        code: b.bicycle_code,
                        lock_code: b.combination_lock,
                        status: b.condition_status,
                        location: b.new_location,
                        is_disabled: b.is_disabled === 1 || b.is_disabled === true
                    })).join('');
                } else {
                    searchResults.innerHTML = data.data.map(m => renderMemberCard(m)).join('');
                }
            } else {
                const searchMsg = query ? `No results found for "${query}".` : 'No bicycles found in database.';
                searchResults.innerHTML = `<div class="alert alert-info py-2 small border-0">${searchMsg}</div>`;
            }
        } catch (e) {
            searchResults.innerHTML = `<div class="alert alert-danger py-2 small border-0">Error fetching database results.</div>`;
        }
    });

    // Event delegation for actions in search results
    searchResults.addEventListener('click', async (e) => {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            alert('Please sign in under the "Settings" tab first.');
            return;
        }

        // 1. Add points
        if (e.target.classList.contains('btn-add-points')) {
            const phone = e.target.getAttribute('data-phone');
            const currentPoints = parseInt(e.target.getAttribute('data-points'));
            const additionalPoints = prompt('Enter additional points to add to this member (e.g. 20 for volunteer, or -5 for penalty):');
            if (additionalPoints === null || additionalPoints.trim() === '') return;

            const newTotalPoints = currentPoints + parseInt(additionalPoints);

            e.target.disabled = true;
            try {
                const res = await fetch('/api/admin/override-points', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ phone_number: phone, trust_points: newTotalPoints })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Successfully added points! New Trust Score is ${newTotalPoints}.`);
                    // Refresh search
                    btnSearch.click();
                } else {
                    alert(data.error || 'Failed to adjust points.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                e.target.disabled = false;
            }
        }

        // 3. Activate Member
        if (e.target.classList.contains('btn-activate-member')) {
            const phone = e.target.getAttribute('data-phone');
            if (!confirm('Are you sure you want to reactivate this member?')) return;

            e.target.disabled = true;
            try {
                const res = await fetch('/api/admin/activate-member', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ phone_number: phone })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Member successfully reactivated!');
                    btnSearch.click();
                } else {
                    alert(data.error || 'Failed to reactivate member.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                e.target.disabled = false;
            }
        }

        // 2. Delete Member (soft-delete)
        if (e.target.classList.contains('btn-delete-member')) {
            const phone = e.target.getAttribute('data-phone');
            if (!confirm('Are you sure you want to delete/deactivate this member?')) return;

            e.target.disabled = true;
            try {
                const res = await fetch('/api/admin/delete-member', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ phone_number: phone })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Member successfully deactivated!');
                    // Refresh search
                    btnSearch.click();
                } else {
                    alert(data.error || 'Failed to delete member.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                e.target.disabled = false;
            }
        }
    });
});