
// ---------------------------------------------------------------------
// Leaderboards Management
// ---------------------------------------------------------------------

let leaderboardsLoaded = false;
let leaderboardsDataCache = null;

async function loadLeaderboards() {
    if (leaderboardsLoaded && leaderboardsDataCache) {
        return; // Use cached data
    }

    const token = sessionStorage.getItem('adminToken');
    if (!token) return;

    try {
        const response = await fetch('/api/student/leaderboards', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        if (result.success) {
            leaderboardsDataCache = result.data;
            leaderboardsLoaded = true;
            renderLeaderboards(result.data);
        }
    } catch (error) {
        console.error('Failed to load leaderboards:', error);
    }
}

function renderLeaderboards(data) {
    const { topTrustedRiders, topActiveRiders, topHubs, currentUser } = data;

    // Helper to assign standard competition ranks based on score
    const assignRanks = (items) => {
        if (!items || items.length === 0) return items;
        items.forEach(item => {
            let higherCount = 0;
            items.forEach(other => {
                if (parseFloat(other.score) > parseFloat(item.score)) {
                    higherCount++;
                }
            });
            item.displayRank = higherCount + 1;
        });
        return items;
    };

    assignRanks(topTrustedRiders);
    assignRanks(topActiveRiders);
    assignRanks(topHubs);

    // Helper function to render a podium
    const renderPodium = (containerId, items, themeColor, iconClass, label) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (items.length === 0) {
            container.innerHTML = `<div class="w-100 text-center py-5 text-muted" style="min-height: 150px; display: flex; align-items: center; justify-content: center;"><p class="mb-0 fw-bold">No data available yet</p></div>`;
            return;
        }

        let html = '';

        const formatLabel = (score, lbl) => lbl === 'rides' ? (score === 1 ? 'ride' : 'rides') : lbl === 'pts' ? (score === 1 ? 'pt' : 'pts') : lbl;

        // Rank 2
        if (items.length > 1) {
            const r2 = items[1];
            const name = r2.name || `${r2.firstname} ${r2.lastname}`;
            html += `
                <div class="card border-0 text-center" style="flex: 1 1 0%; width: 0; background-color: var(--bg-body); border-radius: var(--radius-lg); position: relative; border: 1px solid var(--border-light) !important;">
                    <div class="position-absolute top-0 start-50 translate-middle d-flex align-items-center justify-content-center" style="color: ${themeColor}; font-size: 2.2rem; width: 40px; height: 40px;">
                        <i class='bx bxs-star position-absolute'></i>
                        <span class="position-absolute text-white fw-bold" style="font-size: 0.9rem; margin-top: 2px;">${r2.displayRank}</span>
                    </div>
                    <div class="card-body pt-4 pb-3 px-1">
                        <div class="d-flex justify-content-center mb-2 mt-1">
                            <div class="d-flex align-items-center justify-content-center rounded-circle" style="width: 55px; height: 55px; background: rgba(148, 163, 184, 0.15); color: ${themeColor}; font-size: 1.5rem;"><i class='${iconClass}'></i></div>
                        </div>
                        <h6 class="fw-bold text-dark mb-0 text-truncate mx-auto" style="font-size: 0.95rem; max-width: 90%;">${name}</h6>
                        <h5 class="fw-bolder mb-0 mt-2" style="color: ${themeColor}; font-size: 1.2rem;">${r2.score} ${formatLabel(r2.score, label)}</h5>
                    </div>
                </div>
            `;
        }

        // Rank 1
        const r1 = items[0];
        const r1Name = r1.name || `${r1.firstname} ${r1.lastname}`;
        html += `
            <div class="card border-0 text-center" style="flex: 1.1 1 0%; width: 0; background-color: var(--bg-body); border-radius: var(--radius-lg); position: relative; z-index: 10; margin-bottom: 25px; border: 1px solid rgba(234, 179, 8, 0.4) !important; box-shadow: 0 10px 25px -5px rgba(234, 179, 8, 0.15);">
                <div class="position-absolute top-0 start-50 translate-middle d-flex align-items-center justify-content-center" style="color: #eab308; font-size: 2.8rem; width: 50px; height: 50px;">
                    <i class='bx bxs-star position-absolute'></i>
                    <span class="position-absolute text-white fw-bolder" style="font-size: 1.1rem; margin-top: 3px;">${r1.displayRank}</span>
                </div>
                <div class="card-body pt-4 pb-4 px-1">
                    <div class="d-flex justify-content-center mb-3 mt-2">
                        <div class="d-flex align-items-center justify-content-center rounded-circle" style="width: 70px; height: 70px; background: rgba(234, 179, 8, 0.15); color: #ca8a04; font-size: 2rem;"><i class='${iconClass}'></i></div>
                    </div>
                    <h6 class="fw-bold text-dark mb-0 text-truncate mx-auto" style="font-size: 1.05rem; max-width: 90%;">${r1Name}</h6>
                    <h4 class="fw-bolder text-warning mb-0 mt-2" style="font-size: 1.5rem;">${r1.score} ${formatLabel(r1.score, label)}</h4>
                </div>
            </div>
        `;

        // Rank 3
        if (items.length > 2) {
            const r3 = items[2];
            const name = r3.name || `${r3.firstname} ${r3.lastname}`;
            html += `
                <div class="card border-0 text-center" style="flex: 1 1 0%; width: 0; background-color: var(--bg-body); border-radius: var(--radius-lg); position: relative; border: 1px solid var(--border-light) !important;">
                    <div class="position-absolute top-0 start-50 translate-middle d-flex align-items-center justify-content-center" style="color: ${themeColor}; font-size: 2.2rem; width: 40px; height: 40px;">
                        <i class='bx bxs-star position-absolute'></i>
                        <span class="position-absolute text-white fw-bold" style="font-size: 0.9rem; margin-top: 2px;">${r3.displayRank}</span>
                    </div>
                    <div class="card-body pt-4 pb-3 px-1">
                        <div class="d-flex justify-content-center mb-2 mt-1">
                            <div class="d-flex align-items-center justify-content-center rounded-circle" style="width: 55px; height: 55px; background: rgba(148, 163, 184, 0.15); color: ${themeColor}; font-size: 1.5rem;"><i class='${iconClass}'></i></div>
                        </div>
                        <h6 class="fw-bold text-dark mb-0 text-truncate mx-auto" style="font-size: 0.95rem; max-width: 90%;">${name}</h6>
                        <h5 class="fw-bolder mb-0 mt-2" style="color: ${themeColor}; font-size: 1.2rem;">${r3.score} ${formatLabel(r3.score, label)}</h5>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    };

    // Helper function to render a list
    const renderList = (listId, items, themeColor, iconClass, label) => {
        const list = document.getElementById(listId);
        if (!list) return;
        if (items.length <= 3) {
            list.innerHTML = '';
            return '';
        }
        let html = '';
        const formatLabel = (score, lbl) => lbl === 'rides' ? (score === 1 ? 'ride' : 'rides') : lbl === 'pts' ? (score === 1 ? 'pt' : 'pts') : lbl;
        for (let i = 3; i < items.length; i++) {
            const r = items[i];
            const rank = r.displayRank;
            const name = r.name || `${r.firstname} ${r.lastname}`;
            html += `
                <li class="d-flex justify-content-between align-items-center px-4 py-3" style="background-color: var(--bg-panel); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                    <div class="d-flex align-items-center gap-4">
                        <div class="d-flex align-items-center justify-content-center" style="color: ${themeColor}; font-size: 1.8rem; position: relative; width: 35px; height: 35px;">
                            <i class='bx bxs-star position-absolute'></i>
                            <span class="position-absolute text-white fw-bold" style="font-size: ${rank >= 10 ? '0.65rem' : '0.7rem'}; margin-top: 2px;">${rank}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <div class="d-flex align-items-center justify-content-center rounded-circle" style="width: 40px; height: 40px; background: rgba(15, 23, 42, 0.05); color: ${themeColor}; font-size: 1.2rem;"><i class='${iconClass}'></i></div>
                            <div>
                                <span class="d-block fw-bold text-dark" style="font-size: 0.95rem;">${name}</span>
                            </div>
                        </div>
                    </div>
                    <span class="fw-bold" style="font-size: 1.1rem; color: ${themeColor};">${r.score} ${formatLabel(r.score, label)}</span>
                </li>
            `;
        }
        return html;
    };

    // 1. Render Top Trusted Riders
    renderPodium('podium-container', topTrustedRiders, '#8b5cf6', 'bx bx-user', 'pts');
    const topRidersList = document.getElementById('top-riders-list');
    if (topRidersList) {
        topRidersList.innerHTML = renderList('top-riders-list', topTrustedRiders, '#8b5cf6', 'bx bx-user', 'pts');
    }

    const curRankContainer = document.getElementById('current-user-rank-container');
    if (curRankContainer && currentUser) {
        curRankContainer.innerHTML = `
            <div class="position-absolute top-0 start-0 w-100 h-100" style="background-image: radial-gradient(circle at 100% 50%, rgba(var(--up-maroon-rgb, 123, 17, 19), 0.08) 0%, transparent 50%); pointer-events: none;"></div>
            <div class="d-flex justify-content-between align-items-center position-relative z-1">
                <div class="d-flex align-items-center gap-3">
                    <div class="fw-bolder" style="font-size: 1.3rem; color: var(--up-maroon, #7b1113); min-width: 40px; text-align: center;">#${currentUser.trustedRank}</div>
                    <div>
                        <span class="d-block fw-bold text-dark">You (${currentUser.fullName})</span>
                        <span class="small text-muted d-block" style="font-size: 0.8rem;">Current Rank</span>
                    </div>
                </div>
                <span class="fw-bolder" style="font-size: 1.2rem; color: var(--up-maroon, #7b1113);">${currentUser.trustedScore} pts</span>
            </div>
        `;
    }

    // 2. Render Top Active Riders (This Week)
    renderPodium('active-riders-podium', topActiveRiders, '#3b82f6', 'bx bx-user', 'rides');
    const topActiveList = document.getElementById('top-active-riders-list');
    if (topActiveList) {
        topActiveList.innerHTML = renderList('top-active-riders-list', topActiveRiders, '#3b82f6', 'bx bx-user', 'rides');
    }

    const activeRankContainer = document.getElementById('current-user-active-rank-container');
    if (activeRankContainer && currentUser && currentUser.activeScore !== undefined) {
        activeRankContainer.innerHTML = `
            <div class="position-absolute top-0 start-0 w-100 h-100" style="background-image: radial-gradient(circle at 100% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%); pointer-events: none;"></div>
            <div class="d-flex justify-content-between align-items-center position-relative z-1">
                <div class="d-flex align-items-center gap-3">
                    <div class="fw-bolder" style="font-size: 1.3rem; color: #3b82f6; min-width: 40px; text-align: center;">#${currentUser.activeRank}</div>
                    <div>
                        <span class="d-block fw-bold text-dark">You (${currentUser.fullName})</span>
                        <span class="small text-muted d-block" style="font-size: 0.8rem;">Current Rank</span>
                    </div>
                </div>
                <span class="fw-bolder" style="font-size: 1.2rem; color: #3b82f6;">${currentUser.activeScore} ${currentUser.activeScore === 1 ? 'ride' : 'rides'}</span>
            </div>
        `;
    }

    // 3. Render Most Active Hubs
    renderPodium('active-hubs-podium', topHubs, '#ef4444', 'bx bx-map', 'rides');
    const topHubsList = document.getElementById('top-hubs-list');
    if (topHubsList) {
        topHubsList.innerHTML = renderList('top-hubs-list', topHubs, '#ef4444', 'bx bx-map', 'rides');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION ---
    const btnStudentLogout = document.getElementById('btn-student-logout');
    const logoutModal = document.getElementById('logout-confirm-modal');
    const btnLogoutCancel = document.getElementById('btn-logout-cancel');
    const btnLogoutConfirm = document.getElementById('btn-logout-confirm');

    if (btnStudentLogout) {
        btnStudentLogout.addEventListener('click', () => {
            if (logoutModal) logoutModal.style.display = 'flex';
        });
    }
    if (btnLogoutCancel) {
        btnLogoutCancel.addEventListener('click', () => {
            if (logoutModal) logoutModal.style.display = 'none';
        });
    }
    if (btnLogoutConfirm) {
        btnLogoutConfirm.addEventListener('click', () => {
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('userRole');
            window.location.href = '/';
        });
    }

    // --- NAVIGATION LOGIC ---
    const navDashboard = document.getElementById('nav-dashboard');
    const navSummary = document.getElementById('nav-summary');
    const navCommunity = document.getElementById('nav-community');
    const navLeaderboards = document.getElementById('nav-leaderboards');

    const dashboardContainer = document.getElementById('dashboard-container');
    const summaryContainer = document.getElementById('summary-container');
    const communityContainer = document.getElementById('community-container');
    const leaderboardsContainer = document.getElementById('leaderboards-container');

    function hideAllViews() {
        if (dashboardContainer) dashboardContainer.style.setProperty('display', 'none', 'important');
        if (summaryContainer) summaryContainer.style.setProperty('display', 'none', 'important');
        if (communityContainer) communityContainer.style.setProperty('display', 'none', 'important');
        if (leaderboardsContainer) leaderboardsContainer.style.setProperty('display', 'none', 'important');

        document.querySelectorAll('.nav-menu .nav-item').forEach(el => el.classList.remove('active'));
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', () => {
            hideAllViews();
            dashboardContainer.style.setProperty('display', 'flex', 'important');
            navDashboard.classList.add('active');
            // Trigger leaflet map resize fix
            if (window.dispatchEvent) {
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    if (navSummary) {
        navSummary.addEventListener('click', () => {
            hideAllViews();
            summaryContainer.style.setProperty('display', 'block', 'important');
            navSummary.classList.add('active');
            triggerSummaryAnimations();
        });
    }

    if (navCommunity) {
        navCommunity.addEventListener('click', () => {
            hideAllViews();
            communityContainer.style.setProperty('display', 'block', 'important');
            navCommunity.classList.add('active');
        });
    }

    if (navLeaderboards) {
        navLeaderboards.addEventListener('click', () => {
            hideAllViews();
            leaderboardsContainer.style.setProperty('display', 'block', 'important');
            navLeaderboards.classList.add('active');
            loadLeaderboards();
        });
    }

    // --- WALL OF HONOR RENDERER ---
    function renderWallOfHonor(wallOfHonor) {
        const ticker = document.getElementById('wall-of-honor-ticker');
        if (!ticker) return;

        if (!wallOfHonor || wallOfHonor.length === 0) {
            ticker.innerHTML = `
                <div class="d-flex align-items-center justify-content-center p-3 rounded-4 shadow-sm mb-3 border-0" style="background-color: var(--bg-panel); min-height: 150px; width: 100%;">
                    <span class="text-muted fw-bold">No honorable acts recorded yet! Be the first!</span>
                </div>
            `;
            return;
        }

        let html = '';
        wallOfHonor.forEach(item => {
            const borderStyle = item.isPositive
                ? 'background: linear-gradient(180deg, #10b981, #006a4e);'
                : 'background: linear-gradient(180deg, #ef4444, #7b1113);';

            const circleBg = item.isPositive
                ? 'background: linear-gradient(135deg, #a7f3d0, #006a4e);'
                : 'background: linear-gradient(135deg, #fecdd3, #7b1113);';

            const textColor = item.isPositive ? '#006a4e' : '#7b1113';
            const shadowColor = item.isPositive ? 'rgba(0, 106, 78, 0.3)' : 'rgba(123, 17, 19, 0.3)';

            const d = new Date(item.date);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            html += `
                <div class="d-flex align-items-center p-3 rounded-4 shadow-sm mb-3 border-0 position-relative" style="background-color: var(--bg-panel); overflow: hidden;">
                    <div class="position-absolute" style="left: 0; top: 0; bottom: 0; width: 4px; ${borderStyle}"></div>
                    <div class="flex-shrink-0 position-relative ms-2">
                        <div class="rounded-circle" style="width: 44px; height: 44px; ${circleBg} padding: 2px; box-shadow: 0 4px 10px ${shadowColor};">
                            <div class="rounded-circle d-flex align-items-center justify-content-center w-100 h-100" style="background-color: var(--bg-panel); color: ${textColor};">
                                <i class='bx bxs-user-circle fs-3'></i>
                            </div>
                        </div>
                    </div>
                    <div class="ms-3 flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="fw-bolder" style="font-size: 0.95rem; color: var(--text-h);">${item.phone}</div>
                            <span class="small text-muted" style="font-size: 0.75rem;">${dateStr}</span>
                        </div>
                        <div class="small mt-1" style="font-size: 0.85rem; color: var(--text-muted);">${item.action} <strong class="text-success">${item.points}</strong></div>
                    </div>
                </div>
            `;
        });
        ticker.innerHTML = html;
    }

    // --- LOAD STUDENT DATA ---
    async function loadStudentData() {
        const token = sessionStorage.getItem('adminToken');
        if (!token) return;

        try {
            const response = await fetch('/api/student/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                window.studentData = result.data;
                renderWallOfHonor(result.data.wallOfHonor);
            } else {
                throw new Error(result.error || "Unknown API error");
            }
        } catch (e) {
            console.error("Failed to load student data", e);
            document.querySelector('#trust-score-container').innerHTML = `
                <div class="alert alert-danger" role="alert">
                  <h4 class="alert-heading">Connection Error</h4>
                  <p>Failed to load dashboard data. Please send this error to the developer:</p>
                  <hr>
                  <p class="mb-0 text-break" style="font-size: 0.8rem;"><code>${e.message}</code></p>
                </div>
            `;
            window.studentData = { error: true }; // Stop the loading loop
        }
    }
    loadStudentData(); // Fetch right away

    // --- SUMMARY TAB ANIMATIONS ---
    let animationsTriggered = false;

    function triggerSummaryAnimations() {
        if (animationsTriggered) return;

        const data = window.studentData;
        if (!data) {
            // Data not loaded yet, retry shortly
            setTimeout(() => { triggerSummaryAnimations(); }, 500);
            return;
        }

        animationsTriggered = true;

        // 1. Trust Score Gauge
        setTimeout(() => {
            const circle = document.getElementById('trust-score-circle');
            const text = document.getElementById('trust-score-text');
            const msg = document.getElementById('trust-score-msg');
            if (circle && text && msg) {
                const score = data.trustScore;
                const max = 120;
                const offset = 283 - (283 * (score / max));
                circle.style.strokeDashoffset = offset;
                text.textContent = score;

                if (data.pointsFrozen) {
                    circle.style.stroke = '#ef4444'; // Red
                    msg.innerHTML = '<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> ACCOUNT FROZEN (DISPUTE PENDING)</span><br><small class="text-muted" style="line-height:1.4; display:block; margin-top:4px;">To settle & restore points:<br>1) Send photo via FB Messenger (<a href="https://m.me/upbikesharebot" target="_blank" class="fw-bold" style="color: inherit; text-decoration: underline;">m.me/upbikesharebot</a>)<br>2) Or visit UP Bikeshare Admin Hub in person.</small>';
                } else if (score >= 90) {
                    circle.style.stroke = 'var(--up-green, #006a4e)';
                    msg.textContent = 'Excellent standing! Keep it up.';
                } else if (score >= 60) {
                    circle.style.stroke = '#eab308'; // Yellow
                    msg.textContent = 'Great standing! You can borrow bikes anytime.';
                } else if (score < 50) {
                    circle.style.stroke = '#ef4444'; // Red
                    msg.innerHTML = '<span class="text-danger fw-bold"><i class="bi bi-slash-circle-fill"></i> ACCOUNT SUSPENDED (LOW TRUST SCORE)</span><br><small class="text-muted" style="line-height:1.4; display:block; margin-top:4px;">How to restore standing:<br>1) <strong>Volunteer Delivery:</strong> Find & deliver missing or broken bikes to repair hubs.<br>2) <strong>Community Service:</strong> Request a shift via FB Messenger (<a href="https://m.me/upbikesharebot" target="_blank" class="fw-bold" style="color: inherit; text-decoration: underline;">m.me/upbikesharebot</a>) or visit UP Bikeshare Admin Hub.</small>';
                } else {
                    circle.style.stroke = '#f97316'; // Orange
                    msg.innerHTML = '<span class="text-warning fw-bold"><i class="bi bi-exclamation-circle-fill"></i> LOW TRUST SCORE WARNING</span><br><small class="text-muted" style="line-height:1.4; display:block; margin-top:4px;">Your trust score is getting low. Complete clean rides.</small>';
                }
            }
        }, 300);

        // 2. Active Ride Timer
        const timerEl = document.getElementById('active-ride-timer');
        if (timerEl) {
            if (data.activeRide) {
                const startTime = new Date(data.activeRide.borrowed_at).getTime();
                if (window.studentTimerInterval) clearInterval(window.studentTimerInterval);
                window.studentTimerInterval = setInterval(() => {
                    const now = new Date().getTime();
                    let elapsed = Math.floor((now - startTime) / 1000);

                    // Dynamic time limit (defaults to 6 hours if not loaded yet)
                    const limitHours = window.dynamicTimeLimitHours || 6;
                    const limit = limitHours * 3600;
                    let remaining = limit - elapsed;

                    const isNegative = remaining < 0;
                    const absRemaining = Math.abs(remaining);

                    const h = String(Math.floor(absRemaining / 3600)).padStart(2, '0');
                    const m = String(Math.floor((absRemaining % 3600) / 60)).padStart(2, '0');
                    const s = String(absRemaining % 60).padStart(2, '0');

                    timerEl.textContent = isNegative ? `-${h}:${m}:${s}` : `${h}:${m}:${s}`;

                    if (isNegative) {
                        timerEl.style.color = '#ff6b6b';
                    } else {
                        timerEl.style.color = 'white';
                    }
                }, 1000);
            } else {
                timerEl.textContent = "00:00:00";
                const badge = timerEl.closest('.panel').querySelector('.badge');
                if (badge) {
                    badge.textContent = "NO RIDE";
                    badge.style.backgroundColor = "transparent";
                    badge.style.border = "1px solid rgba(255,255,255,0.5)";
                    badge.classList.remove('text-dark');
                    badge.classList.add('text-white');
                    badge.style.color = "white";
                    badge.style.setProperty('background-color', 'transparent', 'important');
                }
            }
        }

        // 3. Update Ride Log Table
        const tbody = document.querySelector('#summary-container table tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (data.rideLog && data.rideLog.length > 0) {
                data.rideLog.forEach(ride => {
                    const d = new Date(ride.date);
                    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-4 py-3" style="background-color: transparent;">
                                <span class="fw-semibold" style="color: var(--text-h);">${dateStr}</span>
                            </td>
                            <td style="background-color: transparent;">
                                <span class="badge bg-secondary rounded-pill">${ride.bike}</span>
                            </td>
                            <td class="text-muted" style="background-color: transparent;">${ride.route}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted" style="background-color: transparent;">No recent rides found.</td></tr>`;
            }
        }

        // 4. Update Last SMS Transaction
        if (data.lastSms) {
            const smsContainer = document.getElementById('last-sms-container');
            if (smsContainer) {
                const d = new Date(data.lastSms.date);
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                smsContainer.innerHTML = `
                    <div class="d-flex flex-column align-items-end">
                        <span class="small text-muted fw-semibold mb-1">You • ${dateStr}</span>
                        <div class="p-3 rounded-3 shadow-sm text-white"
                            style="background-color: var(--up-green); max-width: 85%;">
                            <span class="fw-medium">${data.lastSms.user_text}</span>
                        </div>
                    </div>
                `;
            }
        }
    }

    // --- WALL OF HONOR TICKER ---
    const ticker = document.getElementById('wall-of-honor-ticker');
    if (ticker) {
        let currentPos = 0;
        // Simple infinite scroll effect
        setInterval(() => {
            const firstChild = ticker.firstElementChild;
            if (firstChild) {
                // Animate up
                ticker.style.transform = `translateY(-${firstChild.offsetHeight + 16}px)`;

                setTimeout(() => {
                    // Instantly reset and move child to back
                    ticker.style.transition = 'none';
                    ticker.appendChild(firstChild);
                    ticker.style.transform = 'translateY(0)';

                    // Restore transition for next tick
                    setTimeout(() => {
                        ticker.style.transition = 'transform 1s linear';
                    }, 50);
                }, 1000); // Wait for CSS transition to finish
            }
        }, 4000);
    }
    // --- DYNAMIC SETTINGS LOAD ---
    async function loadDynamicSettings() {
        const token = sessionStorage.getItem('adminToken');
        if (!token) return;

        try {
            const res = await fetch('/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                const settings = data.data;

                if (settings.borrow_time_limit_hours !== undefined) {
                    window.dynamicTimeLimitHours = parseInt(settings.borrow_time_limit_hours);
                    const descEl = document.getElementById('desc-penalty-overtime');
                    if (descEl) {
                        descEl.innerText = `Deducted every hour you exceed the ${window.dynamicTimeLimitHours}-hour limit. Return on time!`;
                    }
                }

                // Helper to update text safely
                const updateBadge = (id, settingKey, suffix = 'pts') => {
                    const el = document.getElementById(id);
                    if (el && settings[settingKey] !== undefined) {
                        const val = parseInt(settings[settingKey]);
                        const sign = val > 0 ? '+' : '';

                        let displaySuffix = suffix;
                        if (suffix === 'pts' || suffix === 'pt') {
                            displaySuffix = Math.abs(val) === 1 ? 'pt' : 'pts';
                        }

                        el.innerText = `${sign}${val} ${displaySuffix}`;
                    }
                };

                // Rewards
                updateBadge('badge-honesty-reward', 'honesty_reward', 'pt');
                updateBadge('badge-consistent-rider', 'consistent_rider_reward', 'pts');
                updateBadge('badge-reward-honest-report', 'reward_honest_report', 'pts');
                updateBadge('badge-reward-community-volunteer', 'reward_community_volunteer', 'pts');
                updateBadge('badge-reward-delivered-bike', 'reward_delivered_bike', 'pts');

                // Penalties
                updateBadge('badge-penalty-abandoned-handshake', 'penalty_abandoned_handshake', 'pts');
                updateBadge('badge-penalty-false-report', 'penalty_false_report', 'pts');
                updateBadge('badge-penalty-overtime', 'penalty_overtime', '/ hr');
                updateBadge('badge-penalty-hit-and-run', 'penalty_hit_and_run', 'pts');
                updateBadge('badge-penalty-missing-bike', 'penalty_missing_bike', 'pts');

                // --- Quick Start Guide Step 9: sync with DB values ---
                // Compact formatter — just shows "+N" or "−N" with optional suffix, no word label
                const updateGuideVal = (id, settingKey, suffix = '') => {
                    const el = document.getElementById(id);
                    if (el && settings[settingKey] !== undefined) {
                        const val = parseInt(settings[settingKey]);
                        const sign = val > 0 ? '+' : '\u2212';
                        el.textContent = `${sign}${Math.abs(val)}${suffix}`;
                    }
                };

                updateGuideVal('qs-val-honest-return', 'honesty_reward');
                updateGuideVal('qs-val-dispute-reward', 'reward_honest_report');
                updateGuideVal('qs-val-overtime', 'penalty_overtime', '/hr');
                updateGuideVal('qs-val-hit-run', 'penalty_hit_and_run');

            }
        } catch (err) {
            console.error('Failed to load dynamic settings:', err);
        }
    }

    // Call it once on load
    loadDynamicSettings();

    // --- QUICK START GUIDE ---
    (function initQuickStartGuide() {
        const TOTAL_STEPS = 11;
        let currentStep = 1;
        let guideOpened = false;

        const overlay = document.getElementById('quickstart-overlay');
        const btnNext = document.getElementById('qs-btn-next');
        const btnBack = document.getElementById('qs-btn-back');
        const btnClose = document.getElementById('qs-close-btn');
        const progress = document.getElementById('qs-progress-fill');
        const dots = document.querySelectorAll('.qs-dot');
        const triggerBtn = document.getElementById('btn-quick-start');

        if (!overlay) return;

        // ---- Open / Close ----
        function openGuide() {
            overlay.style.display = '';
            document.body.style.overflow = 'hidden';
            goToStep(1);
            guideOpened = true;
        }

        function closeGuide() {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }

        // ---- Step navigation ----
        function goToStep(step) {
            const allSteps = document.querySelectorAll('.qs-step');

            // Animate out current, animate in new
            allSteps.forEach(el => {
                const s = parseInt(el.dataset.step);
                if (s === currentStep && s !== step) {
                    el.classList.remove('active');
                    el.classList.add(step > currentStep ? 'exit-left' : 'exit-right');
                    // clean class after transition
                    setTimeout(() => el.classList.remove('exit-left', 'exit-right'), 350);
                }
            });

            currentStep = step;

            allSteps.forEach(el => {
                const s = parseInt(el.dataset.step);
                if (s === step) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });

            // Progress bar
            if (progress) {
                progress.style.width = ((step / TOTAL_STEPS) * 100) + '%';
            }

            // Dots
            dots.forEach(dot => {
                const d = parseInt(dot.dataset.dot);
                dot.classList.toggle('active', d === step);
            });

            // Back button
            if (btnBack) {
                btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';
            }

            // Next button label
            if (btnNext) {
                if (step === TOTAL_STEPS) {
                    btnNext.textContent = '🎉 Got it!';
                    btnNext.classList.add('qs-finish');
                } else {
                    btnNext.textContent = 'Next →';
                    btnNext.classList.remove('qs-finish');
                }
            }
        }

        // ---- Button events ----
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (currentStep < TOTAL_STEPS) {
                    goToStep(currentStep + 1);
                } else {
                    closeGuide();
                }
            });
        }

        if (btnBack) {
            btnBack.addEventListener('click', () => {
                if (currentStep > 1) goToStep(currentStep - 1);
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', closeGuide);
        }

        // Close on overlay backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeGuide();
        });

        // Keyboard: Escape closes, Arrow keys navigate
        document.addEventListener('keydown', (e) => {
            if (!overlay || overlay.style.display === 'none') return;
            if (e.key === 'Escape') closeGuide();
            if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
            if (e.key === 'ArrowLeft' && currentStep > 1) goToStep(currentStep - 1);
        });

        // Sidebar trigger button
        if (triggerBtn) {
            triggerBtn.addEventListener('click', openGuide);
        }

        // ---- First-time detection (Option 2: rideLog empty) ----
        // Wait for studentData to load, then check if ride log is empty
        function checkFirstTimeUser() {
            const data = window.studentData;
            if (!data) {
                // Data not loaded yet, retry
                setTimeout(checkFirstTimeUser, 600);
                return;
            }
            if (data.error) return; // Skip if data load failed

            const hasNoRides = !data.rideLog || data.rideLog.length === 0;
            if (hasNoRides && !guideOpened) {
                // Small delay so the dashboard finishes rendering first
                setTimeout(openGuide, 900);
            }
        }

        // Start polling after a brief moment to let loadStudentData() fire
        setTimeout(checkFirstTimeUser, 1200);

    })();

});
