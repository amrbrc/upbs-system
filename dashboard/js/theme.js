// public/js/theme.js
// Handles Light / Dark mode toggling and saves preference to localStorage.

const THEME_KEY = 'upbs_theme';

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    // Default to dark mode if no saved theme
    const theme = savedTheme === 'light' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
    
    // Fire a custom event so map.js knows to swap the tile layer
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'light' ? '<i class="bi bi-moon-fill"></i>' : '<i class="bi bi-sun-fill"></i>';
        btn.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }
}

// Run immediately to prevent flash of wrong theme
initTheme();

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);

    // --- Mobile Menu Toggle & Backdrop Overlay ---
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }

    // Close sidebar on backdrop click
    backdrop.addEventListener('click', () => {
        document.body.classList.remove('sidebar-open');
    });

    // Auto-close sidebar when clicking any navigation link
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });
    });

    // Mobile live clock handler
    const mobileTimeEl = document.getElementById('mobile-live-time');
    if (mobileTimeEl) {
        setInterval(() => {
            const now = new Date();
            mobileTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }, 1000);
    }
});

// Custom Toast/Alert system override
(function() {
    let container = null;
    
    function ensureContainer() {
        if (!container) {
            container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
        }
    }

    window.showToast = function(message, type = 'info', duration = 4000) {
        ensureContainer();
        const toast = document.createElement('div');
        toast.className = `custom-toast toast-${type}`;
        
        let borderLeftColor = '#3b82f6';
        if (type === 'success') borderLeftColor = '#10b981';
        else if (type === 'error') borderLeftColor = '#ef4444';
        else if (type === 'warning') borderLeftColor = '#f59e0b';

        // Check if message contains success/failed indicators to auto-type
        const lowerMsg = message.toLowerCase();
        if (type === 'info') {
            if (lowerMsg.includes('success') || lowerMsg.includes('thank you') || lowerMsg.includes('registered') || lowerMsg.includes('reactivated') || lowerMsg.includes('activated') || lowerMsg.includes('applied')) {
                toast.classList.remove('toast-info');
                toast.classList.add('toast-success');
                borderLeftColor = '#10b981';
            } else if (lowerMsg.includes('fail') || lowerMsg.includes('error') || lowerMsg.includes('invalid') || lowerMsg.includes('denied') || lowerMsg.includes('connection error')) {
                toast.classList.remove('toast-info');
                toast.classList.add('toast-error');
                borderLeftColor = '#ef4444';
            }
        }

        toast.style.borderLeft = `4px solid ${borderLeftColor}`;

        toast.innerHTML = `
            <div class="toast-content">${message.replace(/\n/g, '<br>')}</div>
            <button class="toast-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem; line-height:1;">&times;</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        const dismiss = () => {
            toast.style.animation = 'toast-fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        };

        closeBtn.onclick = dismiss;

        const timer = setTimeout(dismiss, duration);
        toast.dataset.timer = timer;

        container.appendChild(toast);
    };

    // Override window.alert
    window.alert = function(msg) {
        window.showToast(msg, 'info');
    };
})();
