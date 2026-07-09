// public/js/analytics.js
// Handles view switching and Chart.js rendering for system analytics.
// Supports both Overall (All-Time) and Monthly filtering with a History dropdown.

document.addEventListener('DOMContentLoaded', () => {
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('nav-analytics');
    const navMap = document.getElementById('nav-map');

    const heroMap = document.querySelector('.hero-map-section');
    const dashboardGrid = document.querySelector('.data-container'); // Original dashboard grid
    const analyticsContainer = document.getElementById('analytics-container');
    const mainWrapper = document.querySelector('.main-wrapper');

    // Stats elements (Overall)
    const overallTotalRidesEl = document.getElementById('analytics-overall-total-rides');
    const overallPeakHourEl = document.getElementById('analytics-overall-peak-hour');
    const overallTopHubEl = document.getElementById('analytics-overall-top-hub');
    const overallDoughnutCenterValEl = document.getElementById('doughnut-overall-center-val');

    // Stats elements (Monthly)
    const monthlyTotalRidesEl = document.getElementById('analytics-total-rides');
    const monthlyPeakHourEl = document.getElementById('analytics-peak-hour');
    const monthlyTopHubEl = document.getElementById('analytics-top-hub');
    const monthlyDoughnutCenterValEl = document.getElementById('doughnut-center-val');
    const monthLabelEl = document.getElementById('analytics-month-label');

    // Chart Titles
    const monthlyPeakHoursTitleEl = document.getElementById('monthly-peak-hours-title');
    const monthlyPopularStationsTitleEl = document.getElementById('monthly-popular-stations-title');

    // Timeframe Filter UI elements
    const periodSelect = document.getElementById('analytics-period-select');
    const yearSelect = document.getElementById('analytics-year-select');
    const monthSelect = document.getElementById('analytics-month-select');
    const monthWrapper = document.getElementById('analytics-month-wrapper');
    const periodicTitleEl = document.getElementById('periodic-analytics-title');
    const noDataMsgText = document.getElementById('no-data-msg-text');

    // No-data + chart col elements (Monthly)
    const noDataEl = document.getElementById('analytics-no-data');
    const chartHoursCol = document.getElementById('analytics-chart-hours-col');
    const chartStationsCol = document.getElementById('analytics-chart-stations-col');

    if (!navDashboard || !navAnalytics || !dashboardGrid || !analyticsContainer) {
        console.error('[analytics.js] Required navigation or container elements not found.');
        return;
    }

    // Chart instances
    let overallPeakHoursChart = null;
    let overallPopularStationsChart = null;
    let monthlyPeakHoursChart = null;
    let monthlyPopularStationsChart = null;

    let currentPeriod = 'month';
    let currentYear = new Date().getFullYear();
    let currentMonthNum = new Date().getMonth() + 1;

    // Station colors matching STATION_COLORS in map.js
    const stationColors = {
        'palma_hall': '#22d3ee',
        'chk': '#a78bfa',
        'eee': '#34d399',
        'engg': '#fb923c',
        'vinzons': '#f472b6',
        'nec': '#facc15',
        'ncpag': '#60a5fa'
    };

    const stationLabels = {
        'palma_hall': 'Palma Hall',
        'chk': 'CHK',
        'eee': 'EEE Building',
        'engg': 'Engineering',
        'vinzons': 'Vinzons Hall',
        'nec': 'NEC Building',
        'ncpag': 'NCPAG'
    };

    function getThemeColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (theme === 'light') {
            return {
                text: '#4b5563',
                grid: 'rgba(0, 0, 0, 0.06)',
                tooltipBg: '#ffffff',
                tooltipText: '#111827',
                borderColor: '#ffffff',
                lineBorder: '#7B1113',
                lineFillStart: 'rgba(123, 17, 19, 0.35)',
                lineFillEnd: 'rgba(123, 17, 19, 0.0)'
            };
        } else {
            return {
                text: '#9ca3af',
                grid: 'rgba(255, 255, 255, 0.06)',
                tooltipBg: '#1f2937',
                tooltipText: '#f9fafb',
                borderColor: '#1f2937',
                lineBorder: '#e53e3e',
                lineFillStart: 'rgba(229, 62, 62, 0.35)',
                lineFillEnd: 'rgba(229, 62, 62, 0.0)'
            };
        }
    }

    function refreshMapSize() {
        if (window.leafletMap) {
            setTimeout(() => {
                window.leafletMap.invalidateSize();
            }, 100);
        }
    }

    // ── Timeframe Dropdown Logic ────────────────────────────────────────────
    function toggleMonthVisibility(isYearly) {
        if (monthWrapper) {
            if (isYearly) {
                monthWrapper.classList.remove('d-flex');
                monthWrapper.classList.add('d-none');
                monthWrapper.style.setProperty('display', 'none', 'important');
            } else {
                monthWrapper.classList.remove('d-none');
                monthWrapper.classList.add('d-flex');
                monthWrapper.style.setProperty('display', 'flex', 'important');
            }
        }
        if (monthSelect) {
            monthSelect.style.setProperty('display', isYearly ? 'none' : '', isYearly ? 'important' : '');
        }
    }

    if (periodSelect && yearSelect && monthSelect) {
        periodSelect.addEventListener('change', () => {
            currentPeriod = periodSelect.value;
            toggleMonthVisibility(currentPeriod === 'year');
            loadAnalyticsData(currentPeriod, yearSelect.value, monthSelect.value);
        });

        yearSelect.addEventListener('change', () => {
            if (yearSelect.value && String(yearSelect.value).length === 4) {
                loadAnalyticsData(periodSelect.value, yearSelect.value, monthSelect.value);
            }
        });
        yearSelect.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' && yearSelect.value && String(yearSelect.value).length === 4) {
                loadAnalyticsData(periodSelect.value, yearSelect.value, monthSelect.value);
            }
        });

        monthSelect.addEventListener('change', () => {
            if (periodSelect.value === 'month') {
                loadAnalyticsData('month', yearSelect.value, monthSelect.value);
            }
        });
    }

    function populateYearsDropdown(availableYears, selectedYear) {
        if (!yearSelect) return;
        const datalist = document.getElementById('analytics-years-datalist');
        const rawYears = availableYears && availableYears.length > 0 ? availableYears : [new Date().getFullYear()];
        let uniqueYears = Array.from(new Set(rawYears.map(y => Number(y)))).sort((a, b) => b - a);

        if (datalist) {
            datalist.innerHTML = '';
            uniqueYears.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                datalist.appendChild(opt);
            });
        }

        if (selectedYear) {
            yearSelect.value = selectedYear;
        } else if (!yearSelect.value) {
            yearSelect.value = new Date().getFullYear();
        }
    }

    // ── Nav View Switching ──────────────────────────────────────────────────
    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();

        navDashboard.classList.add('active');
        navAnalytics.classList.remove('active');
        if (navMap) navMap.classList.remove('active');
        document.body.classList.remove('non-map-view');

        if (heroMap) {
            heroMap.style.setProperty('display', 'block');
            heroMap.style.height = '450px';
        }
        if (mainWrapper) {
            mainWrapper.style.overflowY = 'auto';
        }
        dashboardGrid.style.display = 'grid';
        analyticsContainer.style.display = 'none';

        refreshMapSize();
    });

    if (navMap) {
        navMap.addEventListener('click', (e) => {
            e.preventDefault();

            navMap.classList.add('active');
            navDashboard.classList.remove('active');
            navAnalytics.classList.remove('active');
            document.body.classList.remove('non-map-view');

            if (heroMap) {
                heroMap.style.setProperty('display', 'block');
                heroMap.style.height = '100%';
            }
            if (mainWrapper) {
                mainWrapper.style.overflowY = 'hidden';
            }
            dashboardGrid.style.display = 'none';
            analyticsContainer.style.display = 'none';

            refreshMapSize();
        });
    }

    navAnalytics.addEventListener('click', (e) => {
        e.preventDefault();

        navAnalytics.classList.add('active');
        navDashboard.classList.remove('active');
        if (navMap) navMap.classList.remove('active');
        document.body.classList.add('non-map-view');

        if (heroMap) heroMap.style.setProperty('display', 'none', 'important');
        if (mainWrapper) {
            mainWrapper.style.overflowY = 'auto';
        }
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        dashboardGrid.style.display = 'none';

        analyticsContainer.style.display = 'block';

        // Always load the current month when switching to the analytics view
        loadAnalyticsData('month', new Date().getFullYear(), new Date().getMonth() + 1);
    });

    // ── Data Loading ────────────────────────────────────────────────────────
    async function loadAnalyticsData(period = 'month', year = null, monthNum = null) {
        if (!year) year = new Date().getFullYear();
        if (!monthNum) monthNum = new Date().getMonth() + 1;

        currentPeriod = period;
        currentYear = Number(year);
        currentMonthNum = Number(monthNum);

        if (periodSelect) periodSelect.value = period;
        if (monthSelect) {
            monthSelect.value = String(monthNum);
        }
        if (typeof toggleMonthVisibility === 'function') {
            toggleMonthVisibility(period === 'year');
        }

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const displayLabel = period === 'year' ? `Year ${year}` : `${monthNames[monthNum - 1]} ${year}`;

        if (monthLabelEl) monthLabelEl.textContent = displayLabel;
        if (periodicTitleEl) periodicTitleEl.textContent = period === 'year' ? 'Yearly Analytics' : 'Monthly Analytics';
        if (monthlyPeakHoursTitleEl) monthlyPeakHoursTitleEl.textContent = `Peak Usage Hours (${displayLabel})`;
        if (monthlyPopularStationsTitleEl) monthlyPopularStationsTitleEl.textContent = `Most Popular Stations (${displayLabel})`;

        try {
            const url = `/api/analytics?period=${period}&year=${year}&month_num=${monthNum}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                updateOverallStatsBanner(data.overallPeakHours, data.overallPopularStations, data.overallTotalRides);
                renderOverallCharts(data.overallPeakHours, data.overallPopularStations);

                populateYearsDropdown(data.availableYears || [], data.year || year);

                const hasData = (data.peakHours && data.peakHours.length > 0) ||
                                (data.popularStations && data.popularStations.length > 0) ||
                                (data.totalRides > 0);

                if (hasData) {
                    if (noDataEl) noDataEl.style.display = 'none';
                    if (chartHoursCol) chartHoursCol.style.display = '';
                    if (chartStationsCol) chartStationsCol.style.display = '';
                    updateMonthlyStatsBanner(data.peakHours, data.popularStations, data.totalRides);
                    renderMonthlyCharts(data.peakHours, data.popularStations);
                } else {
                    if (noDataEl) noDataEl.style.display = '';
                    if (noDataMsgText) noDataMsgText.textContent = `No ride data for ${displayLabel}.`;
                    if (chartHoursCol) chartHoursCol.style.display = 'none';
                    if (chartStationsCol) chartStationsCol.style.display = 'none';
                    if (monthlyTotalRidesEl) monthlyTotalRidesEl.textContent = '0';
                    if (monthlyPeakHourEl) monthlyPeakHourEl.textContent = '--';
                    if (monthlyTopHubEl) monthlyTopHubEl.textContent = '--';
                    if (monthlyDoughnutCenterValEl) monthlyDoughnutCenterValEl.textContent = '0';
                }
            } else {
                console.error('[analytics.js] Backend error:', data.error);
            }
        } catch (err) {
            console.error('[analytics.js] Failed to fetch analytics:', err);
        }
    }

    // ── Stats Banner Computation & Display ──────────────────────────────────
    function formatHour(hour) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:00 ${ampm}`;
    }

    function updateOverallStatsBanner(peakHoursData, popularStationsData, explicitTotalRides) {
        let total = explicitTotalRides !== undefined && explicitTotalRides !== null ? explicitTotalRides : 0;
        if (explicitTotalRides === undefined || explicitTotalRides === null) {
            popularStationsData.forEach(s => total += s.count);
        }
        if (overallTotalRidesEl) overallTotalRidesEl.textContent = total;
        if (overallDoughnutCenterValEl) overallDoughnutCenterValEl.textContent = total;

        let maxCount = -1;
        let peakHour = null;
        peakHoursData.forEach(item => {
            if (item.count > maxCount) {
                maxCount = item.count;
                peakHour = item.hour;
            }
        });
        if (overallPeakHourEl) {
            overallPeakHourEl.textContent = peakHour !== null ? formatHour(peakHour) : '--';
        }

        if (popularStationsData.length > 0) {
            const top = popularStationsData[0];
            const key = top.station.toLowerCase().trim();
            const label = stationLabels[key] || top.station.toUpperCase();
            if (overallTopHubEl) {
                overallTopHubEl.textContent = `${label} (${top.count})`;
            }
        } else {
            if (overallTopHubEl) overallTopHubEl.textContent = '--';
        }
    }

    function updateMonthlyStatsBanner(peakHoursData, popularStationsData, explicitTotalRides) {
        let total = explicitTotalRides !== undefined && explicitTotalRides !== null ? explicitTotalRides : 0;
        if (explicitTotalRides === undefined || explicitTotalRides === null) {
            popularStationsData.forEach(s => total += s.count);
        }
        if (monthlyTotalRidesEl) monthlyTotalRidesEl.textContent = total;
        if (monthlyDoughnutCenterValEl) monthlyDoughnutCenterValEl.textContent = total;

        let maxCount = -1;
        let peakHour = null;
        peakHoursData.forEach(item => {
            if (item.count > maxCount) {
                maxCount = item.count;
                peakHour = item.hour;
            }
        });
        if (monthlyPeakHourEl) {
            monthlyPeakHourEl.textContent = peakHour !== null ? formatHour(peakHour) : '--';
        }

        if (popularStationsData.length > 0) {
            const top = popularStationsData[0];
            const key = top.station.toLowerCase().trim();
            const label = stationLabels[key] || top.station.toUpperCase();
            if (monthlyTopHubEl) {
                monthlyTopHubEl.textContent = `${label} (${top.count})`;
            }
        } else {
            if (monthlyTopHubEl) monthlyTopHubEl.textContent = '--';
        }
    }

    // ── Chart Rendering (Overall) ───────────────────────────────────────────
    function renderOverallCharts(peakHoursData, popularStationsData) {
        const theme = getThemeColors();

        // 1. Overall Line Chart
        const hourlyCounts = Array(24).fill(0);
        peakHoursData.forEach(item => {
            if (item.hour >= 0 && item.hour < 24) {
                hourlyCounts[item.hour] = item.count;
            }
        });

        const hourLabels = Array.from({ length: 24 }, (_, i) => {
            const ampm = i >= 12 ? 'PM' : 'AM';
            const displayHour = i % 12 === 0 ? 12 : i % 12;
            return `${displayHour} ${ampm}`;
        });

        const ctxHours = document.getElementById('chart-overall-peak-hours');
        if (ctxHours) {
            if (overallPeakHoursChart) {
                overallPeakHoursChart.destroy();
            }

            const ctx = ctxHours.getContext('2d');
            const fillGradient = ctx.createLinearGradient(0, 0, 0, ctxHours.offsetHeight || 300);
            fillGradient.addColorStop(0, theme.lineFillStart);
            fillGradient.addColorStop(1, theme.lineFillEnd);

            overallPeakHoursChart = new Chart(ctxHours, {
                type: 'line',
                data: {
                    labels: hourLabels,
                    datasets: [{
                        label: 'Rides',
                        data: hourlyCounts,
                        borderColor: theme.lineBorder,
                        backgroundColor: fillGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: theme.lineBorder,
                        pointBorderColor: theme.borderColor,
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: theme.lineBorder,
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.tooltipText,
                            bodyColor: theme.tooltipText,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 10,
                            font: { family: 'Inter' }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: theme.grid, drawBorder: false },
                            ticks: { 
                                color: theme.text, 
                                font: { family: 'Inter', size: 10 },
                                maxTicksLimit: window.innerWidth < 768 ? 6 : 12
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.grid, drawBorder: false },
                            ticks: { color: theme.text, precision: 0, font: { family: 'Inter', size: 10 } }
                        }
                    }
                }
            });
        }

        // 2. Overall Doughnut Chart
        const stationNames = [];
        const stationCounts = [];
        const backgroundColors = [];

        popularStationsData.forEach(item => {
            const key = item.station.toLowerCase().trim();
            const label = stationLabels[key] || item.station.toUpperCase();
            const color = stationColors[key] || '#10b981';

            stationNames.push(label);
            stationCounts.push(item.count);
            backgroundColors.push(color);
        });

        const ctxStations = document.getElementById('chart-overall-popular-stations');
        if (ctxStations) {
            if (overallPopularStationsChart) {
                overallPopularStationsChart.destroy();
            }

            overallPopularStationsChart = new Chart(ctxStations, {
                type: 'doughnut',
                data: {
                    labels: stationNames,
                    datasets: [{
                        data: stationCounts,
                        backgroundColor: backgroundColors,
                        borderWidth: 2,
                        borderColor: theme.borderColor,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: {
                            display: window.innerWidth > 768,
                            position: 'bottom',
                            labels: {
                                color: theme.text,
                                font: { family: 'Inter', size: 10, weight: '500' },
                                boxWidth: 10,
                                boxHeight: 10,
                                padding: 12
                            }
                        },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.tooltipText,
                            bodyColor: theme.tooltipText,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 10,
                            font: { family: 'Inter' }
                        }
                    }
                }
            });
        }
    }

    // ── Chart Rendering (Monthly) ───────────────────────────────────────────
    function renderMonthlyCharts(peakHoursData, popularStationsData) {
        const theme = getThemeColors();

        // 1. Monthly Line Chart
        const hourlyCounts = Array(24).fill(0);
        peakHoursData.forEach(item => {
            if (item.hour >= 0 && item.hour < 24) {
                hourlyCounts[item.hour] = item.count;
            }
        });

        const hourLabels = Array.from({ length: 24 }, (_, i) => {
            const ampm = i >= 12 ? 'PM' : 'AM';
            const displayHour = i % 12 === 0 ? 12 : i % 12;
            return `${displayHour} ${ampm}`;
        });

        const ctxHours = document.getElementById('chart-peak-hours');
        if (ctxHours) {
            if (monthlyPeakHoursChart) {
                monthlyPeakHoursChart.destroy();
            }

            const ctx = ctxHours.getContext('2d');
            const fillGradient = ctx.createLinearGradient(0, 0, 0, ctxHours.offsetHeight || 300);
            fillGradient.addColorStop(0, theme.lineFillStart);
            fillGradient.addColorStop(1, theme.lineFillEnd);

            monthlyPeakHoursChart = new Chart(ctxHours, {
                type: 'line',
                data: {
                    labels: hourLabels,
                    datasets: [{
                        label: 'Rides',
                        data: hourlyCounts,
                        borderColor: theme.lineBorder,
                        backgroundColor: fillGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: theme.lineBorder,
                        pointBorderColor: theme.borderColor,
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: theme.lineBorder,
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.tooltipText,
                            bodyColor: theme.tooltipText,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 10,
                            font: { family: 'Inter' }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: theme.grid, drawBorder: false },
                            ticks: { 
                                color: theme.text, 
                                font: { family: 'Inter', size: 10 },
                                maxTicksLimit: window.innerWidth < 768 ? 6 : 12
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.grid, drawBorder: false },
                            ticks: { color: theme.text, precision: 0, font: { family: 'Inter', size: 10 } }
                        }
                    }
                }
            });
        }

        // 2. Monthly Doughnut Chart
        const stationNames = [];
        const stationCounts = [];
        const backgroundColors = [];

        popularStationsData.forEach(item => {
            const key = item.station.toLowerCase().trim();
            const label = stationLabels[key] || item.station.toUpperCase();
            const color = stationColors[key] || '#10b981';

            stationNames.push(label);
            stationCounts.push(item.count);
            backgroundColors.push(color);
        });

        const ctxStations = document.getElementById('chart-popular-stations');
        if (ctxStations) {
            if (monthlyPopularStationsChart) {
                monthlyPopularStationsChart.destroy();
            }

            monthlyPopularStationsChart = new Chart(ctxStations, {
                type: 'doughnut',
                data: {
                    labels: stationNames,
                    datasets: [{
                        data: stationCounts,
                        backgroundColor: backgroundColors,
                        borderWidth: 2,
                        borderColor: theme.borderColor,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: {
                            display: window.innerWidth > 768,
                            position: 'bottom',
                            labels: {
                                color: theme.text,
                                font: { family: 'Inter', size: 10, weight: '500' },
                                boxWidth: 10,
                                boxHeight: 10,
                                padding: 12
                            }
                        },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.tooltipText,
                            bodyColor: theme.tooltipText,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 10,
                            font: { family: 'Inter' }
                        }
                    }
                }
            });
        }
    }

    // ── Theme Switch Re-render ──────────────────────────────────────────────
    window.addEventListener('themeChanged', () => {
        const theme = getThemeColors();

        // 1. Overall Line Chart Update
        if (overallPeakHoursChart) {
            const ctxHours = document.getElementById('chart-overall-peak-hours');
            if (ctxHours) {
                const ctx = ctxHours.getContext('2d');
                const fillGradient = ctx.createLinearGradient(0, 0, 0, ctxHours.offsetHeight || 300);
                fillGradient.addColorStop(0, theme.lineFillStart);
                fillGradient.addColorStop(1, theme.lineFillEnd);

                overallPeakHoursChart.data.datasets[0].backgroundColor = fillGradient;
            }

            overallPeakHoursChart.data.datasets[0].borderColor = theme.lineBorder;
            overallPeakHoursChart.data.datasets[0].pointBackgroundColor = theme.lineBorder;
            overallPeakHoursChart.data.datasets[0].pointBorderColor = theme.borderColor;

            overallPeakHoursChart.options.scales.x.grid.color = theme.grid;
            overallPeakHoursChart.options.scales.x.ticks.color = theme.text;
            overallPeakHoursChart.options.scales.y.grid.color = theme.grid;
            overallPeakHoursChart.options.scales.y.ticks.color = theme.text;

            overallPeakHoursChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
            overallPeakHoursChart.options.plugins.tooltip.titleColor = theme.tooltipText;
            overallPeakHoursChart.options.plugins.tooltip.bodyColor = theme.tooltipText;
            overallPeakHoursChart.update();
        }

        // 2. Overall Doughnut Chart Update
        if (overallPopularStationsChart) {
            overallPopularStationsChart.options.plugins.legend.labels.color = theme.text;
            overallPopularStationsChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
            overallPopularStationsChart.options.plugins.tooltip.titleColor = theme.tooltipText;
            overallPopularStationsChart.options.plugins.tooltip.bodyColor = theme.tooltipText;

            overallPopularStationsChart.data.datasets[0].borderColor = theme.borderColor;
            overallPopularStationsChart.update();
        }

        // 3. Monthly Line Chart Update
        if (monthlyPeakHoursChart) {
            const ctxHours = document.getElementById('chart-peak-hours');
            if (ctxHours) {
                const ctx = ctxHours.getContext('2d');
                const fillGradient = ctx.createLinearGradient(0, 0, 0, ctxHours.offsetHeight || 300);
                fillGradient.addColorStop(0, theme.lineFillStart);
                fillGradient.addColorStop(1, theme.lineFillEnd);

                monthlyPeakHoursChart.data.datasets[0].backgroundColor = fillGradient;
            }

            monthlyPeakHoursChart.data.datasets[0].borderColor = theme.lineBorder;
            monthlyPeakHoursChart.data.datasets[0].pointBackgroundColor = theme.lineBorder;
            monthlyPeakHoursChart.data.datasets[0].pointBorderColor = theme.borderColor;

            monthlyPeakHoursChart.options.scales.x.grid.color = theme.grid;
            monthlyPeakHoursChart.options.scales.x.ticks.color = theme.text;
            monthlyPeakHoursChart.options.scales.y.grid.color = theme.grid;
            monthlyPeakHoursChart.options.scales.y.ticks.color = theme.text;

            monthlyPeakHoursChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
            monthlyPeakHoursChart.options.plugins.tooltip.titleColor = theme.tooltipText;
            monthlyPeakHoursChart.options.plugins.tooltip.bodyColor = theme.tooltipText;
            monthlyPeakHoursChart.update();
        }

        // 4. Monthly Doughnut Chart Update
        if (monthlyPopularStationsChart) {
            monthlyPopularStationsChart.options.plugins.legend.labels.color = theme.text;
            monthlyPopularStationsChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
            monthlyPopularStationsChart.options.plugins.tooltip.titleColor = theme.tooltipText;
            monthlyPopularStationsChart.options.plugins.tooltip.bodyColor = theme.tooltipText;

            monthlyPopularStationsChart.data.datasets[0].borderColor = theme.borderColor;
            monthlyPopularStationsChart.update();
        }
    });
});
