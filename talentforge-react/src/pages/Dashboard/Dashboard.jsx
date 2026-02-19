import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/api';
import apiClient from '../../services/api';
import './Dashboard.css';

const CATEGORY_ICONS = {
    'Data & AI': '🤖', 'Development': '💻', 'Cloud & DevOps': '☁️',
    'Security': '🔒', 'Design': '🎨', 'Management': '📋',
    'Testing & QA': '🧪', 'Networking': '🌐', 'Database': '🗄️',
    'Analytics': '📊', 'default': '⚡'
};

const getCategoryIcon = (cat) => {
    for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
        if (cat && cat.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return CATEGORY_ICONS['default'];
};

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Get profile data (resumes + cached recommendations)
                const res = await profileService.get(user.id);
                let profileData = res.data;

                // 2. If recommendations are missing but resume exists, trigger them
                if ((!profileData.matched_roles || profileData.matched_roles.length === 0) &&
                    profileData.resumes && profileData.resumes.length > 0) {

                    const latestResumeId = profileData.resumes[0].id;
                    try {
                        const recRes = await apiClient.post(`/api/recommend-roles/${latestResumeId}?top_k=5`);
                        profileData.matched_roles = recRes.data.recommendations;
                    } catch (recErr) {
                        console.error('Failed to auto-trigger recommendations', recErr);
                    }
                }

                setProfile(profileData);
            } catch (err) {
                setError('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [user.id]);

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="spinner"></div>
                <p>Analyzing your profile and matching roles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-error">
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="btn-primary btn">Retry</button>
            </div>
        );
    }

    const hasResume = profile?.resumes && profile.resumes.length > 0;
    const topRoles = profile?.matched_roles || [];
    const readinessScore = hasResume ? Math.max(...topRoles.map(r => r.match_score || 0), 0) : 0;
    const dashOffset = 377 - (377 * Math.round(readinessScore)) / 100;

    return (
        <main className="dash-page">
            <div className="dash-container">
                <div className="dash-welcome">
                    <h1>Welcome, {user.username}</h1>
                    <p>{hasResume ? 'Your career recommendations are ready.' : 'Complete your profile to see matched roles.'}</p>
                </div>

                {!hasResume ? (
                    <div className="no-resume-card">
                        <h3>No Resume Found</h3>
                        <p>Upload your resume or build a professional one from scratch to get AI recommendations.</p>
                        <div className="no-resume-actions">
                            <Link to="/resume" className="btn-primary btn">Upload Resume</Link>
                            <Link to="/resume-builder" className="btn-secondary btn" style={{ background: '#0d2137', color: 'white', border: 'none' }}>Build Resume</Link>
                        </div>
                    </div>
                ) : (
                    <div className="dash-content">
                        {/* Matched Roles */}
                        <div className="roles-section">
                            <h2 className="section-heading">
                                <span className="heading-icon">🎯</span> Your Top Matched Roles
                            </h2>
                            <div className="roles-grid">
                                {topRoles.map((role, idx) => (
                                    <Link key={idx} to={`/course?role=${encodeURIComponent(role.role_name)}`} className="role-card">
                                        <div className="role-top">
                                            <div className="role-icon">{getCategoryIcon(role.category)}</div>
                                            <div className="role-score">{Math.round(role.match_score)}%</div>
                                        </div>
                                        <h3 className="role-name">{role.role_name}</h3>
                                        <p className="role-category">{role.category}</p>
                                        <div className="role-action">View Learning Path →</div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Bottom Row */}
                        <div className="bottom-row">
                            {/* Score Section */}
                            <div className="score-section">
                                <h3><span style={{ marginRight: '8px' }}>📈</span> Resume Ready Score</h3>
                                <div className="score-circle-wrap">
                                    <svg viewBox="0 0 140 140">
                                        <circle className="score-circle-bg" cx="70" cy="70" r="60" />
                                        <circle
                                            className="score-circle-fill"
                                            cx="70" cy="70" r="60"
                                            strokeDasharray="377"
                                            strokeDashoffset={dashOffset}
                                        />
                                    </svg>
                                    <div className="score-value">{Math.round(readinessScore)}<span>%</span></div>
                                </div>
                                <p className="score-label">
                                    {readinessScore >= 80 ? 'Exceptional Readiness' :
                                        readinessScore >= 60 ? 'Good Potential' :
                                            'Room for Growth'}
                                </p>
                            </div>

                            {/* AI Section Placeholder */}
                            <div className="ask-ai-section">
                                <span className="ai-icon">🧠</span>
                                <h3>Ask AI <span className="coming-soon-badge">Coming Soon</span></h3>
                                <p>Your personal AI career assistant — powered by advanced language models.</p>
                                <ul className="ai-features">
                                    <li>Mock interview preparation</li>
                                    <li>Company-specific drive guidance</li>
                                    <li>Resume improvement suggestions</li>
                                </ul>
                                <button className="btn btn-disabled" disabled>Launch AI Assistant</button>
                            </div>

                            {/* Builder CTA */}
                            <div className="builder-cta-section">
                                <div className="builder-cta-info">
                                    <div className="builder-cta-icon">🖋️</div>
                                    <div>
                                        <h3>Resum&eacute; Builder</h3>
                                        <p>Turn your skills into a professional, ATS-optimized PDF or DOCX resume.</p>
                                    </div>
                                </div>
                                <Link
                                    to={`/resume-builder${hasResume ? `?resume_id=${profile.resumes[0].id}` : ''}`}
                                    className="btn-primary btn"
                                >
                                    Start Building &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Dashboard;
