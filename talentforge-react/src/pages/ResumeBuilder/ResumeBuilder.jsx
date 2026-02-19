import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import { User, Briefcase, GraduationCap, Zap, Download, Sparkles, Wand2, Plus, X, ChevronDown, Check, Loader } from 'lucide-react';
import './ResumeBuilder.css';

const ResumeBuilder = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeId = searchParams.get('resume_id');
    const targetRole = searchParams.get('role');

    const [state, setState] = useState({
        personal: {
            fullName: user?.username || '',
            jobTitle: targetRole || '',
            email: user?.email || '',
            phone: '',
            linkedin: '',
            website: '',
            summary: ''
        },
        experience: [],
        education: [],
        skills: [],
        config: {
            layout: 'modern',
            color: '#0e6b5e',
            font: 'sans'
        }
    });

    const [openSections, setOpenSections] = useState({
        personal: true,
        experience: false,
        education: false,
        skills: false
    });

    const [loadingAction, setLoadingAction] = useState(null); // 'magic', 'polish-summary', 'pdf', 'docx'
    const [skillInput, setSkillInput] = useState('');

    useEffect(() => {
        if (resumeId) {
            prefillFromResume(resumeId);
        }
    }, [resumeId]);

    const prefillFromResume = async (id) => {
        try {
            const res = await apiClient.get(`/api/resume-builder/prefill/${id}`);
            if (res.data?.data) {
                const d = res.data.data;
                setState(prev => {
                    const newPersonal = { ...prev.personal };
                    // Only overwrite with non-empty values from pre-fill
                    if (d.personal) {
                        Object.keys(d.personal).forEach(key => {
                            if (d.personal[key] && d.personal[key].trim() !== '') {
                                newPersonal[key] = d.personal[key];
                            }
                        });
                    }

                    return {
                        ...prev,
                        personal: newPersonal,
                        experience: d.experience && d.experience.length > 0 ? d.experience : prev.experience,
                        education: d.education && d.education.length > 0 ? d.education : prev.education,
                        skills: d.skills && d.skills.length > 0 ? d.skills : prev.skills
                    };
                });
                // Open relevant sections
                setOpenSections({
                    personal: true,
                    experience: (d.experience || []).length > 0,
                    education: (d.education || []).length > 0,
                    skills: (d.skills || []).length > 0
                });
            }
        } catch (err) {
            console.warn('Pre-fill failed', err);
        }
    };

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handlePersonalChange = (e) => {
        const { id, value } = e.target;
        setState(prev => ({
            ...prev,
            personal: { ...prev.personal, [id]: value }
        }));
    };

    const addExperience = () => {
        setState(prev => ({
            ...prev,
            experience: [...prev.experience, { title: '', company: '', date: '', description: '' }]
        }));
        setOpenSections(prev => ({ ...prev, experience: true }));
    };

    const updateExperience = (idx, field, value) => {
        const newExp = [...state.experience];
        newExp[idx][field] = value;
        setState(prev => ({ ...prev, experience: newExp }));
    };

    const removeExperience = (idx) => {
        setState(prev => ({
            ...prev,
            experience: prev.experience.filter((_, i) => i !== idx)
        }));
    };

    const addEducation = () => {
        setState(prev => ({
            ...prev,
            education: [...prev.education, { degree: '', school: '', date: '' }]
        }));
        setOpenSections(prev => ({ ...prev, education: true }));
    };

    const updateEducation = (idx, field, value) => {
        const newEdu = [...state.education];
        newEdu[idx][field] = value;
        setState(prev => ({ ...prev, education: newEdu }));
    };

    const removeEducation = (idx) => {
        setState(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== idx)
        }));
    };

    const addSkill = () => {
        const val = skillInput.trim();
        if (val && !state.skills.includes(val)) {
            setState(prev => ({ ...prev, skills: [...prev.skills, val] }));
            setSkillInput('');
        }
    };

    const removeSkill = (idx) => {
        setState(prev => ({
            ...prev,
            skills: prev.skills.filter((_, i) => i !== idx)
        }));
    };

    // AI Actions
    const handleMagicWrite = async () => {
        setLoadingAction('magic');
        try {
            const res = await apiClient.post('/api/resume-builder/ai-summary', buildPayload());
            setState(prev => ({
                ...prev,
                personal: { ...prev.personal, summary: res.data.summary }
            }));
        } catch (err) {
            alert('Magic Write failed');
        } finally {
            setLoadingAction(null);
        }
    };

    const handlePolishSummary = async () => {
        if (!state.personal.summary) return;
        setLoadingAction('polish-summary');
        try {
            const res = await apiClient.post('/api/resume-builder/ai-optimize', { text: state.personal.summary });
            setState(prev => ({
                ...prev,
                personal: { ...prev.personal, summary: res.data.optimized_text }
            }));
        } catch (err) {
            alert('Polish failed');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleOptimizeExp = async (idx) => {
        const text = state.experience[idx].description;
        if (!text) return;
        setLoadingAction(`polish-exp-${idx}`);
        try {
            const res = await apiClient.post('/api/resume-builder/ai-optimize', { text });
            updateExperience(idx, 'description', res.data.optimized_text);
        } catch (err) {
            alert('Polish failed');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDownload = async (type) => {
        setLoadingAction(type);
        try {
            const endpoint = type === 'pdf' ? '/api/resume-builder/generate-pdf' : '/api/resume-builder/generate-docx';
            const res = await apiClient.post(endpoint, buildPayload(), { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `resume.${type}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert(`${type.toUpperCase()} generation failed`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleSave = async () => {
        if (!user) {
            alert('Please log in to save your resume.');
            return;
        }
        setLoadingAction('save');
        try {
            const res = await apiClient.post('/api/resume-builder/save', {
                user_id: user.id,
                data: buildPayload()
            });
            alert('Resume saved to your profile! Redirecting to dashboard...');
            setTimeout(() => {
                navigate('/dashboard');
            }, 1000);
        } catch (err) {
            alert('Failed to save resume: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingAction(null);
        }
    };

    const buildPayload = () => ({
        personal: state.personal,
        experience: state.experience,
        education: state.education,
        skills: state.skills,
        template: state.config.layout,
        color: state.config.color,
        font: state.config.font
    });

    return (
        <main className="builder-page">
            <div className="builder-container">
                <header className="builder-header">
                    <div className="header-text">
                        <h1>📝 Resume Builder</h1>
                        <p>Create a professional, ATS-optimized resume — powered by AI.</p>
                    </div>
                    <div className="header-actions">
                        <button
                            className="btn-action btn-save-profile"
                            onClick={handleSave}
                            disabled={loadingAction === 'save'}
                            style={{ background: '#0e6b5e', color: 'white', border: 'none' }}
                        >
                            {loadingAction === 'save' ? <Loader /> : <Check size={16} />}
                            Save to Profile
                        </button>
                        <button
                            className="btn-action btn-ai-summary"
                            onClick={handleMagicWrite}
                            disabled={loadingAction === 'magic'}
                        >
                            {loadingAction === 'magic' ? <Loader /> : <Wand2 size={16} />}
                            Magic Write
                        </button>
                        <div className="action-divider"></div>
                        <button
                            className="btn-action btn-download-docx"
                            onClick={() => handleDownload('docx')}
                            disabled={loadingAction === 'docx'}
                        >
                            <Briefcase size={16} /> DOCX
                        </button>
                        <button
                            className="btn-action btn-download-pdf"
                            onClick={() => handleDownload('pdf')}
                            disabled={loadingAction === 'pdf'}
                        >
                            <Download size={16} /> PDF
                        </button>
                    </div>
                </header>

                {/* Template Bar */}
                <section className="template-bar">
                    <div className="template-layouts">
                        <span className="bar-label">Layout:</span>
                        {['modern', 'classic', 'minimalist', 'executive', 'creative'].map(l => (
                            <button
                                key={l}
                                className={`layout-btn ${state.config.layout === l ? 'active' : ''}`}
                                onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, layout: l } }))}
                            >
                                {l.charAt(0).toUpperCase() + l.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="template-options">
                        <span className="bar-label">Color:</span>
                        <div className="color-swatches">
                            {['#0e6b5e', '#0d2137', '#2563EB', '#7C3AED', '#DC2626', '#EA580C', '#059669', '#000000'].map(c => (
                                <button
                                    key={c}
                                    className={`swatch ${state.config.color === c ? 'active' : ''}`}
                                    style={{ background: c }}
                                    onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, color: c } }))}
                                />
                            ))}
                        </div>
                        <span className="bar-label">Font:</span>
                        <select
                            className="font-select"
                            value={state.config.font}
                            onChange={(e) => setState(prev => ({ ...prev, config: { ...prev.config, font: e.target.value } }))}
                        >
                            <option value="sans">Sans-Serif</option>
                            <option value="serif">Serif</option>
                            <option value="mono">Monospace</option>
                        </select>
                    </div>
                </section>

                <div className="builder-body">
                    {/* Editor Column */}
                    <div className="editor-column">
                        {/* Personal Details */}
                        <div className="accordion-section">
                            <button className={`accordion-header ${openSections.personal ? 'active' : ''}`} onClick={() => toggleSection('personal')}>
                                <span><User size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Personal Details</span>
                                <ChevronDown size={16} className="accordion-arrow" />
                            </button>
                            {openSections.personal && (
                                <div className="accordion-body open">
                                    <div className="form-grid">
                                        <div className="field">
                                            <label>Full Name</label>
                                            <input id="fullName" type="text" value={state.personal.fullName} onChange={handlePersonalChange} placeholder="John Doe" />
                                        </div>
                                        <div className="field">
                                            <label>Job Title</label>
                                            <input id="jobTitle" type="text" value={state.personal.jobTitle} onChange={handlePersonalChange} placeholder="Software Engineer" />
                                        </div>
                                        <div className="field">
                                            <label>Email</label>
                                            <input id="email" type="email" value={state.personal.email} onChange={handlePersonalChange} placeholder="john@example.com" />
                                        </div>
                                        <div className="field">
                                            <label>Phone</label>
                                            <input id="phone" type="text" value={state.personal.phone} onChange={handlePersonalChange} placeholder="+1 234 567 890" />
                                        </div>
                                        <div className="field">
                                            <label>LinkedIn</label>
                                            <input id="linkedin" type="text" value={state.personal.linkedin} onChange={handlePersonalChange} placeholder="linkedin.com/in/johndoe" />
                                        </div>
                                        <div className="field">
                                            <label>Website</label>
                                            <input id="website" type="text" value={state.personal.website} onChange={handlePersonalChange} placeholder="johndoe.com" />
                                        </div>
                                    </div>
                                    <div className="field full-width">
                                        <div className="field-header">
                                            <label>Profile Summary</label>
                                            <button
                                                className="ai-btn"
                                                onClick={handlePolishSummary}
                                                disabled={loadingAction === 'polish-summary'}
                                            >
                                                <Sparkles size={12} /> {loadingAction === 'polish-summary' ? '...' : 'Polish'}
                                            </button>
                                        </div>
                                        <textarea
                                            id="summary"
                                            value={state.personal.summary}
                                            onChange={handlePersonalChange}
                                            placeholder="Write a brief professional summary or use Magic Write..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Experience */}
                        <div className="accordion-section">
                            <button className={`accordion-header ${openSections.experience ? 'active' : ''}`} onClick={() => toggleSection('experience')}>
                                <span><Briefcase size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Experience</span>
                                <ChevronDown size={16} className="accordion-arrow" />
                            </button>
                            {openSections.experience && (
                                <div className="accordion-body open">
                                    {state.experience.map((exp, idx) => (
                                        <div key={idx} className="entry-card">
                                            <button className="btn-remove-entry" onClick={() => removeExperience(idx)}><X size={16} /></button>
                                            <div className="form-grid">
                                                <div className="field">
                                                    <label>Job Title</label>
                                                    <input type="text" value={exp.title} onChange={(e) => updateExperience(idx, 'title', e.target.value)} placeholder="Software Engineer" />
                                                </div>
                                                <div className="field">
                                                    <label>Company</label>
                                                    <input type="text" value={exp.company} onChange={(e) => updateExperience(idx, 'company', e.target.value)} placeholder="Acme Inc." />
                                                </div>
                                                <div className="field">
                                                    <label>Date</label>
                                                    <input type="text" value={exp.date} onChange={(e) => updateExperience(idx, 'date', e.target.value)} placeholder="Jan 2023 — Present" />
                                                </div>
                                                <div className="field full-width">
                                                    <div className="field-header">
                                                        <label>Description</label>
                                                        <button className="ai-btn" onClick={() => handleOptimizeExp(idx)} disabled={loadingAction === `polish-exp-${idx}`}>
                                                            <Sparkles size={12} /> {loadingAction === `polish-exp-${idx}` ? '...' : 'Polish'}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={exp.description}
                                                        onChange={(e) => updateExperience(idx, 'description', e.target.value)}
                                                        placeholder="Key achievements and responsibilities..."
                                                        rows={3}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn-add" onClick={addExperience}><Plus size={16} /> Add Experience</button>
                                </div>
                            )}
                        </div>

                        {/* Education */}
                        <div className="accordion-section">
                            <button className={`accordion-header ${openSections.education ? 'active' : ''}`} onClick={() => toggleSection('education')}>
                                <span><GraduationCap size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Education</span>
                                <ChevronDown size={16} className="accordion-arrow" />
                            </button>
                            {openSections.education && (
                                <div className="accordion-body open">
                                    {state.education.map((edu, idx) => (
                                        <div key={idx} className="entry-card">
                                            <button className="btn-remove-entry" onClick={() => removeEducation(idx)}><X size={16} /></button>
                                            <div className="form-grid">
                                                <div className="field">
                                                    <label>Degree / Certificate</label>
                                                    <input type="text" value={edu.degree} onChange={(e) => updateEducation(idx, 'degree', e.target.value)} placeholder="B.S. Computer Science" />
                                                </div>
                                                <div className="field">
                                                    <label>School / Institution</label>
                                                    <input type="text" value={edu.school} onChange={(e) => updateEducation(idx, 'school', e.target.value)} placeholder="MIT" />
                                                </div>
                                                <div className="field">
                                                    <label>Year / Date</label>
                                                    <input type="text" value={edu.date} onChange={(e) => updateEducation(idx, 'date', e.target.value)} placeholder="2020 — 2024" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn-add" onClick={addEducation}><Plus size={16} /> Add Education</button>
                                </div>
                            )}
                        </div>

                        {/* Skills */}
                        <div className="accordion-section">
                            <button className={`accordion-header ${openSections.skills ? 'active' : ''}`} onClick={() => toggleSection('skills')}>
                                <span><Zap size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Skills</span>
                                <ChevronDown size={16} className="accordion-arrow" />
                            </button>
                            {openSections.skills && (
                                <div className="accordion-body open">
                                    <div className="skills-container">
                                        {state.skills.map((s, idx) => (
                                            <span key={idx} className="skill-tag">
                                                {s} <X size={12} className="remove-skill" onClick={() => removeSkill(idx)} />
                                            </span>
                                        ))}
                                    </div>
                                    <div className="skill-input-row">
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={(e) => setSkillInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                                            placeholder="Type a skill and press Enter"
                                        />
                                        <button className="btn-add-skill" onClick={addSkill}>Add</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview Column */}
                    <div className="preview-column">
                        <div className="preview-container">
                            <ResumePreview state={state} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

// Simplified Real-time Preview Component
const ResumePreview = ({ state }) => {
    const { layout, color, font } = state.config;
    const p = state.personal;

    const fontMap = {
        sans: "'Source Sans Pro', sans-serif",
        serif: "'Merriweather', serif",
        mono: "'Courier New', monospace"
    };

    const hasContent = p.fullName || p.jobTitle || p.summary || state.experience.length > 0 || state.education.length > 0 || state.skills.length > 0;

    if (!hasContent) {
        return <div className="rv-empty">Start typing to see your resume preview...</div>;
    }

    const contactParts = [p.email, p.phone, p.linkedin, p.website].filter(Boolean);
    const contactStr = contactParts.join(' | ');

    return (
        <div className={`resume-preview layout-${layout}`} style={{ fontFamily: fontMap[font] }}>
            {/* Header logic simplified for React */}
            <div className="rv-header" style={{ textAlign: layout === 'classic' ? 'center' : 'left' }}>
                <h1 className="rv-name" style={{ color: layout === 'creative' ? color : (layout === 'modern' ? color : '#1a2a3a') }}>
                    {layout === 'classic' ? p.fullName.toUpperCase() : p.fullName}
                </h1>
                <p className="rv-title" style={{ fontStyle: 'italic', color: layout === 'minimalist' ? color : '#555' }}>
                    {p.jobTitle}
                </p>
                <p className="rv-contact">{contactStr}</p>
                {(layout === 'modern' || layout === 'executive' || layout === 'classic') && <hr className="rv-divider" style={{ background: color }} />}
            </div>

            {p.summary && (
                <div className="rv-section">
                    <div className="rv-section-title" style={{ color }}>SUMMARY</div>
                    <p className="rv-summary">{p.summary}</p>
                </div>
            )}

            {state.experience.length > 0 && (
                <div className="rv-section">
                    <div className="rv-section-title" style={{ color }}>EXPERIENCE</div>
                    {state.experience.map((exp, i) => (
                        <div key={i} className="rv-entry">
                            <div className="rv-entry-header">
                                <span className="rv-entry-title">{exp.title}</span>
                                <span className="rv-entry-date">{exp.date}</span>
                            </div>
                            <div className="rv-entry-subtitle">{exp.company}</div>
                            <p className="rv-entry-desc">{exp.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {state.education.length > 0 && (
                <div className="rv-section">
                    <div className="rv-section-title" style={{ color }}>EDUCATION</div>
                    {state.education.map((edu, i) => (
                        <div key={i} className="rv-entry">
                            <div className="rv-entry-header">
                                <span className="rv-entry-title">{edu.degree}</span>
                                <span className="rv-entry-date">{edu.date}</span>
                            </div>
                            <div className="rv-entry-subtitle">{edu.school}</div>
                        </div>
                    ))}
                </div>
            )}

            {state.skills.length > 0 && (
                <div className="rv-section">
                    <div className="rv-section-title" style={{ color }}>SKILLS</div>
                    <div className="rv-skills">
                        {state.skills.map((s, i) => (
                            <span key={i} className="rv-skill-tag" style={{ background: color + '15', color, border: `1px solid ${color}30` }}>
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Loader = () => <Sparkles size={16} className="spinner-inline" />;

export default ResumeBuilder;
