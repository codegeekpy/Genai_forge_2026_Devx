// API endpoint
const API_URL = 'http://localhost:8000';

// Get DOM elements
const choiceScreen = document.getElementById('choiceScreen');
const uploadScreen = document.getElementById('uploadScreen');
const successScreen = document.getElementById('successScreen');

const resumeReadyBtn = document.getElementById('resumeReadyBtn');
const createResumeBtn = document.getElementById('createResumeBtn');
const backBtn = document.getElementById('backBtn');

const uploadForm = document.getElementById('uploadForm');
const userNameInput = document.getElementById('userName');
const fileUploadArea = document.getElementById('fileUploadArea');
const resumeFileInput = document.getElementById('resumeFile');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');

let selectedFile = null;

// Event Listeners
resumeReadyBtn.addEventListener('click', showUploadScreen);
createResumeBtn.addEventListener('click', showCreateResumeMessage);
backBtn.addEventListener('click', showChoiceScreen);
resumeFileInput.addEventListener('change', handleFileSelect);
removeFileBtn.addEventListener('click', removeFile);
uploadForm.addEventListener('submit', handleFormSubmit);

// Drag and drop functionality
fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('dragover');
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Click to upload
fileUploadArea.addEventListener('click', () => {
    resumeFileInput.click();
});

// Functions
function showUploadScreen() {
    choiceScreen.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
}

function showChoiceScreen() {
    uploadScreen.classList.add('hidden');
    successScreen.classList.add('hidden');
    choiceScreen.classList.remove('hidden');
    resetForm();
}

function showCreateResumeMessage() {
    alert('Resume creation feature coming soon! For now, please use the "I Have My Resume" option.');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.docx'];

    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showMessage('Please upload a PDF or DOCX file only.', 'error');
        return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showMessage('File size exceeds 10MB limit.', 'error');
        return;
    }

    selectedFile = file;
    displayFilePreview(file);
    hideMessage();
}

function displayFilePreview(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    fileUploadArea.classList.add('hidden');
    filePreview.classList.remove('hidden');
}

function removeFile() {
    selectedFile = null;
    resumeFileInput.value = '';

    filePreview.classList.add('hidden');
    fileUploadArea.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = `message ${type}`;
}

function hideMessage() {
    messageDiv.className = 'message';
    messageDiv.textContent = '';
}

function resetForm() {
    uploadForm.reset();
    removeFile();
    hideMessage();
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Validate inputs
    const userName = userNameInput.value.trim();

    if (userName.length < 2) {
        showMessage('Please enter your full name (at least 2 characters).', 'error');
        return;
    }

    if (!selectedFile) {
        showMessage('Please select a resume file to upload.', 'error');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    // Create FormData
    const formData = new FormData();
    formData.append('user_name', userName);
    formData.append('resume', selectedFile);

    try {
        const response = await fetch(`${API_URL}/api/upload-resume`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Show success screen
            showSuccessScreen(data);
        } else {
            showMessage(data.detail || 'Upload failed. Please try again.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Resume';
        }
    } catch (error) {
        console.error('Error uploading resume:', error);
        showMessage('Network error. Please check if the server is running.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload Resume';
    }
}

function showSuccessScreen(data) {
    uploadScreen.classList.add('hidden');
    successScreen.classList.remove('hidden');

    const successDetails = document.getElementById('successDetails');
    successDetails.innerHTML = `
        <p><strong>Name:</strong> ${userNameInput.value}</p>
        <p><strong>File Name:</strong> ${data.file_name}</p>
        <p><strong>File Type:</strong> ${data.file_type.toUpperCase()}</p>
        <p><strong>Resume ID:</strong> ${data.resume_id}</p>
        <p><strong>Status:</strong> Successfully stored in database</p>
        <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;">
            <a href="course.html?resume_id=${data.resume_id}" class="action-btn-primary" style="text-decoration: none; text-align: center; padding: 14px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 10px; font-weight: 600;">
                🎯 View Career Recommendations & Tasks
            </a>
            <button onclick="window.location.reload()" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #a0a0c0; padding: 10px; border-radius: 8px; cursor: pointer;">
                Submit Another Resume
            </button>
        </div>
    `;
}
