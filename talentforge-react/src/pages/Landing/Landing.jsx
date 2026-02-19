import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    return (
        <div className="landing-page">
            {/* Hero Banner */}
            <section className="hero-banner">
                <div className="hero-inner">
                    <div className="hero-badge">AI-Powered Career Intelligence</div>
                    <h1>Discover the Career Roles Built for Your Skills</h1>
                    <p className="hero-sub">
                        Upload your resume. Our AI analyzes your skills, matches you to the best roles,
                        and builds a personalized learning path to get you there.
                    </p>
                    <div className="hero-actions">
                        <Link to="/auth" className="hero-cta">Get Started — It's Free</Link>
                        <a href="#features" className="hero-cta-secondary">See Features ↓</a>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section" id="features">
                <h2 className="section-title">Everything You Need to Accelerate Your Career</h2>
                <p className="section-subtitle">From resume analysis to learning paths — TalentForge handles it all with cutting-edge AI.</p>

                <div className="features-list">
                    <div className="feature-item">
                        <h3>AI Resume Analysis</h3>
                        <p>Advanced OCR extracts text from any PDF or DOCX, then our AI identifies your skills, experience, and education automatically.</p>
                    </div>

                    <div className="feature-item">
                        <h3>Smart Role Matching</h3>
                        <p>Our RAG engine compares your skills against 50+ career roles using vector similarity, giving you a ranked list of your best-fit positions.</p>
                    </div>

                    <div className="feature-item">
                        <h3>Personalized Learning Paths</h3>
                        <p>Get a week-by-week upskilling plan with curated resources and guided projects.</p>
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="cta-section">
                <div className="hero-inner">
                    <h2>Ready to Find Your Perfect Career Path?</h2>
                    <p>Join TalentForge and let AI guide your next career move.</p>
                    <Link to="/auth" className="hero-cta">Create Free Account</Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="page-footer">
                <div className="footer-inner">
                    <span>© 2026 TalentForge — AI-Powered Career Intelligence</span>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
