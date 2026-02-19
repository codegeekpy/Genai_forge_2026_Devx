import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('tf_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [resumes, setResumes] = useState(() => {
        const saved = localStorage.getItem('tf_resumes');
        return saved ? JSON.parse(saved) : [];
    });

    const login = (userData, userResumes = []) => {
        setUser(userData);
        setResumes(userResumes);
        localStorage.setItem('tf_user', JSON.stringify(userData));
        localStorage.setItem('tf_resumes', JSON.stringify(userResumes));
    };

    const logout = () => {
        setUser(null);
        setResumes([]);
        localStorage.removeItem('tf_user');
        localStorage.removeItem('tf_resumes');
    };

    const updateResumes = (newResumes) => {
        setResumes(newResumes);
        localStorage.setItem('tf_resumes', JSON.stringify(newResumes));
    };

    return (
        <AuthContext.Provider value={{ user, resumes, login, logout, updateResumes }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
