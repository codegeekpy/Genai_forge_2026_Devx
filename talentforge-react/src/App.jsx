import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';

// Page imports
import Landing from './pages/Landing/Landing';
import Auth from './pages/Auth/Auth';
import Dashboard from './pages/Dashboard/Dashboard';
import Profile from './pages/Profile/Profile';
import ResumeUpload from './pages/ResumeUpload/ResumeUpload';
import ResumeBuilder from './pages/ResumeBuilder/ResumeBuilder';
import Course from './pages/Course/Course';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume"
              element={
                <ProtectedRoute>
                  <ResumeUpload />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume-builder"
              element={
                <ProtectedRoute>
                  <ResumeBuilder />
                </ProtectedRoute>
              }
            />

            <Route
              path="/course"
              element={
                <ProtectedRoute>
                  <Course />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
