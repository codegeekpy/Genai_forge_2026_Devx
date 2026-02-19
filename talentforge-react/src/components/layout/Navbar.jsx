import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = (e) => {
        e.preventDefault();
        logout();
        navigate('/auth');
    };

    return (
        <nav className="top-nav">
            <div className="nav-inner">
                <Link to="/" className="nav-brand">
                    <span className="brand-icon">◆</span>
                    <span className="brand-text">TalentForge</span>
                </Link>
                <div className="nav-links">
                    {user ? (
                        <>
                            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                                Dashboard
                            </NavLink>
                            <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
                                Profile
                            </NavLink>
                            <NavLink to="/resume" className={({ isActive }) => isActive ? 'active' : ''}>
                                Upload Resume
                            </NavLink>
                            <NavLink to="/resume-builder" className={({ isActive }) => isActive ? 'active' : ''}>
                                Build Resume
                            </NavLink>
                            <a href="#" onClick={handleLogout} className="logout-btn">
                                <LogOut size={16} style={{ marginBottom: '-3px', marginRight: '4px' }} />
                                Sign Out
                            </a>
                        </>
                    ) : (
                        <>
                            <a href="#features">Features</a>
                            <Link to="/auth">Sign In</Link>
                            <Link to="/auth" className="nav-cta-btn">Join Now</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
