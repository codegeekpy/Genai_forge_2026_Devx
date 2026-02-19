import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileService, resumeService } from '../../services/api';
import './Profile.css';

const Profile = () => {
    const { user, login } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ username: '', email: '' });
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [user.id]);

    const fetchProfile = async () => {
        try {
            const res = await profileService.get(user.id);
            setData(res.data);
            setEditForm({ username: res.data.user.username, email: res.data.user.email });
        } catch (err) {
            console.error('Failed to load profile', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await profileService.update(user.id, editForm);
            login(res.data.user, data.resumes); // Update local state
            setIsEditing(false);
            fetchProfile();
        } catch (err) {
            alert('Failed to update profile');
        }
    };

    const handleDeleteResume = async () => {
        try {
            await resumeService.delete(data.latest_resume_id, user.id);
            setIsDeleting(false);
            fetchProfile();
        } catch (err) {
            alert('Failed to delete resume');
        }
    };

    if (loading) return <div className="profile-loading"><div className="spinner"></div></div>;

    if (!data || !data.user) {
        return (
            <div className="profile-error">
                <p>Failed to load profile details.</p>
                <button onClick={fetchProfile} className="btn-primary btn">Retry</button>
            </div>
        );
    }

    const u = data.user;
    const initials = (u.username || 'U').substring(0, 2).toUpperCase();

    return (
        <main className="profile-page">
            <div className="profile-container">
                <div className="profile-header">
                    <div className="profile-avatar">{initials}</div>
                    <div className="profile-info">
                        <h1>{u.username}</h1>
                        <p className="profile-email">{u.email}</p>
                        {data.latest_resume_id && (
                            <span className="resume-id-badge">Resume #{data.latest_resume_id}</span>
                        )}
                    </div>
                    <div className="profile-actions">
                        <button className="btn-edit btn" onClick={() => setIsEditing(true)}>✎ Edit Profile</button>
                        {data.latest_resume_id && (
                            <button className="btn-delete-resume btn" onClick={() => setIsDeleting(true)}>🗑 Delete Resume</button>
                        )}
                    </div>
                </div>

                {/* Career Interests */}
                <div className="profile-section">
                    <h2><span className="sec-icon">🎯</span> Your Career Interests</h2>
                    <p className="sec-sub">Roles you selected during registration</p>
                    <div className="skills-list">
                        {(u.job_roles || []).map((role, idx) => (
                            <span key={idx} className="skill-tag interest-tag">{role}</span>
                        ))}
                        {(!u.job_roles || u.job_roles.length === 0) && <span className="no-data">No roles selected.</span>}
                    </div>
                </div>

                {/* Skills */}
                <div className="profile-section">
                    <h2><span className="sec-icon">✅</span> Current Skills</h2>
                    <div className="skills-list">
                        {data.skills.map((s, idx) => (
                            <span key={idx} className="skill-tag current">{s}</span>
                        ))}
                        {data.skills.length === 0 && <span className="no-data">Upload a resume to see your skills.</span>}
                    </div>
                </div>

                {/* Missing Skills */}
                <div className="profile-section">
                    <h2><span className="sec-icon">⚠️</span> Skills to Improve</h2>
                    <div className="skills-list">
                        {data.missing_skills.map((s, idx) => (
                            <span key={idx} className="skill-tag missing">{s}</span>
                        ))}
                        {data.missing_skills.length === 0 && <span className="no-data">No gaps detected yet.</span>}
                    </div>
                </div>

                {/* Modal for Edit */}
                {isEditing && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2>Edit Profile</h2>
                            <form onSubmit={handleUpdate}>
                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        value={editForm.username}
                                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="submit" className="btn-primary btn">Save Changes</button>
                                    <button type="button" className="btn-secondary btn" onClick={() => setIsEditing(false)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal for Delete */}
                {isDeleting && (
                    <div className="modal-overlay">
                        <div className="modal-content delete-modal">
                            <span className="warn-icon">⚠️</span>
                            <h3>Delete Your Resume?</h3>
                            <p>This will permanently remove your resume and all associated recommendations. This action cannot be undone.</p>
                            <div className="modal-actions">
                                <button className="btn-danger btn" onClick={handleDeleteResume}>Yes, Delete</button>
                                <button className="btn-secondary btn" onClick={() => setIsDeleting(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Profile;
