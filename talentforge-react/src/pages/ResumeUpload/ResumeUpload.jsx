import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resumeService } from '../../services/api';
import { Upload, FileText, X, CheckCircle, ArrowLeft } from 'lucide-react';
import './ResumeUpload.css';

const ResumeUpload = () => {
    const { user, login } = useAuth();
    const [view, setView] = useState('choice'); // choice, upload, success
    const [file, setFile] = useState(null);
    const [userName, setUserName] = useState(user?.username || '');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [extractedInfo, setExtractedInfo] = useState(null);

    const navigate = useNavigate();

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            if (selected.size > 10 * 1024 * 1024) {
                setMessage({ text: 'File size exceeds 10MB', type: 'error' });
                return;
            }
            setFile(selected);
            setMessage({ text: '', type: '' });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const dropped = e.dataTransfer.files[0];
        if (dropped && (dropped.name.endsWith('.pdf') || dropped.name.endsWith('.docx'))) {
            if (dropped.size > 10 * 1024 * 1024) {
                setMessage({ text: 'File size exceeds 10MB', type: 'error' });
                return;
            }
            setFile(dropped);
            setMessage({ text: '', type: '' });
        } else {
            setMessage({ text: 'Invalid file format. Please use PDF or DOCX.', type: 'error' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage({ text: 'Please select a file', type: 'error' });
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('resume', file);
        formData.append('user_name', userName);
        formData.append('user_id', user.id);

        try {
            const res = await resumeService.upload(formData);
            setExtractedInfo(res.data);
            setView('success');
            // Update local storage/context if needed
        } catch (err) {
            setMessage({ text: err.response?.data?.detail || 'Failed to upload resume', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="page-body">
            <div className="container">
                <div className="page-title-bar">
                    <h1>Resume Submission</h1>
                    <p>Final step to complete your application</p>
                </div>

                <div className="content-card">
                    <div className="card-header">
                        <h2>{view === 'success' ? 'Ready to Go!' : 'Upload Your Resume'}</h2>
                        <span className="card-badge">
                            {view === 'choice' ? 'Get Started' : view === 'upload' ? 'Step 2 of 2' : 'Complete'}
                        </span>
                    </div>

                    <div className="card-body-inner">
                        {view === 'choice' && (
                            <div className="choice-screen">
                                <h3 className="choice-title">Do you have your resume ready?</h3>
                                <p className="choice-subtitle">Choose one of the options below to proceed</p>

                                <div className="options-row">
                                    <button className="option-card" onClick={() => setView('upload')}>
                                        <div className="option-icon">&#128206;</div>
                                        <h4>I Have My Resume</h4>
                                        <p>Upload your existing resume (PDF or DOCX)</p>
                                    </button>
                                    <button className="option-card" onClick={() => navigate('/resume-builder')}>
                                        <div className="option-icon">&#9997;</div>
                                        <h4>Let's Create One</h4>
                                        <p>Build your resume with our guided tool</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {view === 'upload' && (
                            <div className="upload-screen">
                                <button className="back-link btn" onClick={() => setView('choice')}>
                                    <ArrowLeft size={16} /> Back to options
                                </button>

                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label>Your Full Name <span className="required">*</span></label>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            placeholder="Enter your full name"
                                            required
                                            minLength={2}
                                        />
                                    </div>

                                    {!file ? (
                                        <div
                                            className="file-upload-area"
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <Upload size={40} className="upload-icon" />
                                            <p className="upload-text-main">Drag & drop your resume here</p>
                                            <p className="upload-or">or</p>
                                            <label className="btn btn-secondary browse-btn-label">
                                                Browse Files
                                                <input
                                                    type="file"
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.docx"
                                                    hidden
                                                />
                                            </label>
                                            <p className="upload-formats">Accepted formats: PDF, DOCX (Max 10MB)</p>
                                        </div>
                                    ) : (
                                        <div className="file-preview">
                                            <div className="file-details-row">
                                                <FileText size={40} className="file-icon-box" />
                                                <div className="file-info-text">
                                                    <p className="file-name-display">{file.name}</p>
                                                    <p className="file-size-display">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button type="button" className="remove-file-btn" onClick={() => setFile(null)}>
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-actions">
                                        <button type="submit" className="btn btn-primary" disabled={loading || !file}>
                                            {loading ? 'Processing...' : 'Upload & Analyze Resume'}
                                        </button>
                                    </div>

                                    {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
                                </form>
                            </div>
                        )}

                        {view === 'success' && (
                            <div className="success-screen">
                                <CheckCircle size={60} color="#1a7a3a" className="success-check" />
                                <h3>Resume Uploaded Successfully!</h3>
                                <p className="success-subtitle">Our AI is now busy matching you with the best career paths.</p>

                                {extractedInfo && (
                                    <div className="success-details-box">
                                        <p><strong>Candidate:</strong> {extractedInfo.name}</p>
                                        <p><strong>Experience:</strong> {extractedInfo.experience_level || 'Detected'}</p>
                                        <p><strong>Top Skills:</strong> {extractedInfo.top_skills?.join(', ') || 'Extracted'}</p>
                                    </div>
                                )}

                                <div className="success-actions">
                                    <Link to="/dashboard" className="btn btn-gold">View Dashboard &rarr;</Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ResumeUpload;
