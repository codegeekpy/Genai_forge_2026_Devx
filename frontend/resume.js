// API endpoint
const API_URL = 'http://localhost:8000';

// DOM Elements
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

// Drag and drop
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
    if (files.length > 0) handleFile(files[0]);
});

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
    alert(
        'Resume creation feature coming soon! For now, please use the "I Have My Resume" option.'
    );
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExtensions = ['.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        showMessage('Please upload a PDF or DOCX file only.', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
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
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

function hideMessage() {
    messageDiv.className = 'message';
    messageDiv.style.display = 'none';
    messageDiv.textContent = '';
}

function resetForm() {
    uploadForm.reset();
    removeFile();
    hideMessage();
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const userName = userNameInput.value.trim();

    if (userName.length < 2) {
        showMessage(
            'Please enter your full name (at least 2 characters).',
            'error'
        );
        return;
    }

    if (!selectedFile) {
        showMessage('Please select a resume file to upload.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('user_name', userName);
    formData.append('resume', selectedFile);

    try {
        const response = await fetch(`${API_URL}/api/upload-resume`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessScreen(data);
        } else {
            showMessage(
                data.detail || 'Upload failed. Please try again.',
                'error'
            );
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Resume';
        }
    } catch (error) {
        console.error('Error uploading resume:', error);
        showMessage(
            'Network error. Please check if the server is running.',
            'error'
        );
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload Resume';
    }
}

function showSuccessScreen(data) {
    uploadScreen.classList.add('hidden');
    successScreen.classList.remove('hidden');

    const successDetails = document.getElementById('successDetails');

    let extractionHtml = '';
    if (data.ai_extracted) {
        const preview = data.extracted_preview || {};
        extractionHtml = `
            <p><strong>AI Extraction:</strong> <span style="color:#1a7a3a;">&#10004; Complete</span></p>
            <p><strong>Skills Found:</strong> ${preview.skills_count || 0}</p>
            <p><strong>Experience Entries:</strong> ${preview.experience_count || 0}</p>
        `;
    } else if (data.ai_extraction_message) {
        extractionHtml = `
            <p><strong>AI Extraction:</strong> <span style="color:#b8860b;">Pending</span></p>
            <p style="font-size:0.82rem;color:#5a5a5a;">${data.ai_extraction_message}</p>
        `;
    }

    successDetails.innerHTML = `
        <p><strong>Name:</strong> ${userNameInput.value}</p>
        <p><strong>File Name:</strong> ${data.file_name}</p>
        <p><strong>File Type:</strong> ${data.file_type.toUpperCase()}</p>
        <p><strong>Resume ID:</strong> ${data.resume_id}</p>
        <p><strong>OCR:</strong> ${data.ocr_processed ? '<span style="color:#1a7a3a;">&#10004; Processed</span>' : '<span style="color:#a8201a;">Not available</span>'}</p>
        ${extractionHtml}
    `;

    // Auto-redirect to recommendations page after 3 seconds
    if (data.resume_id) {
        const redirectMsg = document.createElement('p');
        redirectMsg.style.cssText = 'margin-top:12px;color:#0e6b5e;font-weight:600;font-size:0.9rem;';
        redirectMsg.textContent = 'Redirecting to Career Recommendations in 3 seconds...';
        successDetails.appendChild(redirectMsg);

        setTimeout(() => {
            window.location.href = `course.html?resume_id=${data.resume_id}`;
        }, 3000);
    }
}
