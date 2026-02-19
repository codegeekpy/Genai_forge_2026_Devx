import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService, optionsService } from '../../services/api';
import './Auth.css';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [jobRoles, setJobRoles] = useState([]);

    // Form states
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        selectedRoles: []
    });

    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await optionsService.getJobRoles();
                setJobRoles(res.data.job_roles || []);
            } catch (err) {
                console.error('Failed to load roles', err);
            }
        };
        if (!isLogin) fetchRoles();
    }, [isLogin]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleToggle = (role) => {
        const newRoles = formData.selectedRoles.includes(role)
            ? formData.selectedRoles.filter(r => r !== role)
            : [...formData.selectedRoles, role];
        setFormData({ ...formData, selectedRoles: newRoles });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            if (isLogin) {
                const res = await authService.login(formData.email, formData.password);
                login(res.data.user, res.data.resumes || []);
                setMessage({ text: 'Login successful!', type: 'success' });
                setTimeout(() => navigate('/dashboard'), 1000);
            } else {
                // Validation
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (formData.selectedRoles.length === 0) {
                    throw new Error('Please select at least one job role');
                }

                const res = await authService.signup(
                    formData.username,
                    formData.email,
                    formData.password,
                    formData.selectedRoles
                );
                login(res.data.user, []);
                setMessage({ text: 'Account created!', type: 'success' });
                setTimeout(() => navigate('/resume'), 1000);
            }
        } catch (err) {
            setMessage({
                text: err.response?.data?.detail || err.message || 'An error occurred',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        Sign In
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        Create Account
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="auth-form-heading">
                        <h2>{isLogin ? 'Welcome Back' : 'Join TalentForge'}</h2>
                        <p>{isLogin ? 'Sign in to access your dashboard' : 'Start your AI-powered career journey'}</p>
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                name="username"
                                placeholder="John Doe"
                                required
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="name@example.com"
                            required
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            required
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label>Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="••••••••"
                                    required
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>Preferred Job Roles <span style={{ color: 'red' }}>*</span></label>
                                <p className="field-sub">Select roles you are interested in</p>
                                <div className="job-roles-grid">
                                    {jobRoles.map((role, idx) => (
                                        <div
                                            key={idx}
                                            className={`checkbox-item ${formData.selectedRoles.includes(role) ? 'checked' : ''}`}
                                            onClick={() => handleRoleToggle(role)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedRoles.includes(role)}
                                                onChange={() => { }} // Handled by div click
                                            />
                                            <label>{role}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="auth-submit btn-primary btn"
                        disabled={loading}
                    >
                        {loading ? (isLogin ? 'Signing in...' : 'Creating...') : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>

                    {message.text && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Auth;
