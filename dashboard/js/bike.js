// public/js/bike.js
// Fetches bicycle and location data, manages state, and renders the UI.

let allBikes = [];
let allLocations = [];
let currentFilterStation = null;

// =============================================================
// INITIALIZE DASHBOARD
// =============================================================
async function initDashboard() {
    await Promise.all([
        fetchBikes(),
        fetchLocations()
    ]);

    renderBikes();
    renderLocations();

    if (window.plotStationMarkers) {
        await window.plotStationMarkers();
    }

    // Set last updated time
    const lastUpdatedEl = document.getElementById('stat-last-updated');
    if (lastUpdatedEl) {
        const now = new Date();
        lastUpdatedEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

// =============================================================
// LIVE CLOCK
// =============================================================
function startLiveClock() {
    const timeEl = document.getElementById('live-time');
    if (!timeEl) return;

    setInterval(() => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
}

// =============================================================
// FETCH DATA
// =============================================================
async function fetchBikes() {
    try {
        const response = await fetch('/api/bicycles', { cache: 'no-store' });
        const result = await response.json();
        if (result.success) {
            allBikes = result.data;
        }
    } catch (err) {
        console.error('[bike.js] Failed to fetch bicycles:', err);
    }
}

async function fetchLocations() {
    try {
        const response = await fetch('/api/locations', { cache: 'no-store' });
        const result = await response.json();
        if (result.success) {
            allLocations = result.data;
            window.allLocations = allLocations; // Expose globally for settings.js
        }
    } catch (err) {
        console.error('[bike.js] Failed to fetch locations:', err);
    }
}

// =============================================================
// RENDER BIKES
// =============================================================
function renderBikes() {
    const grid = document.getElementById('bikes-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Update hero stats early so they always show the grand total
    const statTotalBikes = document.getElementById('stat-total-bikes');
    if (statTotalBikes) statTotalBikes.textContent = allBikes.length;

    if (!currentFilterStation) {
        grid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1; padding: 10px;">Select a station from the list to view its parked bicycles.</p>';
        return;
    }

    // Filter bikes for the selected station
    const bikesToRender = allBikes.filter(b => b.new_location === currentFilterStation);

    if (bikesToRender.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1; padding: 10px;">No bicycles found at ${currentFilterStation}.</p>`;
        return;
    }

    bikesToRender.forEach((bike, index) => {
        const card = document.createElement('div');
        card.className = 'bike-card';
        card.style.animationDelay = `${index * 0.05}s`;

        // HTML status indicators and styles based on bicycle condition
        const isDisputed = bike.condition_status === 'Disputed';
        const isBroken = bike.condition_status === 'Broken';
        const isInRepair = bike.condition_status === 'In_Repair';
        const isMissing = bike.condition_status === 'Missing';
        const isBorrowed = bike.condition_status === 'Borrowed';
        const isPending = bike.condition_status === 'Pending_Status';
        const isDisabled = Number(bike.is_disabled) === 1 || bike.is_disabled === true || String(bike.is_disabled).toLowerCase() === 'true';

        let borderStyle = '';
        let statusBadge = '';

        if (isDisabled) {
            borderStyle = 'border: 2px solid #6c757d; background-color: #f8f9fa;';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#6c757d; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">OFFLINE</div>';
        } else if (isDisputed) {
            borderStyle = 'border: 2px solid #ef4444; background-color: rgba(239, 68, 68, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#ef4444; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">DISPUTED</div>';
        } else if (isBroken) {
            borderStyle = 'border: 2px solid #b91c1c; background-color: rgba(185, 28, 28, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#b91c1c; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">BROKEN</div>';
        } else if (isInRepair) {
            borderStyle = 'border: 2px solid #8b5cf6; background-color: rgba(139, 92, 246, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#8b5cf6; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">IN REPAIR</div>';
        } else if (isMissing) {
            borderStyle = 'border: 2px solid #f97316; background-color: rgba(249, 115, 22, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#f97316; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">MISSING</div>';
        } else if (isBorrowed) {
            borderStyle = 'border: 2px solid #3b82f6; background-color: rgba(59, 130, 246, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#3b82f6; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">BORROWED</div>';
        } else if (isPending) {
            borderStyle = 'border: 2px solid #f59e0b; background-color: rgba(245, 158, 11, 0.05);';
            statusBadge = '<div style="font-size:0.6rem; color:white; background:#f59e0b; padding:2px 4px; border-radius:4px; margin-top:4px; font-weight:600;">PENDING CHECK</div>';
        }

        card.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; ${borderStyle} border-radius: var(--radius-md); padding: 8px;">
                <span class="bike-icon" style="display: none;"></span>
                <div class="bike-num" style="${isDisabled ? 'color: #6c757d;' : ''}">${bike.bicycle_code}</div>
                <div class="bike-loc-wrap">
                    <div class="bike-loc">${bike.new_location || 'Unknown'}</div>
                </div>
                ${statusBadge}
            </div>
        `;

        grid.appendChild(card);
    });
}

// =============================================================
// RENDER LOCATIONS (STATIONS)
// =============================================================
function renderLocations() {
    const grid = document.getElementById('stations-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (allLocations.length === 0) {
        grid.innerHTML = '<p class="placeholder-text">No stations found.</p>';
        return;
    }

    // Compute how many bikes are at each station
    const bikeCounts = {};
    allBikes.forEach(bike => {
        const loc = bike.new_location;
        if (loc) {
            bikeCounts[loc] = (bikeCounts[loc] || 0) + 1;
        }
    });

    allLocations.forEach((loc, index) => {
        const stationKey = loc.location_name;
        const mapKey = stationKey.toLowerCase().trim();
        const count = bikeCounts[stationKey] || 0;
        const isDisabled = loc.is_disabled === 1 || loc.is_disabled === true;

        // Get color from map.js if available, default to green. Use red if disabled.
        const dotColor = isDisabled ? '#ef4444' : ((window.STATION_COLORS && window.STATION_COLORS[mapKey])
            ? window.STATION_COLORS[mapKey]
            : '#34d399');

        const row = document.createElement('div');
        row.className = 'station-row';
        row.style.animationDelay = `${index * 0.05}s`;
        if (isDisabled) {
            row.style.opacity = '0.75';
        }

        // If this station is currently selected, highlight it
        if (currentFilterStation === stationKey) {
            row.style.background = 'rgba(255,255,255,0.08)';
            row.style.borderColor = dotColor;
        }

        row.innerHTML = `
            <div class="station-dot" style="background-color: ${dotColor}; box-shadow: 0 0 6px ${dotColor};"></div>
            <span class="station-name" style="${isDisabled ? 'color: var(--text-muted);' : ''}">
                ${stationKey} ${isDisabled ? '<span style="font-size:0.62rem; color:#f87171; background:rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding:1px 6px; border-radius:10px; font-weight:700; margin-left:6px; letter-spacing:0.5px; text-transform:uppercase;">Offline</span>' : ''}
            </span>
            <span style="margin-left:auto; font-size:0.75rem; color:#8892a4; font-weight:600; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px;">
                ${count} ${count === 1 ? 'bike' : 'bikes'}
            </span>
            <span class="station-arrow" style="margin-left: 8px;">›</span>
        `;

        // Interaction: Click to filter bikes and zoom map
        row.addEventListener('click', () => {
            // Toggle filter
            if (currentFilterStation === stationKey) {
                currentFilterStation = null; // Un-filter if clicked again
            } else {
                currentFilterStation = stationKey;
                // Zoom map (calls function in map.js)
                if (window.zoomToStation) {
                    window.zoomToStation(mapKey);
                }
            }

            // Re-render UI
            renderLocations(); // Re-render to update highlight state
            renderBikes();     // Re-render to show filtered bikes
        });

        grid.appendChild(row);
    });

    // Update hero stats if Developer B hasn't done it yet
    const statTotalStations = document.getElementById('stat-total-stations');
    if (statTotalStations) statTotalStations.textContent = allLocations.length;
}

// Expose initDashboard globally
window.initDashboard = initDashboard;

// =============================================================
// SELF-INITIALIZATION
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    startLiveClock();
});
