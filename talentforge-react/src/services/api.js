import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const authService = {
    login: (email, password) => apiClient.post('/api/auth/login', { email, password }),
    signup: (username, email, password, job_roles) =>
        apiClient.post('/api/auth/signup', { username, email, password, job_roles }),
};

export const resumeService = {
    upload: (formData) => apiClient.post('/api/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getAll: (userId) => apiClient.get(`/api/user/${userId}/resumes`),
    getExtracted: (resumeId) => apiClient.get(`/api/resume/${resumeId}/extracted-info`),
    delete: (resumeId, userId) => apiClient.delete(`/api/resume/${resumeId}?user_id=${userId}`),
};

export const profileService = {
    get: (userId) => apiClient.get(`/api/user/${userId}/profile`),
    update: (userId, data) => apiClient.put(`/api/user/${userId}/profile`, data),
};

export const optionsService = {
    getJobRoles: () => apiClient.get('/api/options'),
};

export const courseService = {
    getRecommendations: (resumeId) => apiClient.post(`/api/recommend-roles/${resumeId}?top_k=5`),
    generateCourse: (resumeId, roleName) => apiClient.post(`/api/generate-course/${resumeId}?target_role=${encodeURIComponent(roleName)}`),
    generateWeek: (data) => apiClient.post('/api/generate-course-week', data),
    generateDay: (data) => apiClient.post('/api/generate-course-day', data),
};

export default apiClient;
