// public/js/history.js
// Handles searching and rendering bicycle usage history.

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('btn-search-history');
    const bikeInput = document.getElementById('history-bike-code');
    const resultsDiv = document.getElementById('history-results');

    if (!searchBtn || !bikeInput || !resultsDiv) {
        console.error('[history.js] Required UI elements for Bike History not found.');
        return;
    }

    // Helper to format station names to nice display names
    const stationLabels = {
        'palma_hall': 'Palma Hall',
        'chk': 'CHK',
        'eee': 'EEE',
        'engg': 'Engg',
        'vinzons': 'Vinzons',
        'nec': 'NEC',
        'ncpag': 'NCPAG'
    };

    function getLocLabel(loc) {
        if (!loc) return 'Unknown';
        const key = loc.toLowerCase().trim();
        return stationLabels[key] || loc.toUpperCase();
    }

    async function searchHistory() {
        const bicycleCode = bikeInput.value.trim();
        if (!bicycleCode) {
            resultsDiv.innerHTML = '<div style="color: var(--up-maroon); padding: 5px 0;">Please enter a valid bicycle code.</div>';
            return;
        }

        resultsDiv.innerHTML = '<div style="padding: 5px 0; display: flex; align-items: center; gap: 8px;"><span class="status-dot" style="background-color: var(--up-maroon); animation: pulse 1s infinite;"></span> Loading history...</div>';

        try {
            const response = await fetch(`/api/history/${encodeURIComponent(bicycleCode)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const history = await response.json();

            if (!Array.isArray(history) || history.length === 0) {
                resultsDiv.innerHTML = `<div style="padding: 10px 0; color: var(--text-muted);">No history records found for bicycle "${bicycleCode}".</div>`;
                return;
            }

            // Render history results
            resultsDiv.innerHTML = '';
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            ul.style.margin = '0';
            ul.style.display = 'flex';
            ul.style.flexDirection = 'column';
            ul.style.gap = '8px';

            history.forEach((record, index) => {
                const li = document.createElement('li');
                li.style.background = 'var(--bg-main)';
                li.style.borderLeft = '3px solid var(--up-maroon)';
                li.style.padding = '10px 12px';
                li.style.borderRadius = '0 8px 8px 0';
                li.style.fontSize = '0.825rem';
                li.style.opacity = '0';
                li.style.transform = 'translateY(10px)';
                li.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                
                // Construct the text content
                const fromLoc = getLocLabel(record.previous_location);
                const toLoc = getLocLabel(record.new_location);
                const borrower = record.borrowed_by || 'Anonymous';
                
                // Format date nicely
                let timeStr = '';
                if (record.borrowed_at) {
                    const date = new Date(record.borrowed_at);
                    timeStr = date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }

                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: var(--text-h);">From: ${fromLoc} To: ${toLoc}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">${timeStr}</span>
                    </div>
                    <div style="color: var(--text); font-size: 0.75rem;">
                        Borrowed by: <span style="font-weight: 600; color: var(--text-h);">${borrower}</span>
                    </div>
                `;

                ul.appendChild(li);

                // Quick stagger animation entry
                setTimeout(() => {
                    li.style.opacity = '1';
                    li.style.transform = 'translateY(0)';
                }, index * 80);
            });

            resultsDiv.appendChild(ul);

        } catch (err) {
            console.error('[history.js] Error fetching history:', err);
            resultsDiv.innerHTML = '<div style="color: var(--up-maroon); padding: 5px 0;">Error retrieving history records. Please try again.</div>';
        }
    }

    // Event listeners
    searchBtn.addEventListener('click', searchHistory);
    
    // Support pressing Enter key in the input field
    bikeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchHistory();
        }
    });
});
