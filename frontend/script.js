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

        // Populate job roles as checkboxes
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

            // Add checked class on change
            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    checkboxItem.classList.add('checked');
                } else {
                    checkboxItem.classList.remove('checked');
                }
            });

            checkboxItem.appendChild(checkbox);
            checkboxItem.appendChild(label);

            // Make the whole div clickable
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

    // Clear previous messages and errors
    clearErrors();
    hideMessage();

    // Get selected job roles
    const selectedRoles = Array.from(document.querySelectorAll('input[name="job_roles"]:checked'))
        .map(checkbox => checkbox.value);

    // Get form data
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        job_roles: selectedRoles
    };

    // Client-side validation
    if (!validateForm(formData)) {
        return;
    }

    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message + ' Redirecting to resume upload...', 'success');
            // Clear all checked states
            document.querySelectorAll('.checkbox-item').forEach(item => {
                item.classList.remove('checked');
            });

            // Redirect to resume page after 2 seconds
            setTimeout(() => {
                window.location.href = 'resume.html';
            }, 2000);
        } else {
            showMessage(result.detail || 'Submission failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showMessage('Network error. Please check if the server is running and try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Submit Application';
    }
});

// Validation function
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

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Show error message for a field
function showError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    const inputElement = document.getElementById(fieldName);

    if (errorElement) {
        errorElement.textContent = message;
    }

    if (inputElement) {
        inputElement.style.borderColor = '#e74c3c';
    }
}

// Clear all error messages
function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });

    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = '#e0e0e0';
    });
}

// Show success/error message
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideMessage();
    }, 5000);
}

// Hide message
function hideMessage() {
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
}

// Real-time validation feedback
document.getElementById('email').addEventListener('blur', function () {
    if (this.value && !isValidEmail(this.value)) {
        showError('email', 'Please enter a valid email address');
    }
});

document.getElementById('password').addEventListener('input', function () {
    const errorElement = document.getElementById('password-error');
    if (this.value.length > 0 && this.value.length < 6) {
        errorElement.textContent = `${6 - this.value.length} more characters needed`;
    } else {
        errorElement.textContent = '';
    }

    // Check confirm password match when password changes
    const confirmPassword = document.getElementById('confirm_password');
    if (confirmPassword.value && confirmPassword.value !== this.value) {
        showError('confirm_password', 'Passwords do not match');
    } else if (confirmPassword.value === this.value && this.value.length >= 6) {
        const confirmErrorElement = document.getElementById('confirm_password-error');
        confirmErrorElement.textContent = '✓ Passwords match';
        confirmErrorElement.style.color = '#4caf50';
        confirmPassword.style.borderColor = '#4caf50';
    }
});

// Real-time validation for confirm password
document.getElementById('confirm_password').addEventListener('input', function () {
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('confirm_password-error');

    if (this.value && this.value !== password) {
        showError('confirm_password', 'Passwords do not match');
    } else if (this.value === password && this.value.length >= 6) {
        errorElement.textContent = '✓ Passwords match';
        errorElement.style.color = '#4caf50';
        this.style.borderColor = '#4caf50';
    } else {
        errorElement.textContent = '';
        errorElement.style.color = '#e74c3c';
        this.style.borderColor = '#e0e0e0';
    }
});
