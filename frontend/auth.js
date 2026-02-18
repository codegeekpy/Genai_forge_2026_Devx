const API_BASE = 'http://localhost:8000';

// ── Tab Switching ──
function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
    }
    clearAllErrors();
}

// ── Login ──
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !isValidEmail(email)) {
        showFieldError('loginEmail', 'Please enter a valid email address');
        return;
    }
    if (password.length < 6) {
        showFieldError('loginPassword', 'Password must be at least 6 characters');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // Store user in localStorage
            localStorage.setItem('tf_user', JSON.stringify(data.user));
            localStorage.setItem('tf_resumes', JSON.stringify(data.resumes || []));

            showMsg('loginMessage', 'Login successful! Redirecting...', 'success');

            // Route: has resumes → dashboard, else → new user flow
            setTimeout(() => {
                if (data.has_resumes) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'resume.html';
                }
            }, 1200);
        } else {
            showMsg('loginMessage', data.detail || 'Login failed', 'error');
        }
    } catch (err) {
        showMsg('loginMessage', 'Network error. Is the server running?', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});

// ── Signup ──
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    let valid = true;

    if (username.length < 2) {
        showFieldError('signupUsername', 'Name must be at least 2 characters');
        valid = false;
    }
    if (!email || !isValidEmail(email)) {
        showFieldError('signupEmail', 'Please enter a valid email address');
        valid = false;
    }
    if (password.length < 6) {
        showFieldError('signupPassword', 'Password must be at least 6 characters');
        valid = false;
    }
    if (password !== confirm) {
        showFieldError('signupConfirm', 'Passwords do not match');
        valid = false;
    }

    if (!valid) return;

    const btn = document.getElementById('signupBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // Store user in localStorage
            localStorage.setItem('tf_user', JSON.stringify(data.user));
            localStorage.setItem('tf_resumes', JSON.stringify([]));

            showMsg('signupMessage', 'Account created! Redirecting...', 'success');

            // New user → resume upload flow
            setTimeout(() => {
                window.location.href = 'resume.html';
            }, 1200);
        } else {
            showMsg('signupMessage', data.detail || 'Signup failed', 'error');
        }
    } catch (err) {
        showMsg('signupMessage', 'Network error. Is the server running?', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
});

// ── Helpers ──
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(fieldId, msg) {
    const errEl = document.getElementById(`${fieldId}-error`);
    const input = document.getElementById(fieldId);
    if (errEl) errEl.textContent = msg;
    if (input) input.style.borderColor = '#a8201a';
}

function clearAllErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.auth-form input').forEach(el => el.style.borderColor = '');
    document.querySelectorAll('.message').forEach(el => el.style.display = 'none');
}

function showMsg(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = `message ${type}`;
    el.style.display = 'block';
}

// ── Check if already logged in ──
(function () {
    const user = localStorage.getItem('tf_user');
    if (user) {
        try {
            const u = JSON.parse(user);
            if (u && u.id) {
                // Already logged in, go to dashboard
                window.location.href = 'dashboard.html';
            }
        } catch (e) { }
    }
})();
