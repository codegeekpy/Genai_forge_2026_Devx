const API_BASE_URL = 'http://localhost:8000';

// DOM Elements
const form = document.getElementById('applicationForm');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');
const jobRolesGrid = document.getElementById('job_roles_grid');

// Load options on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadOptions();
});

// Fetch and populate job roles as checkboxes
async function loadOptions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/options`);
        const data = await response.json();

        data.job_roles.forEach((role, index) => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `role_${index}`;
            checkbox.name = 'job_roles';
            checkbox.value = role;

            const label = document.createElement('label');
            label.htmlFor = `role_${index}`;
            label.textContent = role;

            checkbox.addEventListener('change', function () {
                checkboxItem.classList.toggle('checked', this.checked);
            });

            checkboxItem.appendChild(checkbox);
            checkboxItem.appendChild(label);

            checkboxItem.addEventListener('click', function (e) {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            jobRolesGrid.appendChild(checkboxItem);
        });
    } catch (error) {
        console.error('Error loading options:', error);
        showMessage('Failed to load form options. Please refresh the page.', 'error');
    }
}

// Form submission handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    hideMessage();

    const selectedRoles = Array.from(
        document.querySelectorAll('input[name="job_roles"]:checked')
    ).map((cb) => cb.value);

    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        job_roles: selectedRoles,
    };

    if (!validateForm(formData)) return;

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(
                result.message + ' Redirecting to resume upload...',
                'success'
            );
            document.querySelectorAll('.checkbox-item').forEach((item) => {
                item.classList.remove('checked');
            });
            setTimeout(() => {
                window.location.href = 'resume.html';
            }, 2000);
        } else {
            showMessage(
                result.detail || 'Submission failed. Please try again.',
                'error'
            );
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showMessage(
            'Network error. Please check if the server is running and try again.',
            'error'
        );
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Submit Application';
    }
});

// Validation
function validateForm(data) {
    let isValid = true;

    if (data.name.length < 2) {
        showError('name', 'Name must be at least 2 characters long');
        isValid = false;
    }

    if (!isValidEmail(data.email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (data.password.length < 6) {
        showError('password', 'Password must be at least 6 characters long');
        isValid = false;
    }

    const confirmPassword = document.getElementById('confirm_password').value;
    if (confirmPassword !== data.password) {
        showError('confirm_password', 'Passwords do not match');
        isValid = false;
    }

    if (!data.job_roles || data.job_roles.length === 0) {
        showError('job_roles', 'Please select at least one job role');
        isValid = false;
    }

    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(fieldName, message) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    const inputEl = document.getElementById(fieldName);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.style.borderColor = '#a8201a';
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach((el) => {
        el.textContent = '';
    });
    document.querySelectorAll('input, select').forEach((el) => {
        el.style.borderColor = '';
    });
}

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(hideMessage, 5000);
}

function hideMessage() {
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
}

// Real-time validation
document.getElementById('email').addEventListener('blur', function () {
    if (this.value && !isValidEmail(this.value)) {
        showError('email', 'Please enter a valid email address');
    }
});

document.getElementById('password').addEventListener('input', function () {
    const errorEl = document.getElementById('password-error');
    if (this.value.length > 0 && this.value.length < 6) {
        errorEl.textContent = `${6 - this.value.length} more characters needed`;
    } else {
        errorEl.textContent = '';
    }

    const confirm = document.getElementById('confirm_password');
    const confirmErr = document.getElementById('confirm_password-error');
    if (confirm.value && confirm.value !== this.value) {
        showError('confirm_password', 'Passwords do not match');
    } else if (confirm.value === this.value && this.value.length >= 6) {
        confirmErr.textContent = '✓ Passwords match';
        confirmErr.style.color = '#1a7a3a';
        confirm.style.borderColor = '#1a7a3a';
    }
});

document.getElementById('confirm_password').addEventListener('input', function () {
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('confirm_password-error');

    if (this.value && this.value !== password) {
        showError('confirm_password', 'Passwords do not match');
    } else if (this.value === password && this.value.length >= 6) {
        errorEl.textContent = '✓ Passwords match';
        errorEl.style.color = '#1a7a3a';
        this.style.borderColor = '#1a7a3a';
    } else {
        errorEl.textContent = '';
        errorEl.style.color = '#a8201a';
        this.style.borderColor = '';
    }
});
