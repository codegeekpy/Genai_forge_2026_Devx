const API_BASE = 'http://localhost:8000';

const CATEGORY_ICONS = {
    'Data & AI': '🤖', 'Development': '💻', 'Cloud & DevOps': '☁️',
    'Security': '🔒', 'Design': '🎨', 'Management': '📋',
    'Testing & QA': '🧪', 'Networking': '🌐', 'Database': '🗄️',
    'Analytics': '📊', 'default': '⚡'
};

function getCategoryIcon(cat) {
    for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
        if (cat && cat.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return CATEGORY_ICONS['default'];
}

function getMatchClass(score) {
    if (score >= 0.7) return '';
    if (score >= 0.4) return 'medium';
    return 'low';
}

// ── Auth check ──
const userData = localStorage.getItem('tf_user');
if (!userData) window.location.href = 'auth.html';
const user = JSON.parse(userData);

// ── DOM ──
const loadingEl = document.getElementById('profileLoading');
const contentEl = document.getElementById('profileContent');
const msgEl = document.getElementById('profileMsg');

// Header
const avatarEl = document.getElementById('profileAvatar');
const nameEl = document.getElementById('profileName');
const emailEl = document.getElementById('profileEmail');
const resumeIdEl = document.getElementById('resumeIdBadge');

// Sections
const skillsList = document.getElementById('skillsList');
const missingList = document.getElementById('missingList');
const rolesList = document.getElementById('rolesList');

// Modals
const editOverlay = document.getElementById('editOverlay');
const editName = document.getElementById('editName');
const editEmail = document.getElementById('editEmail');
const deleteOverlay = document.getElementById('deleteOverlay');

let profileData = null;

// ── Load ──
loadProfile();

async function loadProfile() {
    try {
        const res = await fetch(`${API_BASE}/api/user/${user.id}/profile`);
        if (!res.ok) throw new Error('Failed to load profile');
        profileData = await res.json();
        renderProfile(profileData);
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (err) {
        loadingEl.style.display = 'none';
        showMsg('Could not load profile: ' + err.message, 'error');
    }
}

function renderProfile(data) {
    const u = data.user;
    const initials = (u.username || 'U').substring(0, 2).toUpperCase();
    avatarEl.textContent = initials;
    nameEl.textContent = u.username;
    emailEl.textContent = u.email;

    // Resume ID badge
    if (data.latest_resume_id) {
        resumeIdEl.textContent = `Resume #${data.latest_resume_id}`;
        resumeIdEl.style.display = 'inline-block';
    } else {
        resumeIdEl.textContent = 'No Resume';
        resumeIdEl.style.display = 'inline-block';
    }

    // Current skills
    skillsList.innerHTML = '';
    if (data.skills && data.skills.length > 0) {
        data.skills.forEach(s => {
            const tag = document.createElement('span');
            tag.className = 'skill-tag current';
            tag.textContent = s;
            skillsList.appendChild(tag);
        });
    } else {
        skillsList.innerHTML = '<span class="no-data">Upload a resume to see your skills.</span>';
    }

    // Missing skills
    missingList.innerHTML = '';
    if (data.missing_skills && data.missing_skills.length > 0) {
        data.missing_skills.forEach(s => {
            const tag = document.createElement('span');
            tag.className = 'skill-tag missing';
            tag.textContent = s;
            missingList.appendChild(tag);
        });
    } else {
        missingList.innerHTML = '<span class="no-data">No gaps detected yet.</span>';
    }

    // Matched roles
    rolesList.innerHTML = '';
    if (data.matched_roles && data.matched_roles.length > 0) {
        data.matched_roles.forEach(r => {
            const pct = Math.round((r.match_score || 0) * 100);
            const cls = getMatchClass(r.match_score || 0);
            const icon = getCategoryIcon(r.category);
            const item = document.createElement('div');
            item.className = 'role-item';
            item.innerHTML = `
                <div class="r-icon">${icon}</div>
                <div class="r-name">${r.role_name}</div>
                <div class="r-score ${cls}">${pct}%</div>
            `;
            rolesList.appendChild(item);
        });
    } else {
        rolesList.innerHTML = '<span class="no-data">Get role recommendations from the dashboard first.</span>';
    }
}

// ── Edit Profile ──
document.getElementById('btnEdit').addEventListener('click', () => {
    editName.value = profileData.user.username;
    editEmail.value = profileData.user.email;
    editOverlay.classList.add('active');
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
    editOverlay.classList.remove('active');
});

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btnSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API_BASE}/api/user/${user.id}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: editName.value.trim(),
                email: editEmail.value.trim()
            })
        });
        const data = await res.json();
        if (res.ok) {
            // Update localStorage
            const updatedUser = { ...user, username: data.user.username, email: data.user.email };
            localStorage.setItem('tf_user', JSON.stringify(updatedUser));
            editOverlay.classList.remove('active');
            showMsg('Profile updated successfully!', 'success');
            loadProfile();
        } else {
            showMsg(data.detail || 'Failed to update', 'error');
        }
    } catch (err) {
        showMsg('Error: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
});

// ── Delete Resume ──
document.getElementById('btnDeleteResume').addEventListener('click', () => {
    if (!profileData || !profileData.latest_resume_id) {
        showMsg('No resume to delete.', 'error');
        return;
    }
    deleteOverlay.classList.add('active');
});

document.getElementById('btnCancelDelete').addEventListener('click', () => {
    deleteOverlay.classList.remove('active');
});

document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    const resumeId = profileData.latest_resume_id;
    const confirmBtn = document.getElementById('btnConfirmDelete');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
        const res = await fetch(
            `${API_BASE}/api/resume/${resumeId}?user_id=${user.id}`,
            { method: 'DELETE' }
        );
        const data = await res.json();
        if (res.ok) {
            deleteOverlay.classList.remove('active');
            showMsg('Resume deleted successfully.', 'success');
            loadProfile();
        } else {
            showMsg(data.detail || 'Failed to delete', 'error');
            deleteOverlay.classList.remove('active');
        }
    } catch (err) {
        showMsg('Error: ' + err.message, 'error');
        deleteOverlay.classList.remove('active');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
    }
});

// ── Helpers ──
function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'profile-msg ' + type;
    setTimeout(() => { msgEl.className = 'profile-msg'; }, 5000);
}

// Logout
document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('tf_user');
    localStorage.removeItem('tf_resumes');
    window.location.href = 'auth.html';
});
