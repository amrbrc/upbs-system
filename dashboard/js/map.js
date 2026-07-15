// public/js/map.js
// Initializes the Leaflet interactive map and pins all station locations.
// Uses real UP Diliman coordinates for each bike station.

// ─────────────────────────────────────────────
// STATION COORDINATE MAP
// Key   = station name as stored in the database (location_name)
// Value = [latitude, longitude] at UP Diliman, QC
// ─────────────────────────────────────────────
const STATION_COORDS = {
    'palma_hall': [14.653574170864527, 121.06979198481794],
    'chk': [14.659638020321605, 121.06330132529811],
    'eee': [14.649993629891656, 121.06858563648599],
    'engg': [14.656756659836324, 121.0697043983114],
    'vinzons': [14.654470642806913, 121.07332096762704],
    'nec': [14.656735922111878, 121.07120546762717],
    'ncpag': [14.656572139748228, 121.0604108369428],
};

function normalizeStationKey(name) {
    if (!name) return 'unknown';
    const clean = name.toLowerCase().replace(/[\s_]+/g, '');
    const aliasMap = {
        'palmahall': 'palma_hall',
        'palma': 'palma_hall',
        'palma_hall': 'palma_hall',
        'chk': 'chk',
        'humankinetics': 'chk',
        'eee': 'eee',
        'eeebuilding': 'eee',
        'engg': 'engg',
        'engineering': 'engg',
        'engineeringcomplex': 'engg',
        'vinzons': 'vinzons',
        'vinzonshall': 'vinzons',
        'nec': 'nec',
        'necbuilding': 'nec',
        'ncpag': 'ncpag'
    };
    return aliasMap[clean] || clean;
}
window.normalizeStationKey = normalizeStationKey;

const STATION_COLORS = {
    'palma_hall': '#00E5FF', // Sky Blue / Cyan
    'chk': '#D500F9',        // Vibrant Purple / Violet
    'eee': '#00E676',        // Emerald Green
    'engg': '#FF6D00',       // Deep Orange
    'vinzons': '#FF1744',    // Crimson Red
    'nec': '#FFD600',        // Yellow / Gold
    'ncpag': '#2979FF',      // Royal Blue
};
window.STATION_COLORS = STATION_COLORS; // Expose globally

const DISTINCT_PALETTE = [
    '#AEEA00', // Lime
    '#F50057', // Magenta / Hot Pink
    '#00BFA5', // Teal
    '#8D6E63', // Bronze / Warm Brown
    '#3D5AFE', // Indigo
    '#64DD17', // Chartreuse
    '#FFAB00', // Amber
    '#1DE9B6', // Turquoise
    '#E040FB', // Orchid / Lavender
    '#69F0AE', // Mint
    '#536DFE', // Slate Blue
    '#C0CA33', // Olive Green
    '#FF8A80'  // Coral / Peach
];


// Display-friendly labels
const STATION_LABELS = {
    'palma_hall': 'Palma Hall',
    'chk': 'CHK (Human Kinetics)',
    'eee': 'EEE Building',
    'engg': 'Engineering Complex',
    'vinzons': 'Vinzons Hall',
    'nec': 'NEC Building',
    'ncpag': 'NCPAG',
};

// UP Diliman center (re-centered to fit all stations)
const MAP_CENTER = [14.6548, 121.0668];
const MAP_ZOOM = 15;

// ─────────────────────────────────────────────
// Custom glowing marker icon using CSS
// ─────────────────────────────────────────────
function createStationIcon(color = '#22d3ee') {
    return L.divIcon({
        className: '',   // disable default Leaflet styles
        html: `
            <div style="
                width: 28px; height: 28px;
                background: ${color};
                border: 3px solid rgba(255,255,255,0.9);
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 0 14px ${color}, 0 3px 10px rgba(0,0,0,0.5);
            ">
                <div style="
                    width: 8px; height: 8px;
                    background: white;
                    border-radius: 50%;
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%,-50%);
                "></div>
            </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 34],
        popupAnchor: [0, -34],
    });
}

// ─────────────────────────────────────────────
// INIT MAP
// Called on DOMContentLoaded so the #station-map div is ready.
// ─────────────────────────────────────────────
let leafletMap = null;
const stationMarkers = {}; // Store markers so we can open popups later

// Map Tile Layer handling for light/dark themes
let currentTileLayer = null;

function setTileLayer(theme) {
    if (currentTileLayer) leafletMap.removeLayer(currentTileLayer);

    // Use CartoDB tiles as requested, but without {r} to prevent 404 errors
    const tileUrl = theme === 'light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

    currentTileLayer = L.tileLayer(tileUrl, {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(leafletMap);
}

function initMap() {
    const mapEl = document.getElementById('station-map');
    if (!mapEl) return;

    // Create the Leaflet map
    leafletMap = L.map('station-map', {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: true,
        attributionControl: true,
    });
    window.leafletMap = leafletMap;

    // Initial tile layer setup based on current theme
    const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTileLayer(initialTheme);

    // Add a circle to show the UP Diliman campus boundary
    L.circle(MAP_CENTER, {
        color: 'rgba(34,211,238,0.3)',
        fillColor: 'rgba(34,211,238,0.05)',
        fillOpacity: 1,
        radius: 950,
        weight: 1,
    }).addTo(leafletMap);

    // Listen for theme toggle events
    window.addEventListener('themeChanged', (e) => {
        setTileLayer(e.detail.theme);
    });

    // Plot all known stations
    plotStationMarkers();

    // Force Leaflet to recalculate its size automatically whenever the map div resizes
    if (window.ResizeObserver && mapEl) {
        const resizeObserver = new ResizeObserver(() => {
            if (leafletMap) {
                leafletMap.invalidateSize();
            }
        });
        resizeObserver.observe(mapEl);
    }
    window.addEventListener('resize', () => {
        if (leafletMap) leafletMap.invalidateSize();
    });
    setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
    }, 500);
    setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
    }, 1500);
}


// ─────────────────────────────────────────────
// PLOT MARKERS
// Adds a pin for each station in STATION_COORDS if it is active in the database.
// ─────────────────────────────────────────────
async function plotStationMarkers() {
    if (!leafletMap) return;

    // Clear existing markers from map first
    Object.keys(stationMarkers).forEach(key => {
        if (stationMarkers[key]) {
            leafletMap.removeLayer(stationMarkers[key]);
        }
        delete stationMarkers[key];
    });

    try {
        const res = await fetch('/api/locations');
        const data = await res.json();
        if (data.success) {
            const activeStations = data.data
                .filter(loc => Number(loc.is_disabled) !== 1);

            const allMarkers = []; // Store markers to fit bounds
            let legendHtml = ['<div style="font-weight:700; margin-bottom:6px; color:#00E5FF;">Legend</div>'];
            let extraColorIndex = 0;

            activeStations.forEach(loc => {
                const normKey = normalizeStationKey(loc.location_name);
                const rawKey = loc.location_name.toLowerCase().trim();
                const key = normKey;
                let coords = STATION_COORDS[key] || STATION_COORDS[rawKey];

                // Override with database coords if they exist
                if (loc.latitude !== undefined && loc.latitude !== null && loc.longitude !== undefined && loc.longitude !== null) {
                    coords = [parseFloat(loc.latitude), parseFloat(loc.longitude)];
                    // Save to global STATION_COORDS so zoomToStation works
                    STATION_COORDS[key] = coords;
                    STATION_COORDS[rawKey] = coords;
                }
                
                if (!coords) {
                    alert(`SYSTEM MESSAGE:\nThe new station "${loc.location_name}" was successfully retrieved from the database, but its Latitude is "${loc.latitude}" and Longitude is "${loc.longitude}".\n\nBecause the coordinates are missing/empty in the database, it cannot be plotted on the map. This usually happens if the backend server wasn't fully restarted after the update, so it saved the station with empty coordinates.`);
                    return; // Skip if no coordinates known
                }

                let color = STATION_COLORS[key] || STATION_COLORS[rawKey];
                if (!color) {
                    const usedColors = new Set(Object.values(STATION_COLORS));
                    for (const candidate of DISTINCT_PALETTE) {
                        if (!usedColors.has(candidate)) {
                            color = candidate;
                            break;
                        }
                    }
                    if (!color) {
                        const angle = Math.floor((extraColorIndex * 137.5) % 360);
                        color = `hsl(${angle}, 85%, 55%)`;
                        extraColorIndex++;
                    }
                    STATION_COLORS[key] = color;
                    STATION_COLORS[rawKey] = color;
                }

                const label = STATION_LABELS[key] || STATION_LABELS[rawKey] || loc.location_name;

                legendHtml.push(
                    `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <div style="width:10px; height:10px; border-radius:50%; background:${color}; box-shadow:0 0 6px ${color};"></div>
                        <span>${label}</span>
                    </div>`
                );

                const marker = L.marker(coords, {
                    icon: createStationIcon(color),
                }).addTo(leafletMap);

                stationMarkers[key] = marker; // save marker reference

                // Popup shown when you click a marker
                marker.bindPopup(`
                    <div style="
                        font-family: Inter, sans-serif;
                        padding: 4px 2px;
                        min-width: 130px;
                    ">
                        <div style="
                            font-size: 0.85rem;
                            font-weight: 700;
                            color: ${color};
                            margin-bottom: 4px;
                        ">📍 ${label}</div>
                        <div style="
                            font-size: 0.72rem;
                            color: #9ca3af;
                        ">UP Bikeshare Station</div>
                    </div>
                `, {
                    className: 'custom-popup',
                    maxWidth: 180,
                });

                // Tooltip shown on hover (always visible)
                marker.bindTooltip(label, {
                    permanent: false,
                    direction: 'top',
                    className: 'station-tooltip',
                    offset: [0, -30],
                });

                allMarkers.push(marker);
            });

            // Adjust the map view to fit all plotted stations
            if (allMarkers.length > 0) {
                const group = new L.featureGroup(allMarkers);
                leafletMap.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
            } else {
                leafletMap.setView(MAP_CENTER, MAP_ZOOM);
            }

            // Remove existing legend if any
            const existingLegendElements = document.querySelectorAll('.map-legend');
            existingLegendElements.forEach(el => el.remove());

            // Add dynamic legend
            const legendControl = L.control({ position: 'bottomright' });
            legendControl.onAdd = function () {
                const div = L.DomUtil.create('div', 'map-legend');
                div.style.backgroundColor = 'rgba(15, 17, 23, 0.85)';
                div.style.padding = '10px 14px';
                div.style.borderRadius = '8px';
                div.style.border = '1px solid rgba(255,255,255,0.1)';
                div.style.color = '#e8eaf6';
                div.style.fontSize = '0.75rem';
                div.style.fontFamily = 'Inter, sans-serif';
                div.innerHTML = legendHtml.join('');
                return div;
            };
            legendControl.addTo(leafletMap);
        }
    } catch (err) {
        console.error("Failed to fetch locations for map markers:", err);
    }
}
window.plotStationMarkers = plotStationMarkers;

// ─────────────────────────────────────────────
// EXPORTED: updateMapWithLiveData
// Call this from bike.js or app.js to highlight
// stations that currently have bikes.
// ─────────────────────────────────────────────
function highlightActiveStation(stationName) {
    // Future enhancement: pulse the marker for active stations
    // For now, this is a placeholder that Developer B can extend
    console.log('[map.js] Active station:', stationName);
}

// ─────────────────────────────────────────────
// ZOOM TO STATION
// ─────────────────────────────────────────────
window.zoomToStation = function (stationKey) {
    if (!leafletMap || !STATION_COORDS[stationKey]) return;

    // Zoom in
    leafletMap.setView(STATION_COORDS[stationKey], 18);

    // Open the popup for that station
    if (stationMarkers[stationKey]) {
        stationMarkers[stationKey].openPopup();
    }
};

// Initialize map when the page is ready
document.addEventListener('DOMContentLoaded', initMap);
