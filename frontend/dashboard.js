const API_BASE = 'http://localhost:8000';

// ── Category → Icon mapping ──
const CATEGORY_ICONS = {
    'Data & AI': '🤖',
    'Development': '💻',
    'Cloud & DevOps': '☁️',
    'Security': '🔒',
    'Design': '🎨',
    'Management': '📋',
    'Testing & QA': '🧪',
    'Networking': '🌐',
    'Database': '🗄️',
    'Analytics': '📊',
    'default': '⚡'
};

function getCategoryIcon(category) {
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
        if (category && category.toLowerCase().includes(key.toLowerCase())) {
            return icon;
        }
    }
    return CATEGORY_ICONS['default'];
}

function getMatchClass(score) {
    if (score >= 0.7) return '';
    if (score >= 0.4) return 'medium';
    return 'low';
}

function getScoreColor(score) {
    if (score >= 70) return '#1a7a3a';
    if (score >= 40) return '#b8860b';
    return '#a8201a';
}

// ── Auth check ──
const userData = localStorage.getItem('tf_user');
if (!userData) {
    window.location.href = 'auth.html';
}
const user = JSON.parse(userData);

// ── DOM refs ──
const welcomeHeading = document.getElementById('welcomeHeading');
const welcomeSub = document.getElementById('welcomeSub');
const loadingEl = document.getElementById('dashLoading');
const contentEl = document.getElementById('dashContent');
const errorEl = document.getElementById('dashError');
const errorMsg = document.getElementById('errorMsg');
const noResumeEl = document.getElementById('noResume');
const rolesGrid = document.getElementById('rolesGrid');
const scoreCircle = document.getElementById('scoreCircleFill');
const scoreValue = document.getElementById('scoreValue');
const scoreLabel = document.getElementById('scoreLabel');

// ── Init ──
welcomeHeading.textContent = `Welcome, ${user.username}`;
welcomeSub.textContent = 'Your personalized career dashboard powered by AI.';

loadDashboard();

async function loadDashboard() {
    try {
        // 1. Get user's resumes
        const resumeRes = await fetch(`${API_BASE}/api/user/${user.id}/resumes`);
        const resumeData = await resumeRes.json();
        const resumes = resumeData.resumes || [];

        if (resumes.length === 0) {
            loadingEl.style.display = 'none';
            noResumeEl.style.display = 'block';
            return;
        }

        // 2. Use the latest resume
        const latestResume = resumes[0];
        const resumeId = latestResume.id;

        // Store for navigation
        window._currentResumeId = resumeId;

        // 3. Fetch recommendations
        const recRes = await fetch(`${API_BASE}/api/recommend-roles/${resumeId}`, {
            method: 'POST'
        });
        const recData = await recRes.json();

        if (!recRes.ok || recData.status === 'error') {
            throw new Error(recData.detail || recData.message || 'Failed to get recommendations');
        }

        const recommendations = recData.recommendations || [];

        if (recommendations.length === 0) {
            loadingEl.style.display = 'none';
            noResumeEl.style.display = 'block';
            noResumeEl.querySelector('h3').textContent = 'No Matches Found';
            noResumeEl.querySelector('p').textContent = 'We couldn\'t find role matches. Try uploading a more detailed resume.';
            return;
        }

        // 4. Render role cards
        renderRoleCards(recommendations.slice(0, 5), resumeId);

        // 5. Calculate & render score
        const avgScore = recommendations.reduce((sum, r) => sum + (r.match_score || 0), 0) / recommendations.length;
        renderScore(avgScore);

        // Show content
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

    } catch (err) {
        console.error('Dashboard error:', err);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorMsg.textContent = err.message || 'Could not load dashboard data.';
    }
}

function renderRoleCards(roles, resumeId) {
    rolesGrid.innerHTML = '';
    roles.forEach((role, i) => {
        const icon = getCategoryIcon(role.category);
        const matchPct = Math.round((role.match_score || 0) * 100);
        const matchCls = getMatchClass(role.match_score || 0);
        const encodedRole = encodeURIComponent(role.role_name);

        const card = document.createElement('div');
        card.className = 'role-card';
        card.innerHTML = `
            <div class="role-icon">${icon}</div>
            <div class="role-name">${role.role_name}</div>
            <div class="role-match ${matchCls}">${matchPct}% Match</div>
            <a href="course.html?resume_id=${resumeId}&role=${encodedRole}" class="role-btn">Get the Path →</a>
        `;
        rolesGrid.appendChild(card);
    });
}

function renderScore(avgScore) {
    const pct = Math.round(avgScore * 100);
    const color = getScoreColor(pct);

    // SVG circle params
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    scoreCircle.style.stroke = color;
    scoreCircle.setAttribute('r', radius);
    scoreCircle.style.strokeDasharray = circumference;
    scoreCircle.style.strokeDashoffset = circumference;

    // Animate after a brief delay
    setTimeout(() => {
        scoreCircle.style.strokeDashoffset = offset;
    }, 200);

    // Animate number
    animateValue(scoreValue, 0, pct, 1200);

    // Label text
    if (pct >= 70) {
        scoreLabel.textContent = 'Excellent — Your skills are well-aligned with the market.';
    } else if (pct >= 40) {
        scoreLabel.textContent = 'Good — Some upskilling recommended to strengthen your profile.';
    } else {
        scoreLabel.textContent = 'Needs Improvement — Consider focused learning to close skill gaps.';
    }
}

function animateValue(el, start, end, duration) {
    const startTime = performance.now();
    function step(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.round(start + (end - start) * easeOut(progress));
        el.innerHTML = `${current}<span>%</span>`;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ── Logout ──
function logout() {
    localStorage.removeItem('tf_user');
    localStorage.removeItem('tf_resumes');
    window.location.href = 'auth.html';
}

document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});
