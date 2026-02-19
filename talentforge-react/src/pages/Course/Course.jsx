import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService, courseService } from '../../services/api';
import { ChevronDown, ChevronUp, Loader, AlertCircle, HelpCircle, Rocket, BookOpen, ExternalLink } from 'lucide-react';
import './Course.css';

const Course = () => {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recommendations, setRecommendations] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedWeeks, setExpandedWeeks] = useState({});
    const [expandedDays, setExpandedDays] = useState({});
    const [weekDetails, setWeekDetails] = useState({});
    const [dayDetails, setDayDetails] = useState({});
    const [generatingRole, setGeneratingRole] = useState(null);

    const initialResumeId = searchParams.get('resume_id');
    const initialRole = searchParams.get('role');

    useEffect(() => {
        if (initialResumeId) {
            loadRecommendations(initialResumeId);
        } else {
            // Default to user's latest resume if available
            const savedResumes = JSON.parse(localStorage.getItem('tf_resumes') || '[]');
            if (savedResumes.length > 0) {
                loadRecommendations(savedResumes[0].id);
            }
        }
    }, [initialResumeId]);

    const loadRecommendations = async (resumeId) => {
        setLoading(true);
        setError('');
        try {
            const res = await courseService.getRecommendations(resumeId);
            setRecommendations(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load recommendations');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCourse = async (roleName, resumeId) => {
        setGeneratingRole(roleName);
        try {
            const res = await courseService.generateCourse(resumeId, roleName);
            setSelectedCourse({ ...res.data, targetRole: roleName, resumeId });
            setIsModalOpen(true);
            document.body.style.overflow = 'hidden';
        } catch (err) {
            alert('Failed to generate learning path: ' + (err.response?.data?.detail || err.message));
        } finally {
            setGeneratingRole(null);
        }
    };

    const closeCourse = () => {
        setIsModalOpen(false);
        setSelectedCourse(null);
        setExpandedWeeks({});
        setExpandedDays({});
        setWeekDetails({});
        setDayDetails({});
        document.body.style.overflow = '';
    };

    const toggleWeek = async (weekIndex, weekTitle, concepts, targetRole, resumeId) => {
        const key = `week-${weekIndex}`;
        const isExpanded = !!expandedWeeks[key];

        setExpandedWeeks(prev => ({ ...prev, [key]: !isExpanded }));

        if (!isExpanded && !weekDetails[key]) {
            setWeekDetails(prev => ({ ...prev, [key]: { loading: true } }));
            try {
                const res = await courseService.generateWeek({
                    target_role: targetRole,
                    week_number: weekIndex + 1,
                    week_title: weekTitle,
                    concepts: concepts
                });
                setWeekDetails(prev => ({ ...prev, [key]: { loading: false, days: res.data.days } }));
            } catch (err) {
                setWeekDetails(prev => ({ ...prev, [key]: { loading: false, error: 'Failed to load week details' } }));
            }
        }
    };

    const toggleDay = async (weekIndex, dayIndex, dayTitle, dayNumber, taskType, duration, targetRole) => {
        const key = `day-${weekIndex}-${dayIndex}`;
        const isExpanded = !!expandedDays[key];

        setExpandedDays(prev => ({ ...prev, [key]: !isExpanded }));

        if (!isExpanded && !dayDetails[key]) {
            setDayDetails(prev => ({ ...prev, [key]: { loading: true } }));
            try {
                const res = await courseService.generateDay({
                    target_role: targetRole,
                    day_title: dayTitle,
                    day_number: dayNumber,
                    task_type: taskType,
                    duration_minutes: duration
                });
                setDayDetails(prev => ({ ...prev, [key]: { loading: false, data: res.data } }));
            } catch (err) {
                setDayDetails(prev => ({ ...prev, [key]: { loading: false, error: 'Failed to load day details' } }));
            }
        }
    };

    if (loading) {
        return (
            <div className="course-loading-page">
                <Loader className="spinner" />
                <p>Analyzing your skill profile and matching roles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="course-error-page">
                <AlertCircle size={48} color="#a8201a" />
                <h3>Something Went Wrong</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary">Try Again</button>
            </div>
        );
    }

    if (!recommendations) {
        return (
            <div className="course-empty-page">
                <HelpCircle size={64} color="#0288d1" />
                <h3>No Data Found</h3>
                <p>Please upload a resume first to see career recommendations.</p>
                <Link to="/resume" className="btn btn-primary">Upload Resume</Link>
            </div>
        );
    }

    return (
        <main className="course-page">
            <div className="container-wide">
                <div className="page-title-bar">
                    <h1 className="course-title">Career Recommendations</h1>
                    <p className="course-subtitle">Your personalized role matches and upskilling pathways</p>
                </div>

                {/* Skills Summary */}
                <section className="content-card skills-summary">
                    <div className="card-header">
                        <h2>Your Skills Profile</h2>
                    </div>
                    <div className="card-body-padded">
                        <div className="skill-tag-list">
                            {(recommendations.candidate_skills || []).map((s, i) => (
                                <span key={i} className="skill-tag has">{s}</span>
                            ))}
                        </div>
                        <div className="builder-cta-inline">
                            <p>Want to showcase these skills on a professional resume?</p>
                            <Link to={`/resume-builder?resume_id=${searchParams.get('resume_id') || ''}`} className="btn-builder-link">
                                🚀 Open Resume Builder
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Role Cards */}
                <section className="roles-list-section">
                    <div className="section-heading">
                        <h2>Top Matching Roles</h2>
                        <p>Click "Generate Learning Path" on any role to get a personalized upskilling course</p>
                    </div>

                    <div className="role-list">
                        {(recommendations.recommendations || []).map((role, i) => {
                            const matchScore = Math.round(role.match_score || 0);
                            const scoreClass = matchScore >= 70 ? 'high' : matchScore >= 40 ? 'mid' : 'low';

                            return (
                                <div key={i} className="role-recommendation-card">
                                    <div className="role-card-top">
                                        <div className="role-rank-strip">
                                            <span>#{i + 1}</span>
                                            <span className="role-rank-label">Rank</span>
                                        </div>
                                        <div className="role-info-area">
                                            <div className="role-name-main">{role.role_name}</div>
                                            <div className="role-category-text">{role.category}</div>
                                        </div>
                                        <div className="role-match-badge">
                                            <div className={`match-pct ${scoreClass}`}>{matchScore}%</div>
                                            <div className="match-pct-label">Match</div>
                                        </div>
                                    </div>

                                    <div className="role-skills-area">
                                        <div className="role-skills-row">
                                            <div className="skills-label match-lbl">Matching Skills ({role.matching_skills?.length || 0})</div>
                                            <div className="skill-tag-list">
                                                {(role.matching_skills || []).map((s, idx) => (
                                                    <span key={idx} className="skill-tag has">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="role-skills-row">
                                            <div className="skills-label missing-lbl">Skills to Learn ({role.missing_skills?.length || 0})</div>
                                            <div className="skill-tag-list">
                                                {(role.missing_skills || []).map((s, idx) => (
                                                    <span key={idx} className="skill-tag missing">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="role-card-bottom">
                                        <div className="salary-text">
                                            {role.salary_range?.min && (
                                                <span><strong>{role.salary_range.min} – {role.salary_range.max} LPA</strong></span>
                                            )}
                                        </div>
                                        <button
                                            className={`gen-course-btn ${generatingRole === role.role_name ? 'loading' : ''}`}
                                            onClick={() => handleGenerateCourse(role.role_name, searchParams.get('resume_id') || recommendations.resume_id)}
                                            disabled={generatingRole}
                                        >
                                            {generatingRole === role.role_name ? (
                                                <>
                                                    <Loader className="spinner-sm" size={14} />
                                                    <span>Generating...</span>
                                                </>
                                            ) : (
                                                <span>Generate Learning Path</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Course Modal */}
            {isModalOpen && selectedCourse && (
                <div className="course-overlay shadow-overlay">
                    <div className="course-dialog">
                        <div className="course-dialog-header">
                            <div className="header-titles">
                                <h2>{selectedCourse.course.title || `Learning Path: ${selectedCourse.targetRole}`}</h2>
                                <Link to={`/resume-builder?role=${encodeURIComponent(selectedCourse.targetRole)}&resume_id=${selectedCourse.resumeId}`} className="btn-builder-modal">
                                    🖋️ Build Resum&eacute; for this Role
                                </Link>
                            </div>
                            <button className="close-dialog" onClick={closeCourse}>&times;</button>
                        </div>

                        <div className="course-dialog-body">
                            <p className="course-desc">{selectedCourse.course.description}</p>

                            <div className="course-meta-row">
                                <span className="meta-pill">Target: {selectedCourse.targetRole}</span>
                                <span className="meta-pill">{selectedCourse.course.estimated_weeks || selectedCourse.course.weeks?.length || 0} Weeks</span>
                                {selectedCourse.current_skills?.length > 0 && (
                                    <span className="meta-pill">{selectedCourse.current_skills.length} Current Skills</span>
                                )}
                                {selectedCourse.missing_skills?.length > 0 && (
                                    <span className="meta-pill">{selectedCourse.missing_skills.length} Skills to Learn</span>
                                )}
                            </div>

                            {selectedCourse.course.prerequisites?.length > 0 && (
                                <div className="prereq-section">
                                    <h4>Prerequisites</h4>
                                    <div className="skill-tag-list">
                                        {selectedCourse.course.prerequisites.map((p, i) => (
                                            <span key={i} className="concept-chip">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="weeks-list">
                                {(selectedCourse.course.weeks || []).map((week, wIdx) => {
                                    const weekKey = `week-${wIdx}`;
                                    const isExpanded = !!expandedWeeks[weekKey];
                                    const details = weekDetails[weekKey];
                                    const focusClass = `tag-${(week.focus || 'theory').toLowerCase()}`;

                                    return (
                                        <div key={wIdx} className={`week-row ${isExpanded ? 'expanded' : ''}`}>
                                            <div
                                                className="week-row-header"
                                                onClick={() => toggleWeek(wIdx, week.title, week.concepts, selectedCourse.targetRole, selectedCourse.resumeId)}
                                            >
                                                <div className="week-num">{week.week || wIdx + 1}</div>
                                                <div className="week-row-title">{week.title}</div>
                                                <span className={`week-focus-tag ${focusClass}`}>{week.focus || 'theory'}</span>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>

                                            {week.concepts?.length > 0 && (
                                                <div className="week-concepts-row">
                                                    {week.concepts.map((c, i) => <span key={i} className="concept-chip">{c}</span>)}
                                                </div>
                                            )}

                                            {isExpanded && (
                                                <div className="week-details-area">
                                                    {details?.loading ? (
                                                        <div className="week-loading"><Loader className="spinner-sm" size={24} /><p>Loading daily breakdown...</p></div>
                                                    ) : details?.error ? (
                                                        <div className="week-loading error-text">{details.error}</div>
                                                    ) : (
                                                        <div className="days-list">
                                                            {(details?.days || []).map((day, dIdx) => {
                                                                const dayKey = `day-${wIdx}-${dIdx}`;
                                                                const dayExpanded = !!expandedDays[dayKey];
                                                                const dData = dayDetails[dayKey];
                                                                const typeClass = `tag-${(day.task_type || 'theory').toLowerCase()}`;

                                                                return (
                                                                    <div key={dIdx} className={`day-row ${dayExpanded ? 'expanded' : ''}`}>
                                                                        <div
                                                                            className="day-row-header"
                                                                            onClick={() => toggleDay(wIdx, dIdx, day.title, day.day, day.task_type, day.duration_minutes, selectedCourse.targetRole)}
                                                                        >
                                                                            <span className="day-title-text">Day {day.day || dIdx + 1}: {day.title}</span>
                                                                            <div className="day-tags">
                                                                                <span className={`day-type-tag ${typeClass}`}>{day.task_type || 'theory'}</span>
                                                                                <span className="day-dur">{day.duration_minutes} min</span>
                                                                            </div>
                                                                        </div>

                                                                        {dayExpanded && (
                                                                            <div className="day-detail-area">
                                                                                {dData?.loading ? (
                                                                                    <div className="week-loading"><Loader className="spinner-sm" size={20} /><p>Loading content...</p></div>
                                                                                ) : dData?.error ? (
                                                                                    <div className="week-loading error-text">{dData.error}</div>
                                                                                ) : (
                                                                                    <div className="day-content-inner">
                                                                                        <p className="day-desc">{dData.data.description}</p>
                                                                                        {dData.data.table_of_contents?.length > 0 && (
                                                                                            <div className="day-toc-section">
                                                                                                <h5>Topics Covered</h5>
                                                                                                <ul>{dData.data.table_of_contents.map((t, i) => <li key={i}>{t}</li>)}</ul>
                                                                                            </div>
                                                                                        )}
                                                                                        {dData.data.resources?.length > 0 && (
                                                                                            <div className="resources-section">
                                                                                                <h5>Resources</h5>
                                                                                                {dData.data.resources.map((r, i) => (
                                                                                                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="resource-row">
                                                                                                        {r.thumbnail && <img src={r.thumbnail} alt="" className="resource-thumb-img" />}
                                                                                                        <div className="resource-info-box">
                                                                                                            <div className="resource-title-text">{r.title}</div>
                                                                                                            <div className={`resource-src ${r.source === 'youtube' ? 'yt' : 'web'}`}>
                                                                                                                {r.source === 'youtube' ? 'YouTube' : 'Web Resource'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <ExternalLink size={14} className="ext-link-icon" />
                                                                                                    </a>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Course;
