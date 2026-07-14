// public/js/settings.js
// Manages the Admin Settings Panel overlay and operations.

document.addEventListener('DOMContentLoaded', () => {
    // Login UI Elements
    const toggleLoginModeBtn = document.getElementById('toggle-login-mode');
    const studentLoginForm = document.getElementById('student-login-form');
    const adminLoginForm = document.getElementById('admin-login-form');
    const loginDescription = document.querySelector('#settings-login-view p.text-muted');

    let isStudentLogin = true; // Track which mode we are in

    // Handle toggling between Student and Admin login
    if (toggleLoginModeBtn) {
        toggleLoginModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isStudentLogin = !isStudentLogin;

            if (isStudentLogin) {
                studentLoginForm.style.setProperty('display', 'flex', 'important');
                adminLoginForm.style.setProperty('display', 'none', 'important');
                toggleLoginModeBtn.textContent = "Admin Credentials Login";
                loginDescription.textContent = "Enter your registered mobile number to sign in.";
            } else {
                studentLoginForm.style.setProperty('display', 'none', 'important');
                adminLoginForm.style.setProperty('display', 'flex', 'important');
                toggleLoginModeBtn.textContent = "Student Mobile Login";
                loginDescription.textContent = "Please authenticate with admin credentials.";
            }
        });
    }

    const navSettings = document.getElementById('nav-settings');
    const navRegistration = document.getElementById('nav-registration');
    const navLogs = document.getElementById('nav-logs');
    const navPointsSettings = document.getElementById('nav-points-settings');

    const registrationContainer = document.getElementById('registration-container');
    const settingsContainer = document.getElementById('settings-container');
    const logsContainer = document.getElementById('logs-container');
    const pointsSettingsContainer = document.getElementById('points-settings-container');

    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('nav-analytics');
    const navMap = document.getElementById('nav-map');
    const dashboardGrid = document.getElementById('dashboard-container');
    const analyticsContainer = document.getElementById('analytics-container');
    const heroMap = document.querySelector('.hero-map-section');
    const mainWrapper = document.querySelector('.main-wrapper');

    const loginView = document.getElementById('settings-login-view');
    const adminView = document.getElementById('settings-admin-view');

    const loginUsername = document.getElementById('admin-username');
    const loginPassword = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const btnLogout = document.getElementById('btn-admin-logout');

    const newBikeCode = document.getElementById('new-bike-code');
    const newBikeLock = document.getElementById('new-bike-lock');
    const newBikeLocation = document.getElementById('new-bike-location');
    const btnAddBike = document.getElementById('btn-add-bike');
    const addBikeMsg = document.getElementById('add-bike-msg');

    const newStationName = document.getElementById('new-station-name');
    const btnAddStation = document.getElementById('btn-add-station');
    const addStationMsg = document.getElementById('add-station-msg');

    let addStationMap = null;
    let addStationMarker = null;

    const stationToggleList = document.getElementById('station-toggle-list');
    let cachedMembers = [];

    // Register Member elements
    const newMemberFirstname = document.getElementById('new-member-firstname');
    const newMemberLastname = document.getElementById('new-member-lastname');
    const newMemberPhone = document.getElementById('new-member-phone');
    const btnAddMember = document.getElementById('btn-add-member');
    const addMemberMsg = document.getElementById('add-member-msg');
    const membersList = document.getElementById('members-list');

    // Generic confirmation modal logic
    function confirmAction(title, text, onConfirm) {
        const modal = document.getElementById('action-confirm-modal');
        const titleEl = document.getElementById('action-confirm-title');
        const textEl = document.getElementById('action-confirm-text');
        const btnCancel = document.getElementById('btn-action-cancel');
        const btnConfirm = document.getElementById('btn-action-confirm');

        if (!modal) {
            if (confirm(text)) onConfirm();
            return;
        }

        titleEl.textContent = title;
        textEl.textContent = text;
        modal.style.display = 'flex';

        const newBtnCancel = btnCancel.cloneNode(true);
        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnCancel.replaceWith(newBtnCancel);
        btnConfirm.replaceWith(newBtnConfirm);

        newBtnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        newBtnConfirm.addEventListener('click', () => {
            modal.style.display = 'none';
            onConfirm();
        });
    }

    // Event handler for registering member
    btnAddMember.addEventListener('click', () => {
        const firstname = newMemberFirstname.value.trim();
        const lastname = newMemberLastname.value.trim();
        let phone = newMemberPhone.value.trim();

        addMemberMsg.style.display = 'none';

        if (!firstname || !lastname || !phone) {
            addMemberMsg.textContent = 'All fields are required.';
            addMemberMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            addMemberMsg.style.color = '#ef4444';
            addMemberMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            addMemberMsg.style.display = 'block';
            return;
        }

        // Auto-formatting phone number to +639XXXXXXXXX
        if (phone.startsWith('09') && phone.length === 11) {
            phone = '+63' + phone.substring(1);
        } else if (phone.startsWith('9') && phone.length === 10) {
            phone = '+63' + phone;
        } else if (phone.startsWith('639') && phone.length === 12) {
            phone = '+' + phone;
        }

        // Validate final format: starts with +639 followed by exactly 9 digits
        const phPhoneRegex = /^\+639\d{9}$/;
        if (!phPhoneRegex.test(phone)) {
            addMemberMsg.textContent = 'Invalid phone number format. Must be like +639171234567 or 09171234567.';
            addMemberMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            addMemberMsg.style.color = '#ef4444';
            addMemberMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            addMemberMsg.style.display = 'block';
            return;
        }

        confirmAction('Register Member', `Are you sure you want to register ${firstname} ${lastname}?`, async () => {
            btnAddMember.disabled = true;
            btnAddMember.textContent = 'Registering...';
            try {
                const res = await fetch('/api/admin/members', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({
                        firstname,
                        lastname,
                        phone_number: phone
                    })
                });
                const data = await res.json();
                if (data.success) {
                    newMemberFirstname.value = '';
                    newMemberLastname.value = '';
                    newMemberPhone.value = '';
                    addMemberMsg.textContent = data.message || 'User registered successfully!';
                    addMemberMsg.style.background = 'rgba(0, 106, 78, 0.1)';
                    addMemberMsg.style.color = 'var(--up-green)';
                    addMemberMsg.style.border = '1px solid rgba(0, 106, 78, 0.2)';
                    addMemberMsg.style.display = 'block';
                    await renderMembersList();
                } else {
                    addMemberMsg.textContent = data.error || 'Failed to register user.';
                    addMemberMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                    addMemberMsg.style.color = '#ef4444';
                    addMemberMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                    addMemberMsg.style.display = 'block';
                }
            } catch (e) {
                addMemberMsg.textContent = 'Connection error. Please try again.';
                addMemberMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                addMemberMsg.style.color = '#ef4444';
                addMemberMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                addMemberMsg.style.display = 'block';
            } finally {
                btnAddMember.disabled = false;
                btnAddMember.textContent = 'Register User';
            }
        });
    });

    function hideAllViews() {
        const studentDashboardContainer = document.getElementById('student-dashboard-container');
        if (studentDashboardContainer) studentDashboardContainer.style.display = 'none';
        if (heroMap) heroMap.style.setProperty('display', 'none', 'important');
        if (dashboardGrid) dashboardGrid.style.display = 'none';
        if (analyticsContainer) analyticsContainer.style.display = 'none';
        if (registrationContainer) registrationContainer.style.display = 'none';
        if (settingsContainer) settingsContainer.style.display = 'none';
        if (logsContainer) logsContainer.style.display = 'none';
        if (pointsSettingsContainer) pointsSettingsContainer.style.display = 'none';
        if (mainWrapper) {
            mainWrapper.style.overflowY = 'auto';
            mainWrapper.scrollTop = 0;
        }
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.body.classList.add('non-map-view');

        if (navDashboard) navDashboard.classList.remove('active');
        if (navMap) navMap.classList.remove('active');
        if (navAnalytics) navAnalytics.classList.remove('active');
        if (navRegistration) navRegistration.classList.remove('active');
        if (navSettings) navSettings.classList.remove('active');
        if (navLogs) navLogs.classList.remove('active');
        if (navPointsSettings) navPointsSettings.classList.remove('active');
    }

    // Intercept clicks on other nav items to hide our new containers
    [navDashboard, navMap, navAnalytics].forEach(nav => {
        if (nav) {
            nav.addEventListener('click', () => {
                if (registrationContainer) registrationContainer.style.display = 'none';
                if (settingsContainer) settingsContainer.style.display = 'none';
                if (logsContainer) logsContainer.style.display = 'none';
                if (pointsSettingsContainer) pointsSettingsContainer.style.display = 'none';
                if (navRegistration) navRegistration.classList.remove('active');
                if (navSettings) navSettings.classList.remove('active');
                if (navLogs) navLogs.classList.remove('active');
                if (navPointsSettings) navPointsSettings.classList.remove('active');

                if (nav === navDashboard || nav === navMap) {
                    document.body.classList.remove('non-map-view');
                    if (heroMap) heroMap.style.setProperty('display', 'block');
                } else {
                    document.body.classList.add('non-map-view');
                    if (heroMap) heroMap.style.setProperty('display', 'none', 'important');
                }
            });
        }
    });

    function initAddStationMap() {
        const mapEl = document.getElementById('add-station-map');
        if (!mapEl || addStationMap) return;

        const defaultCenter = [14.6548, 121.0668];

        addStationMap = L.map('add-station-map', {
            center: defaultCenter,
            zoom: 15,
            zoomControl: true,
            attributionControl: false
        });

        const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const tileUrl = initialTheme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

        let addStationTileLayer = L.tileLayer(tileUrl, {
            subdomains: 'abcd',
            maxZoom: 20,
        }).addTo(addStationMap);

        window.addEventListener('themeChanged', (e) => {
            if (addStationTileLayer) {
                addStationMap.removeLayer(addStationTileLayer);
            }
            const newTileUrl = e.detail.theme === 'light'
                ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
            addStationTileLayer = L.tileLayer(newTileUrl, {
                subdomains: 'abcd',
                maxZoom: 20,
            }).addTo(addStationMap);
        });

        addStationMarker = L.marker(defaultCenter, {
            draggable: true
        }).addTo(addStationMap);

        const latInput = document.getElementById('new-station-lat');
        const lngInput = document.getElementById('new-station-lng');

        if (latInput && !latInput.value) {
            latInput.value = defaultCenter[0].toFixed(6);
        }
        if (lngInput && !lngInput.value) {
            lngInput.value = defaultCenter[1].toFixed(6);
        }

        addStationMarker.on('dragend', () => {
            const position = addStationMarker.getLatLng();
            if (latInput) latInput.value = position.lat.toFixed(6);
            if (lngInput) lngInput.value = position.lng.toFixed(6);
        });

        addStationMap.on('click', (e) => {
            addStationMarker.setLatLng(e.latlng);
            if (latInput) latInput.value = e.latlng.lat.toFixed(6);
            if (lngInput) lngInput.value = e.latlng.lng.toFixed(6);
        });

        const updateMarkerFromInputs = () => {
            const lat = parseFloat(latInput ? latInput.value : NaN);
            const lng = parseFloat(lngInput ? lngInput.value : NaN);
            if (!isNaN(lat) && !isNaN(lng)) {
                const newLatLng = new L.LatLng(lat, lng);
                addStationMarker.setLatLng(newLatLng);
                addStationMap.panTo(newLatLng);
            }
        };

        if (latInput) {
            latInput.addEventListener('input', updateMarkerFromInputs);
        }
        if (lngInput) {
            lngInput.addEventListener('input', updateMarkerFromInputs);
        }

        setTimeout(() => {
            addStationMap.invalidateSize();
        }, 200);
    }

    if (navRegistration) {
        navRegistration.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllViews();
            navRegistration.classList.add('active');
            if (registrationContainer) registrationContainer.style.display = 'block';
            if (mainWrapper) mainWrapper.style.overflowY = 'auto';

            if (!addStationMap) {
                initAddStationMap();
            } else {
                setTimeout(() => {
                    addStationMap.invalidateSize();
                }, 100);
            }
        });
    }

    if (navSettings) {
        navSettings.addEventListener('click', (e) => {
            e.preventDefault();
            checkSession(true);
        });
    }

    // Modal close logic
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            const token = sessionStorage.getItem('adminToken');
            if (token && settingsContainer) {
                settingsContainer.style.display = 'none';
            }
        });
    }

    // Close modal when clicking outside the modal card (only if authenticated)
    if (settingsContainer) {
        settingsContainer.addEventListener('click', (e) => {
            if (e.target === settingsContainer) {
                const token = sessionStorage.getItem('adminToken');
                if (token) {
                    settingsContainer.style.display = 'none';
                }
            }
        });
    }

    if (navLogs) {
        navLogs.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllViews();
            navLogs.classList.add('active');
            if (logsContainer) logsContainer.style.display = 'flex';
            if (mainWrapper) mainWrapper.style.overflowY = 'hidden';
            loadLogs();
        });
    }

    if (navPointsSettings) {
        navPointsSettings.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllViews();
            navPointsSettings.classList.add('active');
            if (pointsSettingsContainer) pointsSettingsContainer.style.display = 'block';
            if (mainWrapper) mainWrapper.style.overflowY = 'auto';
            loadPointsSettings();
        });
    }

    async function loadPointsSettings() {
        const grid = document.getElementById('points-settings-grid');
        if (!grid) return;

        // Inject custom styles if they don't exist
        if (!document.getElementById('points-settings-custom-styles')) {
            const style = document.createElement('style');
            style.id = 'points-settings-custom-styles';
            style.textContent = `
                .points-settings-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
                }
                .points-settings-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
                    border-color: var(--border-strong) !important;
                }
                .settings-val-input {
                    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
                }
                .settings-val-input:focus {
                    border-color: var(--up-maroon) !important;
                    box-shadow: 0 0 0 3px rgba(123, 17, 19, 0.12) !important;
                }
                .btn-save-setting-trigger {
                    transition: background-color 0.2s ease, transform 0.1s ease !important;
                }
                .btn-save-setting-trigger:hover {
                    background-color: #5a0c0e !important;
                }
                .btn-save-setting-trigger:active {
                    transform: scale(0.96);
                }
            `;
            document.head.appendChild(style);
        }

        try {
            const res = await fetch('/api/admin/settings', { headers: getAdminHeaders() });
            const data = await res.json();
            if (data.success) {
                grid.innerHTML = '';

                // Be resilient to both formatted object mapping and raw rows array
                let settingsObj = {};
                if (data.data) {
                    settingsObj = data.data;
                } else if (Array.isArray(data.settings)) {
                    data.settings.forEach(row => {
                        settingsObj[row.setting_name] = row.setting_value;
                    });
                }
                
                // Populate Admin Alert Contacts displays and save in global state
                const adminName1 = settingsObj['admin_alert_name_1'] || '';
                const adminPhone1 = settingsObj['admin_alert_phone_1'] || '';
                const adminName2 = settingsObj['admin_alert_name_2'] || '';
                const adminPhone2 = settingsObj['admin_alert_phone_2'] || '';

                window.currentAdminName1 = adminName1;
                window.currentAdminPhone1 = adminPhone1;
                window.currentAdminName2 = adminName2;
                window.currentAdminPhone2 = adminPhone2;

                const displayName1 = document.getElementById('admin-display-name-1');
                const displayPhone1 = document.getElementById('admin-display-phone-1');
                const displayName2 = document.getElementById('admin-display-name-2');
                const displayPhone2 = document.getElementById('admin-display-phone-2');

                if (displayName1) displayName1.textContent = adminName1 || 'Not Configured';
                if (displayPhone1) displayPhone1.textContent = adminPhone1 || '-';
                if (displayName2) displayName2.textContent = adminName2 || 'Not Configured';
                if (displayPhone2) displayPhone2.textContent = adminPhone2 || '-';

                const descriptions = {
                    reward_honest_report: "Rewarded for reporting a broken/missing bike that was disputed.",
                    penalty_hit_and_run: "Deducted from a user found responsible for unreported damage.",
                    penalty_false_report: "Deducted for submitting a false damage or missing report.",
                    penalty_overtime: "Deducted per hour for borrowing a bike past the borrow time limit.",
                    suspension_limit: "Minimum trust points required before account auto-suspension.",
                    honesty_reward: "Rewarded when a 'Good' report is confirmed by the next rider.",
                    reward_community_volunteer: "Rewarded to a user who completes a verified Community Service shift at a hub.",
                    reward_delivered_bike: "Rewarded to a user who delivers a broken bike to a designated hub.",
                    consistent_rider_reward: "Rewarded for every 5 consecutive clean rides completed.",
                    borrow_time_limit_hours: "Maximum hours a user can borrow a bike before overtime penalties apply.",
                    abort_trip_grace_period_mins: "Grace period (mins) after borrowing to abort the trip and report damage without penalty.",
                    handshake_timeout_mins: "Time limit (mins) to confirm bike condition before trip is auto-completed.",
                    penalty_abandoned_handshake: "Deducted when a user abandons the return handshake confirmation."
                };

                // Split into categories
                const rewards = [];
                const penalties = [];
                const thresholds = [];

                for (const [key, val] of Object.entries(settingsObj)) {
                    // Ignore deprecated or removed settings, and admin alert settings
                    if (key === 'reward_good_samaritan') continue;
                    if (key.startsWith('admin_alert_')) continue;

                    const item = { key, val, description: descriptions[key] || "System policy setting." };
                    if (key.startsWith('reward') || key.startsWith('honesty') || key.startsWith('consistent')) {
                        rewards.push(item);
                    } else if (key.startsWith('penalty')) {
                        penalties.push(item);
                    } else {
                        thresholds.push(item);
                    }
                }

                // Helper to create card HTML
                const createCard = (item) => {
                    const formattedKey = item.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const badgeStyle = parseInt(item.val) < 0
                        ? 'background-color: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.15);'
                        : (item.key.includes('limit') || item.key.includes('timeout') || item.key.includes('grace_period')
                            ? 'background-color: rgba(234, 179, 8, 0.12); color: #ca8a04; border: 1px solid rgba(234, 179, 8, 0.15);'
                            : 'background-color: rgba(34, 197, 94, 0.12); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.15);');
                    const badgeStyleHtml = `font-size: 0.8rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; ${badgeStyle}`;

                    let suffix = 'pts';
                    if (item.key.includes('hours')) {
                        suffix = Math.abs(parseInt(item.val)) === 1 ? 'hr' : 'hrs';
                    } else if (item.key.includes('mins')) {
                        suffix = 'mins';
                    } else if (item.key.includes('overtime')) {
                        suffix = 'pts / hr';
                    } else if (Math.abs(parseInt(item.val)) === 1) {
                        suffix = 'pt';
                    }
                    const displayVal = `${item.val > 0 && suffix.includes('pt') ? '+' : ''}${item.val} ${suffix}`;

                    return `
                        <div class="col-md-6 col-lg-4">
                            <div class="card p-3 shadow-sm border-0 h-100 d-flex flex-column justify-content-between points-settings-card" style="background-color: var(--bg-panel); border-radius: var(--radius-md); border: 1px solid var(--border) !important;">
                                <div>
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h6 class="fw-bold mb-0" style="color: var(--text-h); font-size: 0.95rem; max-width: 70%; line-height: 1.3;">${formattedKey}</h6>
                                        <span style="${badgeStyleHtml}">${displayVal}</span>
                                    </div>
                                    <p class="small text-muted mb-0 font-monospace" style="font-size: 0.68rem; opacity: 0.6; margin-bottom: 8px;">${item.key}</p>
                                    <p class="small text-muted mb-3" style="font-size: 0.78rem; line-height: 1.45;">${item.description}</p>
                                </div>
                                <div class="mt-auto pt-3" style="border-top: 1px dashed var(--border) !important;">
                                    <div class="d-flex align-items-center justify-content-between">
                                        <span class="text-muted small fw-semibold" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">Edit Value</span>
                                        <div class="d-flex align-items-center gap-2">
                                            <input type="number" class="settings-val-input" value="${item.val}" style="width: 75px; height: 32px; padding: 4px 8px; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border); background-color: var(--bg-main); color: var(--text-h); outline: none; box-sizing: border-box; text-align: center;">
                                            <button class="btn-save-setting-trigger" data-key="${item.key}" type="button" style="height: 32px; padding: 0 12px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; background-color: var(--up-maroon); color: white; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">Save</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                };

                // Render Rewards Configuration
                if (rewards.length > 0) {
                    const title = document.createElement('div');
                    title.className = 'col-12 mt-4 mb-3';
                    title.innerHTML = `
                        <h5 class="fw-bold" style="color: var(--text-h); font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; border-left: 4px solid #22c55e; padding-left: 12px; margin-bottom: 0;">
                            Rewards & Incentives
                        </h5>
                    `;
                    grid.appendChild(title);

                    rewards.forEach(item => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = createCard(item);
                        grid.appendChild(tempDiv.firstElementChild);
                    });
                }

                // Render Penalties Configuration
                if (penalties.length > 0) {
                    const title = document.createElement('div');
                    title.className = 'col-12 mt-5 mb-3';
                    title.innerHTML = `
                        <h5 class="fw-bold" style="color: var(--text-h); font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; border-left: 4px solid #ef4444; padding-left: 12px; margin-bottom: 0;">
                            Penalties & Deductions
                        </h5>
                    `;
                    grid.appendChild(title);

                    penalties.forEach(item => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = createCard(item);
                        grid.appendChild(tempDiv.firstElementChild);
                    });
                }

                // Render Thresholds Configuration
                if (thresholds.length > 0) {
                    const title = document.createElement('div');
                    title.className = 'col-12 mt-5 mb-3';
                    title.innerHTML = `
                        <h5 class="fw-bold" style="color: var(--text-h); font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; border-left: 4px solid #eab308; padding-left: 12px; margin-bottom: 0;">
                            System Thresholds & Limits
                        </h5>
                    `;
                    grid.appendChild(title);

                    thresholds.forEach(item => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = createCard(item);
                        grid.appendChild(tempDiv.firstElementChild);
                    });
                }

                // Set up save event listeners
                grid.querySelectorAll('.btn-save-setting-trigger').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const k = e.target.getAttribute('data-key');
                        const input = e.target.previousElementSibling;
                        const v = parseInt(input.value);

                        confirmAction('Update Setting', `Are you sure you want to change ${k} to ${v}?`, async () => {
                            try {
                                const saveRes = await fetch('/api/admin/settings', {
                                    method: 'POST',
                                    headers: getAdminHeaders(),
                                    body: JSON.stringify({ key: k, value: v, setting_name: k, setting_value: v })
                                });
                                const saveData = await saveRes.json();
                                if (saveData.success) {
                                    loadPointsSettings();
                                } else {
                                    alert(saveData.error || 'Failed to update setting.');
                                }
                            } catch (err) {
                                alert('Error updating setting.');
                            }
                        });
                    });
                });
            } else {
                grid.innerHTML = '<div class="col-12"><p class="text-danger small">Failed to load settings.</p></div>';
            }
        } catch (e) {
            console.error('[settings.js] loadPointsSettings error:', e);
            grid.innerHTML = '<div class="col-12"><p class="text-danger small">Error connecting to server.</p></div>';
        }
    }

    async function loadLogs() {
        const qList = document.getElementById('maintenance-queue-list');
        const hList = document.getElementById('honesty-logs-list');
        if (!qList || !hList) return;

        // Fetch Maintenance Queue
        try {
            const res = await fetch('/api/admin/maintenance', { headers: getAdminHeaders() });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                qList.innerHTML = data.data.map(b => {
                    const badgeClass = b.condition_status === 'Pending_Delivery' ? 'bg-warning text-dark' : 'bg-danger';
                    const cleanStatus = b.condition_status.replace('_', ' ');

                    let actionHtml = '';
                    if (b.condition_status === 'Pending_Delivery') {
                        const buttonsBlock = `
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 6px;">Verify Volunteer Delivery:</div>
                            <div class="d-flex gap-2" style="max-width: 200px;">
                                <button class="btn btn-sm btn-success flex-fill btn-resolve-delivery" data-verdict="approve" data-bike="${b.bicycle_code}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Approve</button>
                                <button class="btn btn-sm btn-danger flex-fill btn-resolve-delivery" data-verdict="reject" data-bike="${b.bicycle_code}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Reject</button>
                            </div>
                            <label class="d-flex align-items-center gap-2 mt-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer;">
                                <input type="checkbox" class="waive-penalty-checkbox-delivery" data-bike="${b.bicycle_code}">
                                Waive false report penalty on reject
                            </label>
                        `;

                        if (b.dispute_image_url) {
                            actionHtml = `
                                <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                    ${buttonsBlock}
                                </div>
                            `;
                        } else {
                            actionHtml = `
                                <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Photo not yet uploaded</span>
                                        <label class="d-flex align-items-center gap-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer; user-select: none;">
                                            <input type="checkbox" onchange="const el = this.closest('.maintenance-card').querySelector('.mq-hidden-actions'); if(el) el.style.display = this.checked ? 'block' : 'none';">
                                            Verify Without Photo
                                        </label>
                                    </div>
                                    <div class="mq-hidden-actions mt-2 pt-2 border-top" style="display: none; border-top: 1px dashed var(--border) !important;">
                                        ${buttonsBlock}
                                    </div>
                                </div>
                            `;
                        }
                    } else if (b.condition_status === 'Missing') {
                        if (b.dispute_reported_by) {
                            const targetPhone = b.last_user_phone || b.reporter_phone || '';
                            const buttonsBlock = `
                                <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 6px;">Resolve Missing Report:</div>
                                <div class="d-flex gap-2" style="max-width: 260px;">
                                    <button class="btn btn-sm btn-success flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="innocent" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Innocent</button>
                                    <button class="btn btn-sm btn-danger flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="guilty" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Guilty</button>
                                    <button class="btn btn-sm btn-secondary flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="neutral" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Neutral</button>
                                </div>
                                <label class="d-flex align-items-center gap-2 mt-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer;">
                                    <input type="checkbox" class="waive-penalty-checkbox-mq" data-bike="${b.bicycle_code}">
                                    Waive standard point penalty
                                </label>
                            `;

                            if (b.dispute_image_url) {
                                actionHtml = `
                                    <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                        ${buttonsBlock}
                                    </div>
                                `;
                            } else {
                                actionHtml = `
                                    <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                            <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Photo not yet uploaded</span>
                                            <label class="d-flex align-items-center gap-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer; user-select: none;">
                                                <input type="checkbox" onchange="const el = this.closest('.maintenance-card').querySelector('.mq-hidden-actions'); if(el) el.style.display = this.checked ? 'block' : 'none';">
                                                Settle Without Photo
                                            </label>
                                        </div>
                                        <div class="mq-hidden-actions mt-2 pt-2 border-top" style="display: none; border-top: 1px dashed var(--border) !important;">
                                            ${buttonsBlock}
                                        </div>
                                    </div>
                                `;
                            }
                        } else {
                            actionHtml = `
                                <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                                        Missing (Resolved / Awaiting Recovery)
                                    </div>
                                </div>
                            `;
                        }
                    } else if (!b.dispute_reported_by) {
                        actionHtml = `
                            <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                                    Awaiting Repair
                                </div>
                            </div>
                        `;
                    } else {
                        const targetPhone = b.last_user_phone || b.reporter_phone || '';
                        const buttonsBlock = `
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 6px;">Resolve Dispute / Settle Report:</div>
                            <div class="d-flex gap-2" style="max-width: 260px;">
                                <button class="btn btn-sm btn-success flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="innocent" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Innocent</button>
                                <button class="btn btn-sm btn-danger flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="guilty" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Guilty</button>
                                <button class="btn btn-sm btn-secondary flex-fill btn-resolve-mq" data-status="${b.condition_status}" data-verdict="neutral" data-bike="${b.bicycle_code}" data-phone="${targetPhone}" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Neutral</button>
                            </div>
                            <label class="d-flex align-items-center gap-2 mt-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer;">
                                <input type="checkbox" class="waive-penalty-checkbox-mq" data-bike="${b.bicycle_code}">
                                Waive standard point penalty
                            </label>
                        `;

                        if (b.dispute_image_url) {
                            actionHtml = `
                                <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                    ${buttonsBlock}
                                </div>
                            `;
                        } else {
                            actionHtml = `
                                <div class="mt-2 pt-2 border-top" style="border-top: 1px dashed var(--border) !important;">
                                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Photo not yet uploaded</span>
                                        <label class="d-flex align-items-center gap-2 mb-0" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer; user-select: none;">
                                            <input type="checkbox" onchange="const el = this.closest('.maintenance-card').querySelector('.mq-hidden-actions'); if(el) el.style.display = this.checked ? 'block' : 'none';">
                                            Settle Without Photo
                                        </label>
                                    </div>
                                    <div class="mq-hidden-actions mt-2 pt-2 border-top" style="display: none; border-top: 1px dashed var(--border) !important;">
                                        ${buttonsBlock}
                                    </div>
                                </div>
                            `;
                        }
                    }

                    const photoLabel = b.condition_status === 'Pending_Delivery' ? 'Delivery Photo:' : 'Dispute Appeal Photo:';

                    return `
                        <div class="d-flex flex-column gap-2 p-3 border rounded shadow-sm mb-3 maintenance-card" style="background-color: var(--bg-panel); color: var(--text-h); border-color: var(--border) !important;">
                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                                <div class="d-flex flex-column flex-grow-1" style="min-width: 0;">
                                    <div class="d-flex align-items-center gap-2 mb-1">
                                        <strong style="font-size: 1rem;">Bike #${b.bicycle_code}</strong>
                                        <span class="badge ${badgeClass}" style="font-size: 0.75rem;">${cleanStatus}</span>
                                    </div>
                                    <div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Location: <b>${b.new_location || 'Unknown'}</b></div>
                                    ${(() => {
                                        if (b.condition_status === 'Pending_Delivery') {
                                            return `
                                                ${b.last_user_phone && b.last_user_phone !== b.reporter_phone ? `<div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Previous Borrower: <b>${b.last_user_name ? `${b.last_user_name} (${b.last_user_phone})` : b.last_user_phone}</b></div>` : ''}
                                                <div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Delivered By (Volunteer): <b>${b.reporter_name ? `${b.reporter_name} (${b.reporter_phone || ''})` : (b.reporter_phone || 'Unknown')}</b></div>
                                            `;
                                        } else if (b.condition_status === 'Missing') {
                                            return `
                                                ${b.last_user_phone ? `<div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Previous Borrower: <b>${b.last_user_name ? `${b.last_user_name} (${b.last_user_phone})` : b.last_user_phone}</b></div>` : ''}
                                                ${b.reporter_phone && b.reporter_phone !== b.last_user_phone ? `<div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Reported Missing By: <b>${b.reporter_name ? `${b.reporter_name} (${b.reporter_phone})` : b.reporter_phone}</b></div>` : ''}
                                            `;
                                        } else if (b.reporter_phone && b.last_user_phone && b.reporter_phone !== b.last_user_phone) {
                                            return `
                                                <div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Previous Borrower: <b>${b.last_user_name ? `${b.last_user_name} (${b.last_user_phone})` : b.last_user_phone}</b></div>
                                                <div class="small" style="color: var(--text-muted); margin-bottom: 2px;">Reported Broken By: <b>${b.reporter_name ? `${b.reporter_name} (${b.reporter_phone})` : b.reporter_phone}</b></div>
                                            `;
                                        } else {
                                            return `
                                                <div class="small" style="color: var(--text-muted); margin-bottom: 2px;">${b.dispute_reported_by ? 'Reported Broken By' : 'Last Borrower'}: <b>${b.last_user_name ? `${b.last_user_name} (${b.last_user_phone || ''})` : (b.last_user_phone || b.reporter_phone || 'Unknown')}</b></div>
                                            `;
                                        }
                                    })()}
                                    <div class="small mb-1" style="color: var(--text-muted);">Reported Time: <b>${b.last_activity ? new Date(b.last_activity).toLocaleString() : 'Unknown'}</b></div>
                                </div>
                                ${b.dispute_image_url ? `
                                    <div class="d-flex flex-column align-items-center align-items-md-end justify-content-center flex-shrink-0 ms-md-auto text-md-end" style="min-width: 140px;">
                                        <div style="font-size: 0.7rem; font-weight: 600; margin-bottom: 4px; color: var(--text-muted); text-align: center;">${photoLabel}</div>
                                        <a href="${b.dispute_image_url}" target="_blank" class="d-block text-center">
                                            <img src="${b.dispute_image_url}" style="width: 140px; height: 140px; border-radius: 8px; border: 1px solid var(--border); object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" alt="Delivery proof" />
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="w-100">
                                ${actionHtml}
                            </div>
                        </div>
                    `;
                }).join('');

                // Attach event listeners for inline dispute resolution in Maintenance Queue
                qList.querySelectorAll('.btn-resolve-mq').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const verdict = btn.getAttribute('data-verdict');
                        const bikeCode = btn.getAttribute('data-bike');
                        const status = btn.getAttribute('data-status');
                        const card = btn.closest('.maintenance-card');
                        const waiveCheckbox = card ? card.querySelector('.waive-penalty-checkbox-mq') : null;
                        const phoneNumber = btn.getAttribute('data-phone') || '';

                        if (!phoneNumber) {
                            return alert("Error: Reported user's phone number is missing!");
                        }

                        let confirmTitle = 'Resolve Dispute';
                        let confirmText = `Mark user (${phoneNumber}) as ${verdict.toUpperCase()} for bike #${bikeCode}?`;

                        if (status === 'Missing') {
                            if (verdict === 'guilty') {
                                confirmTitle = 'Mark Guilty (Missing)';
                                confirmText = `Are you sure you want to mark the borrower (${phoneNumber}) GUILTY of losing Bike #${bikeCode}? The borrower will be penalized.`;
                            } else if (verdict === 'innocent') {
                                confirmTitle = 'Mark Innocent (Missing)';
                                confirmText = `Are you sure you want to mark the borrower (${phoneNumber}) INNOCENT for Bike #${bikeCode}? No points deducted from borrower.`;
                            } else {
                                confirmTitle = 'Mark Neutral (External Factor)';
                                confirmText = `Are you sure you want to resolve Bike #${bikeCode} as NEUTRAL (external factor)? No points deducted from borrower, and reporter receives honest report reward.`;
                            }
                        }

                        confirmAction(confirmTitle, confirmText, async () => {
                            try {
                                const res = await fetch('/api/admin/resolve-dispute', {
                                    method: 'POST',
                                    headers: getAdminHeaders(),
                                    body: JSON.stringify({
                                        phone_number: phoneNumber,
                                        verdict: verdict,
                                        bicycle_code: bikeCode,
                                        waive_penalty: waiveCheckbox ? waiveCheckbox.checked : false
                                    })
                                });
                                const resolveData = await res.json();
                                if (resolveData.success) {
                                    alert(resolveData.message);
                                    loadLogs(); // Reload report logs
                                    renderMembersList(); // Refresh member list
                                    if (window.initDashboard) window.initDashboard(); // Refresh bikes grid
                                } else {
                                    alert(resolveData.error || "Failed to resolve dispute.");
                                }
                            } catch (err) {
                                alert("Error resolving dispute.");
                            }
                        });
                    });
                });

                // Attach event listeners for volunteer delivery verification
                qList.querySelectorAll('.btn-resolve-delivery').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const verdict = btn.getAttribute('data-verdict');
                        const bikeCode = btn.getAttribute('data-bike');
                        const card = btn.closest('.maintenance-card');
                        const waiveCheckbox = card ? card.querySelector('.waive-penalty-checkbox-delivery') : null;

                        confirmAction('Verify Delivery', `Are you sure you want to ${verdict} the volunteer delivery of Bike #${bikeCode}?`, async () => {
                            try {
                                const res = await fetch('/api/admin/resolve-delivery', {
                                    method: 'POST',
                                    headers: getAdminHeaders(),
                                    body: JSON.stringify({
                                        bicycle_code: bikeCode,
                                        verdict: verdict,
                                        waive_penalty: waiveCheckbox ? waiveCheckbox.checked : false
                                    })
                                });
                                const resolveData = await res.json();
                                if (resolveData.success) {
                                    alert(resolveData.message);
                                    loadLogs();
                                    renderMembersList();
                                    if (window.initDashboard) window.initDashboard(); // Refresh bikes grid
                                } else {
                                    alert(resolveData.error || "Failed to resolve delivery.");
                                }
                            } catch (err) {
                                alert("Error resolving delivery.");
                            }
                        });
                    });
                });

                // Attach event listeners for marking settled bikes as repaired/available
                qList.querySelectorAll('.btn-mark-repaired').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const bikeCode = btn.getAttribute('data-bike');
                        confirmAction('Mark Repaired / Available', `Mark Bike #${bikeCode} as repaired and ready for use?`, async () => {
                            try {
                                const res = await fetch('/api/admin/bicycles/override', {
                                    method: 'POST',
                                    headers: getAdminHeaders(),
                                    body: JSON.stringify({
                                        bicycle_code: bikeCode,
                                        condition_status: 'Good'
                                    })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    alert('Bike marked as repaired and available!');
                                    loadLogs();
                                    if (window.initDashboard) window.initDashboard();
                                } else {
                                    alert(data.error || 'Failed to update bicycle.');
                                }
                            } catch (err) {
                                alert('Error updating bicycle status.');
                            }
                        });
                    });
                });
            } else {
                qList.innerHTML = '<div class="text-muted small">No broken bikes.</div>';
            }
        } catch (e) { qList.innerHTML = 'Error loading.'; }

        // Fetch Honesty Logs
        try {
            const res = await fetch('/api/admin/honesty', { headers: getAdminHeaders() });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                hList.innerHTML = data.data.map(log => {
                    const formattedDate = new Date(log.DateTime).toLocaleString();
                    let actionColor = '#4a6b82'; // muted slate blue
                    if (log.Request === 'False Report Penalty') actionColor = '#803a3a'; // muted dusky burgundy/maroon
                    else if (log.Request === 'Missing Report') actionColor = '#945d2e'; // muted warm bronze
                    else if (log.Request === 'Broken Report') actionColor = '#824462'; // muted dusky plum
                    else if (log.Request === 'Delivered for Repair') actionColor = '#3e6b42'; // muted forest green
                    return `<div class="d-flex flex-column p-3 border rounded shadow-sm mb-2" style="background-color: var(--bg-panel); color: var(--text-h); border-color: var(--border) !important;">
                        <strong>👤 ${log.FirstName || ''} ${log.LastName || ''} (${log.MobileNumber || log.SenderNumber})</strong>
                        <div class="fw-bold small mt-1" style="color: ${actionColor};">Action: ${log.Request}</div>
                        <div class="small mt-1" style="color: var(--text-muted);">Time: ${formattedDate}</div>
                    </div>`;
                }).join('');
            } else {
                hList.innerHTML = '<div class="text-muted small">No honesty logs.</div>';
            }
        } catch (e) { hList.innerHTML = 'Error loading.'; }
    }

    // Check login state
    function checkSession(forceShowAdmin = false) {
        const token = sessionStorage.getItem('adminToken');
        const role = sessionStorage.getItem('userRole') || 'admin';

        if (!token) {
            window.location.href = '/';
            return;
        }

        if (role === 'student') {
            window.location.href = '/student-dashboard.html';
            return;
        }

        const settingsModalCard = document.getElementById('settings-modal-card');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const studentDashboardContainer = document.getElementById('student-dashboard-container');

        if (token) {
            if (loginView) {
                loginView.classList.add('d-none');
                loginView.classList.remove('d-flex');
            }
            if (btnLogout) {
                btnLogout.style.display = 'flex';
            }

            if (role === 'student') {
                // --- STUDENT ROUTING ---
                if (adminView) {
                    adminView.classList.add('d-none');
                    adminView.style.display = 'none';
                }
                if (settingsModalCard) settingsModalCard.classList.remove('admin-active');

                // Hide modal and show student dashboard
                if (settingsContainer) settingsContainer.style.display = 'none';
                hideAllViews();
                if (studentDashboardContainer) studentDashboardContainer.style.display = 'block';

                // Trigger fake gauge animation and dynamic color
                setTimeout(() => {
                    const circle = document.getElementById('trust-score-circle');
                    const text = document.getElementById('trust-score-text');
                    const msg = document.getElementById('trust-score-msg');
                    if (circle && text && msg) {
                        const fakeScore = 85;
                        const max = 120;
                        const offset = 283 - (283 * (fakeScore / max));
                        circle.style.strokeDashoffset = offset;
                        text.textContent = fakeScore;

                        // Dynamic coloring
                        if (fakeScore >= 90) {
                            circle.style.stroke = 'var(--up-green, #006a4e)';
                            msg.textContent = 'Excellent standing! Keep it up.';
                        } else if (fakeScore >= 60) {
                            circle.style.stroke = '#eab308'; // Yellow
                            msg.textContent = 'Great standing! You can borrow bikes anytime.';
                        } else {
                            circle.style.stroke = '#ef4444'; // Red
                            msg.textContent = 'Warning: Trust score is too low.';
                        }
                    }
                }, 500);

                // Fake Timer Interval (starts at 01:15:30)
                const timerEl = document.getElementById('active-ride-timer');
                if (timerEl) {
                    let seconds = 4530;
                    if (window.studentTimerInterval) clearInterval(window.studentTimerInterval);
                    window.studentTimerInterval = setInterval(() => {
                        seconds++;
                        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
                        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
                        const s = String(seconds % 60).padStart(2, '0');
                        timerEl.textContent = `${h}:${m}:${s}`;
                    }, 1000);
                }

            } else {
                // --- ADMIN ROUTING ---
                if (adminView) {
                    adminView.classList.remove('d-none');
                    adminView.style.display = 'block';
                }
                if (settingsModalCard) settingsModalCard.classList.add('admin-active');

                // If they clicked the settings tab explicitly, show the modal. Otherwise hide it.
                if (forceShowAdmin) {
                    if (settingsContainer) {
                        settingsContainer.style.display = 'flex';
                        settingsContainer.style.background = 'rgba(11, 15, 25, 0.6)';
                        settingsContainer.style.backdropFilter = 'blur(8px)';
                    }
                    if (btnCloseSettings) btnCloseSettings.style.display = 'flex';
                } else {
                    if (settingsContainer) settingsContainer.style.display = 'none';
                }

                if (heroMap) heroMap.style.display = 'block';
                if (dashboardGrid) dashboardGrid.style.display = 'block';
                loadAdminPanel();
            }
        } else {
            if (loginView) {
                loginView.classList.remove('d-none');
                loginView.classList.add('d-flex');
            }
            if (adminView) {
                adminView.classList.add('d-none');
                adminView.style.display = 'none';
            }
            if (btnLogout) {
                btnLogout.style.display = 'none';
            }
            if (settingsModalCard) settingsModalCard.classList.remove('admin-active');

            // Force solid background full screen login and hide close button
            if (settingsContainer) {
                settingsContainer.style.display = 'flex';
                settingsContainer.style.background = 'var(--bg-main)';
                settingsContainer.style.backdropFilter = 'none';
            }
            if (btnCloseSettings) btnCloseSettings.style.display = 'none';
        }
    }

    // Handle Login Submit
    async function handleLogin() {
        loginError.style.display = 'none';
        const btnText = document.getElementById('login-btn-text');
        const btnIcon = document.getElementById('login-success-icon');
        const originalBtnText = btnText ? btnText.textContent : 'Sign In';

        try {
            if (btnLoginSubmit) {
                btnLoginSubmit.disabled = true;
                if (btnText) btnText.textContent = 'Authenticating...';
            }

            let res, data;

            if (isStudentLogin) {
                // --- 1. STUDENT LOGIN LOGIC ---
                const studentPhoneInput = document.getElementById('student-phone');
                const phone = studentPhoneInput ? studentPhoneInput.value.trim() : '';

                if (!phone) {
                    throw new Error("Mobile number is required.");
                }

                // Auto-format phone number to +639XXXXXXXXX
                let formattedPhone = phone;
                if (formattedPhone.startsWith('09') && formattedPhone.length === 11) {
                    formattedPhone = '+63' + formattedPhone.substring(1);
                } else if (formattedPhone.startsWith('9') && formattedPhone.length === 10) {
                    formattedPhone = '+63' + formattedPhone;
                } else if (formattedPhone.startsWith('639') && formattedPhone.length === 12) {
                    formattedPhone = '+' + formattedPhone;
                }

                res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone_number: formattedPhone })
                });
                data = await res.json();
            } else {
                // --- 2. ADMIN CREDENTIALS LOGIC ---
                const username = loginUsername.value.trim();
                const password = loginPassword.value;

                if (!username || !password) {
                    throw new Error("Username and password are required.");
                }

                res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                data = await res.json();
            }

            if (data.success) {
                sessionStorage.setItem('adminToken', data.token);
                // Also save the role if the backend provided it, else default to 'admin'
                if (isStudentLogin) {
                    sessionStorage.setItem('userRole', 'student');
                } else {
                    sessionStorage.setItem('userRole', data.role || 'admin');
                }

                // Success feedback UI
                if (btnLoginSubmit) {
                    btnLoginSubmit.style.backgroundColor = 'var(--up-green)';
                    if (btnText) btnText.textContent = 'Login Successful!';
                    if (btnIcon) btnIcon.style.display = 'block';
                }

                setTimeout(() => {
                    const role = sessionStorage.getItem('userRole');
                    if (role === 'student') {
                        window.location.href = '/student-dashboard.html';
                    } else {
                        checkSession();
                        // Reset button for future logouts
                        if (btnLoginSubmit) {
                            btnLoginSubmit.disabled = false;
                            btnLoginSubmit.style.backgroundColor = '';
                            if (btnText) btnText.textContent = originalBtnText;
                            if (btnIcon) btnIcon.style.display = 'none';
                        }
                    }
                }, 800);
            } else {
                throw new Error(data.error || 'Authentication failed.');
            }
        } catch (err) {
            console.error('[settings.js] Login error:', err);
            if (btnLoginSubmit) {
                btnLoginSubmit.disabled = false;
                if (btnText) btnText.textContent = originalBtnText;
            }
            // Show the exact error message (e.g. "Mobile number is required.")
            loginError.textContent = err.message || 'Server connection error. Please try again.';
            loginError.style.display = 'block';
        }
    }

    btnLoginSubmit.addEventListener('click', handleLogin);

    // Support login on pressing Enter
    loginUsername.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

    // Handle Logout (Custom Modal)
    if (btnLogout) {
        const logoutModal = document.getElementById('logout-confirm-modal');
        const btnLogoutCancel = document.getElementById('btn-logout-cancel');
        const btnLogoutConfirm = document.getElementById('btn-logout-confirm');

        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (logoutModal) {
                logoutModal.style.display = 'flex';
            } else {
                // Fallback to default confirm if modal is missing
                if (confirm("Are you sure you want to log out?")) {
                    sessionStorage.removeItem('adminToken');
                    sessionStorage.removeItem('userRole');
                    checkSession();
                }
            }
        });

        if (btnLogoutCancel) {
            btnLogoutCancel.addEventListener('click', () => {
                if (logoutModal) logoutModal.style.display = 'none';
            });
        }

        if (btnLogoutConfirm) {
            btnLogoutConfirm.addEventListener('click', () => {
                if (logoutModal) logoutModal.style.display = 'none';
                sessionStorage.removeItem('adminToken');
                sessionStorage.removeItem('userRole');
                checkSession();
            });
        }
    }

    // Helper: Build Admin Headers
    function getAdminHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
        };
    }

    // Populate and refresh Admin Panel data
    async function loadAdminPanel() {
        console.log('[settings.js] loadAdminPanel called');
        addBikeMsg.style.display = 'none';
        addBikeMsg.className = '';
        addBikeMsg.style.background = 'none';
        addBikeMsg.style.border = 'none';

        addStationMsg.style.display = 'none';
        addStationMsg.className = '';
        addStationMsg.style.background = 'none';
        addStationMsg.style.border = 'none';

        await Promise.all([
            populateLocationDropdowns(),
            renderStationToggles(),
            renderBikeOverrides(),
            renderMembersList()
        ]);
    }

    // Populate Initial Station dropdown for new bikes
    async function populateLocationDropdowns() {
        console.log('[settings.js] populateLocationDropdowns started');
        newBikeLocation.innerHTML = '';

        let locations = [];
        try {
            const res = await fetch('/api/locations');
            const data = await res.json();
            console.log('[settings.js] populateLocationDropdowns fetched:', data);
            if (data.success) locations = data.data;
        } catch (e) {
            console.error('[settings.js] Failed to fetch locations for dropdown:', e);
        }

        let addedCount = 0;
        locations.forEach(loc => {
            const isDisabled = loc.is_disabled === 1 || loc.is_disabled === true || String(loc.is_disabled).toLowerCase() === 'true';
            if (!isDisabled) {
                const opt = document.createElement('option');
                opt.value = loc.location_name;
                const displayName = loc.location_name.toUpperCase();
                opt.textContent = displayName;
                newBikeLocation.appendChild(opt);
                addedCount++;
            }
        });
        if (addedCount === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'NO ACTIVE STATIONS';
            opt.disabled = true;
            opt.selected = true;
            newBikeLocation.appendChild(opt);
        }
        console.log(`[settings.js] populateLocationDropdowns populated ${locations.length} options`);
    }

    // Render Station toggles inside admin dashboard
    async function renderStationToggles() {
        console.log('[settings.js] renderStationToggles started');
        stationToggleList.innerHTML = '';

        let locations = [];
        try {
            const res = await fetch('/api/locations');
            const data = await res.json();
            console.log('[settings.js] renderStationToggles fetched:', data);
            if (data.success) locations = data.data;
        } catch (e) {
            console.error('[settings.js] Failed to fetch locations for status panel:', e);
        }

        if (locations.length === 0) {
            stationToggleList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding: 10px; text-align: center;">No locations found.</div>';
            console.log('[settings.js] renderStationToggles: locations list is empty');
            return;
        }

        locations.forEach(loc => {
            const stationName = loc.location_name;
            const isDisabled = loc.is_disabled === 1 || loc.is_disabled === true;

            const div = document.createElement('div');
            div.className = 'd-flex flex-column gap-2 p-3 border rounded mb-2';
            div.style.background = 'var(--bg-main)';

            const checkboxId = `toggle-${stationName.replace(/\s+/g, '-').toLowerCase()}`;

            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center pb-1">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold" style="font-size: 0.95rem;">${stationName.toUpperCase()}</span>
                        <span class="toggle-switch-status ${isDisabled ? 'offline' : 'online'}" style="font-size: 0.75rem; font-weight: 600;">
                            ${isDisabled ? '● Offline' : '● Online'}
                        </span>
                    </div>
                    <label class="switch-label mb-0" for="${checkboxId}">
                        <input type="checkbox" id="${checkboxId}" ${!isDisabled ? 'checked' : ''}>
                        <span class="switch-slider"></span>
                    </label>
                </div>

                <div class="mt-1 pt-2 border-top d-flex justify-content-end">
                    <button class="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center gap-1 btn-delete-station" data-station="${stationName}">
                        Delete
                    </button>
                </div>
            `;

            const btnDelete = div.querySelector('.btn-delete-station');
            btnDelete.addEventListener('click', async () => {
                confirmAction('Delete Station', `Are you absolutely sure you want to delete station ${stationName}?`, async () => {
                    try {
                        const res = await fetch('/api/admin/delete-location', {
                            method: 'POST',
                            headers: getAdminHeaders(),
                            body: JSON.stringify({ location_name: stationName })
                        });
                        const data = await res.json();
                        if (data.success) {
                            div.remove();
                            if (window.initDashboard) await window.initDashboard();
                            await populateLocationDropdowns();
                            await renderBikeOverrides();
                        } else {
                            alert('Failed to delete station.');
                        }
                    } catch (e) {
                        alert('Error deleting station.');
                    }
                });
            });

            const checkbox = div.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', async () => {
                try {
                    const res = await fetch('/api/admin/locations/toggle', {
                        method: 'POST',
                        headers: getAdminHeaders(),
                        body: JSON.stringify({
                            location_name: stationName,
                            is_disabled: !checkbox.checked
                        })
                    });

                    if (!res.ok && res.status !== 500 && res.status !== 400 && res.status !== 404) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }

                    const data = await res.json();
                    if (data.success) {
                        // Update the local visual state
                        const statusSpan = div.querySelector('.toggle-switch-status');
                        if (checkbox.checked) {
                            statusSpan.className = 'toggle-switch-status online';
                            statusSpan.innerHTML = '● Online';
                        } else {
                            statusSpan.className = 'toggle-switch-status offline';
                            statusSpan.innerHTML = '● Offline';
                        }

                        if (window.initDashboard) {
                            await window.initDashboard();
                        }
                        await populateLocationDropdowns();
                        await renderBikeOverrides();
                    } else {
                        alert(data.error || 'Failed to toggle station status.');
                        checkbox.checked = !checkbox.checked;
                    }
                } catch (e) {
                    console.error('[settings.js] Error toggling station:', e);
                    alert(`Server Error: ${e.message}\n\nPlease restart your Node.js backend server so it can load the new database logic we just pushed!`);
                    checkbox.checked = !checkbox.checked;
                }
            });

            stationToggleList.appendChild(div);
        });
    }

    async function renderBikeOverrides() {
        const list = document.getElementById('bike-override-list');
        if (!list) return;
        list.innerHTML = '';

        let bikes = [];
        let locations = window.allLocations || [];
        try {
            const [resBikes, resLocs] = await Promise.all([
                fetch('/api/bicycles', { cache: 'no-store' }),
                fetch('/api/locations', { cache: 'no-store' })
            ]);
            const dataBikes = await resBikes.json();
            const dataLocs = await resLocs.json();
            if (dataBikes.success) bikes = dataBikes.data;
            if (dataLocs.success) {
                locations = dataLocs.data;
                window.allLocations = locations;
            }
        } catch (e) {
            console.error('[settings.js] Error fetching bikes/locations:', e);
            list.innerHTML = '<div class="text-danger small">Failed to load bicycles.</div>';
            return;
        }

        if (bikes.length === 0) {
            list.innerHTML = '<div class="text-muted small">No bicycles registered.</div>';
            return;
        }

        bikes.forEach(bike => {
            const code = bike.bicycle_code;
            const isDisabled = bike.is_disabled === 1;

            let locationOptionsHtml = '';
            let addedCount = 0;
            locations.forEach(loc => {
                const isLocDisabled = loc.is_disabled === 1 || loc.is_disabled === true || String(loc.is_disabled).toLowerCase() === 'true';
                const isSelected = bike.new_location === loc.location_name;
                if (!isLocDisabled || isSelected) {
                    const label = loc.location_name.toUpperCase() + (isLocDisabled ? ' (OFFLINE)' : '');
                    const disabledAttr = isLocDisabled && !isSelected ? 'disabled' : '';
                    locationOptionsHtml += `<option value="${loc.location_name}" ${isSelected ? 'selected' : ''} ${disabledAttr}>${label}</option>`;
                    addedCount++;
                }
            });
            if (addedCount === 0) {
                locationOptionsHtml = `<option value="${bike.new_location || ''}" selected>${(bike.new_location || 'UNKNOWN').toUpperCase()}</option>`;
            }

            const div = document.createElement('div');
            div.className = 'd-flex flex-column gap-2 p-3 border rounded mb-2 bike-override-item';
            div.style.background = 'var(--bg-main)';
            div.dataset.bikeCode = code;
            div.dataset.origStatus = bike.condition_status || 'Good';
            div.dataset.origLocation = bike.new_location || '';

            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1 border-bottom pb-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold" style="font-size: 0.95rem;">Bike ${code}</span>
                        <span class="toggle-switch-status ${!isDisabled ? 'online' : 'offline'}" style="font-size: 0.75rem; font-weight: 600;">
                            ${!isDisabled ? '● Online' : '● Offline'}
                        </span>
                    </div>
                    <label class="switch-label mb-0" for="toggle-bike-${code}">
                        <input type="checkbox" id="toggle-bike-${code}" ${!isDisabled ? 'checked' : ''}>
                        <span class="switch-slider"></span>
                    </label>
                </div>
                
                <div class="row g-2 align-items-end mt-1">
                    <div class="col-6 col-sm-4">
                        <label class="form-label small text-muted text-uppercase mb-1" style="font-size: 0.65rem;">New Lock Code</label>
                        <input type="text" class="form-control form-control-sm border-0 shadow-sm bike-lock-input" placeholder="0000">
                    </div>
                    <div class="col-6 col-sm-4">
                        <label class="form-label small text-muted text-uppercase mb-1" style="font-size: 0.65rem;">Status</label>
                        <select class="form-select form-select-sm border-0 shadow-sm bike-status-select">
                            <option value="Good" ${bike.condition_status === 'Good' ? 'selected' : ''}>Good</option>
                            <option value="Broken" ${bike.condition_status === 'Broken' ? 'selected' : ''}>Broken</option>
                            <option value="In_Repair" ${bike.condition_status === 'In_Repair' ? 'selected' : ''}>In Repair</option>
                            <option value="Disputed" ${bike.condition_status === 'Disputed' ? 'selected' : ''}>Disputed</option>
                            <option value="Missing" ${bike.condition_status === 'Missing' ? 'selected' : ''}>Missing</option>
                            <option value="Pending_Delivery" ${bike.condition_status === 'Pending_Delivery' ? 'selected' : ''}>Pending Delivery</option>
                        </select>
                    </div>
                    <div class="col-12 col-sm-4">
                        <label class="form-label small text-muted text-uppercase mb-1" style="font-size: 0.65rem;">Location</label>
                        <select class="form-select form-select-sm border-0 shadow-sm bike-location-select">
                            ${locationOptionsHtml}
                        </select>
                    </div>
                    <div class="col-12 mt-2">
                        <button class="btn btn-sm btn-primary w-100 fw-bold border-0 btn-save-bike" style="background-color: var(--up-maroon); height: 31px;">Save</button>
                    </div>
                </div>

                <div class="mt-2 pt-2 border-top d-flex justify-content-end">
                    <button class="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center gap-1 btn-delete-bike">
                        Delete
                    </button>
                </div>
            `;

            // Toggle logic
            const checkbox = div.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', async () => {
                try {
                    const res = await fetch('/api/admin/bicycles/toggle', {
                        method: 'POST',
                        headers: getAdminHeaders(),
                        body: JSON.stringify({
                            bicycle_code: code,
                            is_disabled: !checkbox.checked
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        const statusSpan = div.querySelector('.toggle-switch-status');
                        if (checkbox.checked) {
                            statusSpan.className = 'toggle-switch-status online';
                            statusSpan.innerHTML = '● Online';
                        } else {
                            statusSpan.className = 'toggle-switch-status offline';
                            statusSpan.innerHTML = '● Offline';
                        }
                    } else {
                        alert(data.error || 'Failed to toggle bike status.');
                        checkbox.checked = !checkbox.checked;
                    }
                } catch (e) {
                    console.error('[settings.js] Error toggling bike:', e);
                    alert('Network error toggling bike.');
                    checkbox.checked = !checkbox.checked;
                }
            });

            // Save logic
            const btnSave = div.querySelector('.btn-save-bike');
            const lockInput = div.querySelector('.bike-lock-input');
            const statusSelect = div.querySelector('.bike-status-select');
            const locationSelect = div.querySelector('.bike-location-select');
            btnSave.addEventListener('click', async () => {
                const payload = {};
                if (lockInput.value.trim() !== '') payload.combination_lock = lockInput.value.trim();
                if (statusSelect.value !== div.dataset.origStatus) payload.condition_status = statusSelect.value;
                if (locationSelect.value !== div.dataset.origLocation) payload.new_location = locationSelect.value;

                if (Object.keys(payload).length === 0) return alert('No changes to save.');

                confirmAction('Update Bicycle', `Are you sure you want to update bicycle ${code}?`, async () => {
                    btnSave.disabled = true;
                    btnSave.textContent = '...';
                    try {
                        const res = await fetch('/api/admin/bicycles/override', {
                            method: 'POST',
                            headers: getAdminHeaders(),
                            body: JSON.stringify({ bicycle_code: code, ...payload })
                        });
                        const data = await res.json();
                        if (data.success) {
                            lockInput.value = '';
                            bike.condition_status = statusSelect.value; // update local state
                            bike.new_location = locationSelect.value; // update local state
                            div.dataset.origStatus = statusSelect.value;
                            div.dataset.origLocation = locationSelect.value;
                            if (window.initDashboard) await window.initDashboard();
                        } else {
                            alert(data.error || 'Failed to update bike.');
                        }
                    } catch (e) {
                        alert('Network error.');
                    } finally {
                        btnSave.disabled = false;
                        btnSave.textContent = 'Save';
                    }
                });
            });

            // Delete logic
            const btnDelete = div.querySelector('.btn-delete-bike');
            btnDelete.addEventListener('click', async () => {
                confirmAction('Delete Bicycle', `Are you absolutely sure you want to delete bicycle ${code}?`, async () => {
                    btnDelete.disabled = true;
                    try {
                        const res = await fetch('/api/admin/delete-bike', {
                            method: 'POST',
                            headers: getAdminHeaders(),
                            body: JSON.stringify({ bicycle_code: code })
                        });
                        const data = await res.json();
                        if (data.success) {
                            div.remove();
                            if (window.initDashboard) await window.initDashboard();
                        } else {
                            alert(data.error || 'Failed to delete bike.');
                            btnDelete.disabled = false;
                        }
                    } catch (e) {
                        alert('Error deleting bike.');
                        btnDelete.disabled = false;
                    }
                });
            });

            list.appendChild(div);
        });
    }

    // Render the list of registered members in the admin panel
    async function renderMembersList() {
        if (!membersList) return;
        membersList.innerHTML = '';

        let members = [];
        try {
            const res = await fetch('/api/admin/members', {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                members = data.data;
                cachedMembers = data.data;
            }
        } catch (e) {
            console.error('[settings.js] Failed to fetch members list:', e);
        }

        if (members.length === 0) {
            membersList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding: 10px; text-align: center;">No registered members.</div>';
            return;
        }

        members.forEach(mem => {
            const isFrozen = mem.points_frozen == 1 || mem.points_frozen === true || mem.points_frozen === 'true';

            const div = document.createElement('div');
            div.className = 'member-item';
            div.dataset.phone = mem.phone_number || '';
            div.dataset.name = `${mem.firstname} ${mem.lastname}`.toLowerCase();
            div.style.background = 'var(--bg-main)';
            div.style.padding = '12px 18px';
            div.style.borderRadius = 'var(--radius-sm)';
            div.style.border = '1px solid var(--border)';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.flexWrap = 'wrap';
            div.style.gap = '10px';

            div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                    <!-- Row 1: Name and Badge -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex-grow: 1;">
                            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-h); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${mem.lastname}, ${mem.firstname}
                            </span>
                            ${isFrozen ? '<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; flex-shrink: 0; line-height: 1;">FROZEN</span>' : ''}
                        </div>
                    </div>

                    <!-- Row 2: Contact Info & Points -->
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">
                        ${mem.phone_number} | Trust Points: <strong style="color: ${mem.trust_points < 50 ? '#ef4444' : 'inherit'};">${mem.trust_points}</strong>
                    </div>

                    <!-- Row 3: Action Buttons -->
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; border-top: 1px solid var(--border); padding-top: 8px; align-items: center;">
                        <button class="btn btn-sm btn-outline-success fw-bold" onclick="editMemberPoints('${mem.phone_number}', ${mem.trust_points})" style="font-size: 0.68rem; padding: 4px 8px; white-space: nowrap; height: 28px;">
                            Add Points
                        </button>
                        ${(mem.is_active === 0 || mem.is_active === false || mem.is_active === '0') ? `
                            <button class="btn btn-sm btn-outline-primary fw-bold" onclick="activateMember('${mem.phone_number}')" style="font-size: 0.68rem; padding: 4px 8px; white-space: nowrap; height: 28px;">
                                Activate
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline-danger fw-bold" onclick="deactivateMember('${mem.phone_number}')" style="font-size: 0.68rem; padding: 4px 8px; white-space: nowrap; height: 28px;">
                                Deactivate
                            </button>
                        `}
                        <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center" onclick="hardDeleteMember('${mem.phone_number}')" title="Delete Member" style="width: 28px; height: 28px; padding: 0;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            // If the user is frozen, we inject the Dispute Resolution UI directly into their card!
            if (isFrozen) {
                const actionDiv = document.createElement('div');
                actionDiv.style.display = 'flex';
                actionDiv.style.flexDirection = 'column';
                actionDiv.style.gap = '5px';
                actionDiv.style.width = '100%';
                actionDiv.style.marginTop = '4px';
                actionDiv.style.paddingTop = '8px';
                actionDiv.style.borderTop = '1px dashed var(--border)';

                actionDiv.innerHTML = `
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px;">Resolve Dispute (Enter Disputed Bike Code):</div>
                    <div class="d-flex flex-column flex-sm-row gap-2 align-items-stretch align-items-sm-center">
                        <input type="text" class="form-control settings-input flex-grow-1" placeholder="Bike Code" style="height: 32px; font-size: 0.75rem; min-width: 70px;">
                        <div class="d-flex gap-1 flex-grow-1">
                            <button class="btn btn-sm btn-success flex-fill btn-innocent" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Innocent</button>
                            <button class="btn btn-sm btn-danger flex-fill btn-guilty" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Guilty</button>
                            <button class="btn btn-sm btn-secondary flex-fill btn-neutral" style="font-size: 0.7rem; font-weight: 700; height: 32px; padding: 2px 8px;">Neutral</button>
                        </div>
                    </div>
                    <label class="d-flex align-items-center gap-2 mt-2" style="font-size: 0.7rem; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="waive-penalty-checkbox">
                        Waive standard point penalty
                    </label>
                `;

                const bikeInput = actionDiv.querySelector('input[type="text"]');
                const waiveCheckbox = actionDiv.querySelector('.waive-penalty-checkbox');
                const btnInnocent = actionDiv.querySelector('.btn-innocent');
                const btnGuilty = actionDiv.querySelector('.btn-guilty');
                const btnNeutral = actionDiv.querySelector('.btn-neutral');

                const handleResolve = async (verdict) => {
                    const bikeCode = bikeInput.value.trim();
                    if (!bikeCode) return alert("Please enter the Disputed Bike Code first!");

                    confirmAction('Resolve Dispute', `Mark user ${mem.firstname} as ${verdict} for bike ${bikeCode}?`, async () => {
                        try {
                            const res = await fetch('/api/admin/resolve-dispute', {
                                method: 'POST',
                                headers: getAdminHeaders(),
                                body: JSON.stringify({ phone_number: mem.phone_number, verdict: verdict, bicycle_code: bikeCode, waive_penalty: waiveCheckbox.checked })
                            });
                            const data = await res.json();
                            if (data.success) {
                                alert(data.message);
                                renderMembersList(); // Refresh member list to remove FROZEN badge
                                if (window.initDashboard) window.initDashboard(); // Refresh bikes grid to remove DISPUTED border
                            } else {
                                alert(data.error);
                            }
                        } catch (e) {
                            alert("Error resolving dispute.");
                        }
                    });
                };

                btnInnocent.addEventListener('click', () => handleResolve('innocent'));
                btnGuilty.addEventListener('click', () => handleResolve('guilty'));
                btnNeutral.addEventListener('click', () => handleResolve('neutral'));

                div.appendChild(actionDiv);
            }

            membersList.appendChild(div);
        });
    }

    // Add Bicycle Form Submit
    btnAddBike.addEventListener('click', () => {
        const code = newBikeCode.value.trim();
        const lock = newBikeLock.value.trim();
        const loc = newBikeLocation.value;

        addBikeMsg.style.display = 'none';

        if (!code || !lock || !loc) {
            addBikeMsg.textContent = 'All fields are required.';
            addBikeMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            addBikeMsg.style.color = '#ef4444';
            addBikeMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            addBikeMsg.style.display = 'block';
            return;
        }

        confirmAction('Add Bicycle', `Are you sure you want to add bicycle ${code} to ${loc}?`, async () => {
            btnAddBike.disabled = true;
            btnAddBike.textContent = 'Adding...';
            try {
                const res = await fetch('/api/admin/bicycles', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({
                        bicycle_code: code,
                        combination_lock: lock,
                        initial_location: loc
                    })
                });
                const data = await res.json();
                if (data.success) {
                    newBikeCode.value = '';
                    newBikeLock.value = '';
                    addBikeMsg.textContent = data.message || 'Bicycle successfully added!';
                    addBikeMsg.style.background = 'rgba(0, 106, 78, 0.1)';
                    addBikeMsg.style.color = 'var(--up-green)';
                    addBikeMsg.style.border = '1px solid rgba(0, 106, 78, 0.2)';
                    addBikeMsg.style.display = 'block';

                    if (window.initDashboard) {
                        await window.initDashboard();
                    }
                } else {
                    addBikeMsg.textContent = data.error || 'Failed to add bicycle.';
                    addBikeMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                    addBikeMsg.style.color = '#ef4444';
                    addBikeMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                    addBikeMsg.style.display = 'block';
                }
            } catch (err) {
                console.error('[settings.js] Error adding bike:', err);
                addBikeMsg.textContent = 'Connection error. Please try again.';
                addBikeMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                addBikeMsg.style.color = '#ef4444';
                addBikeMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                addBikeMsg.style.display = 'block';
            } finally {
                btnAddBike.disabled = false;
                btnAddBike.textContent = 'Add to Fleet';
            }
        });
    });

    // Add Station Form Submit
    btnAddStation.addEventListener('click', () => {
        const name = newStationName.value.trim();
        const latInput = document.getElementById('new-station-lat');
        const lngInput = document.getElementById('new-station-lng');
        const lat = latInput ? parseFloat(latInput.value) : NaN;
        const lng = lngInput ? parseFloat(lngInput.value) : NaN;

        addStationMsg.style.display = 'none';

        if (!name || isNaN(lat) || isNaN(lng)) {
            addStationMsg.textContent = 'Station name, latitude, and longitude are required.';
            addStationMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            addStationMsg.style.color = '#ef4444';
            addStationMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            addStationMsg.style.display = 'block';
            return;
        }

        confirmAction('Add Station', `Are you sure you want to add the station "${name}"?`, async () => {
            btnAddStation.disabled = true;
            btnAddStation.textContent = 'Adding...';

            try {
                const res = await fetch('/api/admin/locations', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({
                        location_name: name,
                        latitude: lat,
                        longitude: lng
                    })
                });
                const data = await res.json();
                if (data.success) {
                    newStationName.value = '';
                    if (latInput) latInput.value = '14.654800';
                    if (lngInput) lngInput.value = '121.066800';
                    if (addStationMarker) {
                        addStationMarker.setLatLng([14.6548, 121.0668]);
                        addStationMap.panTo([14.6548, 121.0668]);
                    }
                    addStationMsg.textContent = data.message || 'Station successfully added!';
                    addStationMsg.style.background = 'rgba(0, 106, 78, 0.1)';
                    addStationMsg.style.color = 'var(--up-green)';
                    addStationMsg.style.border = '1px solid rgba(0, 106, 78, 0.2)';
                    addStationMsg.style.display = 'block';

                    await loadAdminPanel();

                    if (window.initDashboard) {
                        await window.initDashboard();
                    }
                } else {
                    addStationMsg.textContent = data.error || 'Failed to add station.';
                    addStationMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                    addStationMsg.style.color = '#ef4444';
                    addStationMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                    addStationMsg.style.display = 'block';
                }
            } catch (err) {
                console.error('[settings.js] Error adding station:', err);
                addStationMsg.textContent = 'Connection error. Please try again.';
                addStationMsg.style.background = 'rgba(239, 68, 68, 0.1)';
                addStationMsg.style.color = '#ef4444';
                addStationMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                addStationMsg.style.display = 'block';
            } finally {
                btnAddStation.disabled = false;
                btnAddStation.textContent = 'Add Station';
            }
        });
    });

    // Run initial session check to gate the dashboard on page load
    checkSession();

    // Admin Settings Tab Switching Logic
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabContents = document.querySelectorAll('.admin-tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');

            const targetId = btn.dataset.target;
            tabContents.forEach(content => {
                if (content.id === targetId) {
                    content.classList.remove('d-none');
                } else {
                    content.classList.add('d-none');
                }
            });
        });
    });

    // Trigger loading settings when tab-admin-alerts is opened
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            if (targetId === 'tab-admin-alerts') {
                loadPointsSettings();
            }
        });
    });

    // Window functions for inline Admin Alerts Editing
    window.startAdminEdit = function (index) {
        const container = document.getElementById(`admin-container-${index}`);
        if (!container) return;

        // Render search field and a results container
        container.innerHTML = `
            <div class="w-100 p-2" style="background-color: var(--bg-main); border-radius: 6px;">
                <div class="fw-bold text-muted mb-1" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px;">Search Member for Admin ${index}</div>
                <input type="text" id="admin-search-input-${index}" class="form-control form-control-sm my-2 text-dark" placeholder="Type name or phone number..." style="font-size: 0.75rem; background-color: var(--bg-panel); border: 1px solid var(--border); padding: 8px 10px; width: 100%; border-radius: 6px;">
                
                <div id="admin-search-results-${index}" class="custom-scroll border rounded bg-panel p-1 overflow-auto" style="max-height: 140px; border-color: var(--border) !important; font-size: 0.75rem; display: flex; flex-direction: column; gap: 2px;">
                    <!-- results dynamically populated -->
                </div>
                
                <div class="d-flex justify-content-end mt-2">
                    <button class="btn btn-sm btn-secondary fw-bold px-3 py-1" onclick="window.cancelAdminEdit(${index})" style="font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--border); background: transparent; color: var(--text-muted);">Cancel</button>
                </div>
            </div>
        `;

        // Attach input listener to search input
        const input = document.getElementById(`admin-search-input-${index}`);
        if (input) {
            input.addEventListener('input', () => {
                window.filterAdminSearch(index, input.value.trim().toLowerCase());
            });
        }

        // Initially show all members
        window.filterAdminSearch(index, '');
    };

    window.filterAdminSearch = function (index, query) {
        const resultsBox = document.getElementById(`admin-search-results-${index}`);
        if (!resultsBox) return;

        resultsBox.innerHTML = '';

        // Add the "None" option at the top of the search results
        const noneDiv = document.createElement('div');
        noneDiv.className = 'admin-search-item';
        noneDiv.style.cssText = 'padding: 6px 10px; cursor: pointer; border-radius: 4px; color: #ef4444; font-weight: 600; display: flex; align-items: center; gap: 6px;';
        noneDiv.innerHTML = `🚫 Set to None (Disable Alert)`;
        
        // Add hover effects inline
        noneDiv.addEventListener('mouseenter', () => noneDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.08)');
        noneDiv.addEventListener('mouseleave', () => noneDiv.style.backgroundColor = 'transparent');
        noneDiv.addEventListener('click', () => {
            window.saveAdminSelectionDirect(index, '', '');
        });
        resultsBox.appendChild(noneDiv);

        // Filter and display members
        let count = 0;
        cachedMembers.forEach(mem => {
            const fullName = `${mem.firstname} ${mem.lastname}`;
            const phone = mem.phone_number || '';
            const matchName = fullName.toLowerCase().includes(query);
            const matchPhone = phone.includes(query);

            if (query === '' || matchName || matchPhone) {
                count++;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'admin-search-item';
                itemDiv.style.cssText = 'padding: 6px 10px; cursor: pointer; border-radius: 4px; color: var(--text-h); display: flex; justify-content: space-between; align-items: center;';
                itemDiv.innerHTML = `
                    <span>${fullName}</span>
                    <span class="font-monospace text-muted" style="font-size: 0.7rem;">${phone}</span>
                `;
                itemDiv.addEventListener('mouseenter', () => itemDiv.style.backgroundColor = 'var(--border)');
                itemDiv.addEventListener('mouseleave', () => itemDiv.style.backgroundColor = 'transparent');
                itemDiv.addEventListener('click', () => {
                    window.saveAdminSelectionDirect(index, fullName, phone);
                });
                resultsBox.appendChild(itemDiv);
            }
        });

        if (count === 0 && query !== '') {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'padding: 10px; text-align: center; color: var(--text-muted); font-size: 0.75rem;';
            emptyDiv.textContent = 'No matching members found.';
            resultsBox.appendChild(emptyDiv);
        }
    };

    window.cancelAdminEdit = function (index) {
        const container = document.getElementById(`admin-container-${index}`);
        if (!container) return;

        const name = index === 1 ? window.currentAdminName1 : window.currentAdminName2;
        const phone = index === 1 ? window.currentAdminPhone1 : window.currentAdminPhone2;

        container.innerHTML = `
            <div>
                <div class="fw-bold text-muted" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px;">${index === 1 ? 'Primary Admin (Admin 1)' : 'Secondary Admin (Admin 2)'}</div>
                <div id="admin-display-name-${index}" class="fw-bold text-dark mt-1" style="font-size: 0.95rem;">${name || 'Not Configured'}</div>
                <div id="admin-display-phone-${index}" class="small text-muted font-monospace mt-0.5">${phone || '-'}</div>
            </div>
            <button id="btn-edit-admin-${index}" class="btn btn-sm btn-outline-primary fw-bold" onclick="window.startAdminEdit(${index})" style="border-radius: 6px; font-size: 0.75rem; border-color: var(--up-maroon) !important; color: var(--up-maroon) !important;">Edit Admin</button>
        `;
    };

    window.saveAdminSelectionDirect = async function (index, name, phone) {
        const saveMsg = document.getElementById('admin-alerts-save-msg');
        if (saveMsg) saveMsg.style.display = 'none';

        try {
            const keyName = `admin_alert_name_${index}`;
            const keyPhone = `admin_alert_phone_${index}`;

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({
                    settings: [
                        { setting_name: keyName, setting_value: name },
                        { setting_name: keyPhone, setting_value: phone }
                    ]
                })
            });
            const data = await res.json();
            if (data.success) {
                if (saveMsg) {
                    saveMsg.textContent = name ? `Saved ${name} successfully!` : 'Cleared contact successfully!';
                    saveMsg.style.display = 'block';
                    setTimeout(() => { saveMsg.style.display = 'none'; }, 3000);
                }
                
                // Update global state and reload row view
                if (index === 1) {
                    window.currentAdminName1 = name;
                    window.currentAdminPhone1 = phone;
                } else {
                    window.currentAdminName2 = name;
                    window.currentAdminPhone2 = phone;
                }
                window.cancelAdminEdit(index);
            } else {
                alert(data.error || 'Failed to save admin contact.');
            }
        } catch (err) {
            alert('Error saving admin contact.');
        }
    };

    // Quick Bike Override Search Filter
    const searchBikeOverride = document.getElementById('search-bike-override');
    const btnSearchBikeOverride = document.getElementById('btn-search-bike-override');

    if (searchBikeOverride && btnSearchBikeOverride) {
        const executeSearch = () => {
            const query = searchBikeOverride.value.trim().toLowerCase();
            const items = document.querySelectorAll('.bike-override-item');

            items.forEach(item => {
                const code = item.dataset.bikeCode.toLowerCase();
                if (query === '' || code.includes(query)) {
                    item.classList.remove('d-none');
                } else {
                    item.classList.add('d-none');
                }
            });
        };

        btnSearchBikeOverride.addEventListener('click', executeSearch);
        searchBikeOverride.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeSearch();
        });
    }

    // Handle Save All Bicycle Edits
    const btnSaveAllBikes = document.getElementById('btn-save-all-bikes');
    if (btnSaveAllBikes) {
        btnSaveAllBikes.addEventListener('click', async () => {
            const items = document.querySelectorAll('.bike-override-item');
            const updates = [];

            items.forEach(div => {
                const code = div.dataset.bikeCode;
                const origStatus = div.dataset.origStatus;
                const origLocation = div.dataset.origLocation;
                const lockInput = div.querySelector('.bike-lock-input');
                const statusSelect = div.querySelector('.bike-status-select');
                const locationSelect = div.querySelector('.bike-location-select');
                const btnSave = div.querySelector('.btn-save-bike');

                const payload = {};
                if (lockInput && lockInput.value.trim() !== '') payload.combination_lock = lockInput.value.trim();
                if (statusSelect && statusSelect.value !== origStatus) payload.condition_status = statusSelect.value;
                if (locationSelect && locationSelect.value !== origLocation) payload.new_location = locationSelect.value;

                if (Object.keys(payload).length > 0) {
                    updates.push({ code, payload, div, lockInput, statusSelect, locationSelect, btnSave });
                }
            });

            if (updates.length === 0) {
                return alert('No changes detected across any bicycles.');
            }

            confirmAction('Save All Bicycle Edits', `Are you sure you want to save modifications for ${updates.length} bicycle(s)?`, async () => {
                const originalText = btnSaveAllBikes.textContent;
                btnSaveAllBikes.disabled = true;
                btnSaveAllBikes.textContent = 'Saving All...';

                updates.forEach(u => {
                    if (u.btnSave) {
                        u.btnSave.disabled = true;
                        u.btnSave.textContent = '...';
                    }
                });

                try {
                    const results = await Promise.all(updates.map(u => 
                        fetch('/api/admin/bicycles/override', {
                            method: 'POST',
                            headers: getAdminHeaders(),
                            body: JSON.stringify({ bicycle_code: u.code, ...u.payload })
                        }).then(r => r.json()).catch(() => ({ success: false, error: 'Network error' }))
                    ));

                    const failed = results.filter(r => !r.success);
                    if (failed.length === 0) {
                        alert(`Successfully updated all ${updates.length} bicycle(s)!`);
                        updates.forEach(u => {
                            if (u.lockInput) u.lockInput.value = '';
                        });
                        if (window.initDashboard) await window.initDashboard();
                        await renderBikeOverrides();
                    } else {
                        alert(`Updated ${updates.length - failed.length} bicycle(s), but ${failed.length} failed. First error: ${failed[0].error || 'Unknown error'}`);
                        if (window.initDashboard) await window.initDashboard();
                        await renderBikeOverrides();
                    }
                } catch (e) {
                    console.error('[settings.js] Error in Save All:', e);
                    alert('An error occurred while saving bicycles.');
                } finally {
                    btnSaveAllBikes.disabled = false;
                    btnSaveAllBikes.textContent = originalText;
                }
            });
        });
    }

    // Quick Member Search Filter
    const searchMemberOverride = document.getElementById('search-member-override');
    const btnSearchMemberOverride = document.getElementById('btn-search-member-override');

    if (searchMemberOverride && btnSearchMemberOverride) {
        const executeMemberSearch = () => {
            const query = searchMemberOverride.value.trim().toLowerCase();
            const queryCore = query.replace(/[\s\-\(\)]/g, '').replace(/^(\+63|63|0)(?=9)/, '');
            const items = document.querySelectorAll('.member-item');

            items.forEach(item => {
                const phone = (item.dataset.phone || '').toLowerCase();
                const phoneCore = phone.replace(/[\s\-\(\)]/g, '').replace(/^(\+63|63|0)(?=9)/, '');
                const name = (item.dataset.name || '').toLowerCase();
                if (query === '' || phone.includes(query) || (queryCore && phoneCore.includes(queryCore)) || name.includes(query)) {
                    item.classList.remove('d-none');
                } else {
                    item.classList.add('d-none');
                }
            });
        };

        btnSearchMemberOverride.addEventListener('click', executeMemberSearch);
        searchMemberOverride.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeMemberSearch();
        });
    }
});

// Global function for editing points from the members list using custom modal
window.editMemberPoints = function (phone, currentPoints) {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please sign in as admin first.');
        return;
    }

    const modal = document.getElementById('add-points-modal');
    const input = document.getElementById('input-add-points');
    const btnCancel = document.getElementById('btn-points-cancel');
    const btnConfirm = document.getElementById('btn-points-confirm');
    const descText = document.getElementById('add-points-text');

    if (!modal) return;

    descText.innerText = `Enter points to add to ${phone} (Current: ${currentPoints})`;
    input.value = '';
    modal.style.display = 'flex';
    input.focus();

    const closeModal = () => {
        modal.style.display = 'none';
        btnCancel.onclick = null;
        btnConfirm.onclick = null;
    };

    btnCancel.onclick = closeModal;

    btnConfirm.onclick = async () => {
        const additionalPoints = input.value;
        if (additionalPoints === null || additionalPoints.trim() === "") {
            closeModal();
            return;
        }

        const newPoints = currentPoints + parseInt(additionalPoints);
        if (isNaN(newPoints)) {
            closeModal();
            return;
        }

        btnConfirm.disabled = true;
        btnConfirm.innerText = "Saving...";

        try {
            const res = await fetch('/api/admin/override-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phone_number: phone, trust_points: newPoints })
            });
            const data = await res.json();
            if (data.success) {
                // Re-render members list via a custom event or by clicking the nav again
                const navReg = document.getElementById('nav-settings');
                if (navReg) navReg.click();
                setTimeout(() => {
                    const tabMembers = document.querySelector('[data-target="tab-members"]');
                    if (tabMembers) tabMembers.click();
                }, 100);
            } else {
                alert(data.error || 'Failed to update points.');
            }
        } catch (err) {
            alert('Connection error.');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = "Confirm";
            closeModal();
        }
    };
};


window.activateMember = function (phone) {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please sign in as admin first.');
        return;
    }

    const modal = document.getElementById('action-confirm-modal');
    const title = document.getElementById('action-confirm-title');
    const text = document.getElementById('action-confirm-text');
    const btnCancel = document.getElementById('btn-action-cancel');
    const btnConfirm = document.getElementById('btn-action-confirm');

    if (!modal) {
        if (confirm('Are you sure you want to reactivate this member?')) {
            proceedWithActivation(phone, token);
        }
        return;
    }

    title.innerText = "Activate Member";
    title.style.color = "#22c55e"; // Green color for activation
    text.innerHTML = `Are you sure you want to reactivate member <strong>${phone}</strong>?<br>They will be able to borrow bikes again.`;

    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
        btnCancel.removeEventListener('click', closeModal);
        btnConfirm.removeEventListener('click', confirmHandler);
    };

    const confirmHandler = async () => {
        btnConfirm.disabled = true;
        btnConfirm.innerText = "Activating...";
        await proceedWithActivation(phone, token);
        btnConfirm.disabled = false;
        btnConfirm.innerText = "Confirm";
        closeModal();
    };

    btnCancel.addEventListener('click', closeModal);
    btnConfirm.addEventListener('click', confirmHandler);
};

async function proceedWithActivation(phone, token) {
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
            const navReg = document.getElementById('nav-settings');
            if (navReg) navReg.click();
            setTimeout(() => {
                const tabMembers = document.querySelector('[data-target="tab-members"]');
                if (tabMembers) tabMembers.click();
            }, 100);
        } else {
            alert(data.error || 'Failed to reactivate member.');
        }
    } catch (err) {
        alert('Connection error.');
    }
}

window.deactivateMember = function (phone) {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please sign in as admin first.');
        return;
    }

    const modal = document.getElementById('action-confirm-modal');
    const title = document.getElementById('action-confirm-title');
    const text = document.getElementById('action-confirm-text');
    const btnCancel = document.getElementById('btn-action-cancel');
    const btnConfirm = document.getElementById('btn-action-confirm');

    if (!modal) return;

    title.innerText = "Deactivate Member";
    title.style.color = "#ef4444";
    text.innerHTML = `Are you sure you want to deactivate member <strong>${phone}</strong>?<br>They will no longer be able to borrow bikes.`;

    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
        btnCancel.onclick = null;
        btnConfirm.onclick = null;
        title.style.color = "var(--text-h)";
    };

    btnCancel.onclick = closeModal;

    btnConfirm.onclick = async () => {
        btnConfirm.disabled = true;
        btnConfirm.innerText = "Processing...";

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
                const navReg = document.getElementById('nav-settings');
                if (navReg) navReg.click();
                setTimeout(() => {
                    const tabMembers = document.querySelector('[data-target="tab-members"]');
                    if (tabMembers) tabMembers.click();
                }, 100);
            } else {
                alert(data.error || 'Failed to delete member.');
            }
        } catch (err) {
            alert('Connection error.');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = "Confirm";
            closeModal();
        }
    };
};

window.hardDeleteMember = function (phone) {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please sign in as admin first.');
        return;
    }

    const modal = document.getElementById('action-confirm-modal');
    const title = document.getElementById('action-confirm-title');
    const text = document.getElementById('action-confirm-text');
    const btnCancel = document.getElementById('btn-action-cancel');
    const btnConfirm = document.getElementById('btn-action-confirm');

    if (!modal) return;

    title.innerText = "Delete Member";
    title.style.color = "#ef4444";
    text.innerHTML = `Are you sure you want to <strong>permanently delete</strong> member <strong>${phone}</strong> from the database?<br><span class="text-danger fw-bold">Warning: This action is irreversible.</span>`;

    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
        btnCancel.onclick = null;
        btnConfirm.onclick = null;
        title.style.color = "var(--text-h)";
    };

    btnCancel.onclick = closeModal;

    btnConfirm.onclick = async () => {
        btnConfirm.disabled = true;
        btnConfirm.innerText = "Deleting...";

        try {
            const res = await fetch('/api/admin/hard-delete-member', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phone_number: phone })
            });
            const data = await res.json();
            if (data.success) {
                alert('Member permanently deleted!');
                const navReg = document.getElementById('nav-settings');
                if (navReg) navReg.click();
                setTimeout(() => {
                    const tabMembers = document.querySelector('[data-target="tab-members"]');
                    if (tabMembers) tabMembers.click();
                }, 100);
            } else {
                alert(data.error || 'Failed to delete member.');
            }
        } catch (err) {
            console.error('[settings.js] Error deleting member:', err);
            alert('Connection error.\n\nPlease restart your Node.js backend server so it can load the new database logic and endpoints we just pushed!');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = "Confirm";
            closeModal();
        }
    };
};
