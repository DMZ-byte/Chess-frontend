// src/App.js (Example with basic routing and user state)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from '../src/components/auth/Login'; // Your new Login component
import CreateGameForm from '../src/components/CreateGame/CreateGame'; // Your CreateGameForm
import GamePage from '../src/pages/GamePage'; // Your GamePage
import HomePage from '../src/pages/HomePage'; // Assuming you have a Home page
import { disconnectWebSocket } from '../src/api/api'; // Import disconnect for logout
import axios from 'axios';
import Signup from './components/auth/Signup';
// A simple context for user authentication state
export const AuthContext = React.createContext(null);

function App() {
    const [user, setUser] = useState(null); // Stores logged-in user's username

    // Function to call when login is successful
    const handleLoginSuccess = (loggedInUsername) => {
        setUser({ username: loggedInUsername });
    };

    // Function to handle logout
    const handleLogout = () => {
        axios.post('http://localhost:8080/logout', {}, { withCredentials: true })
            .then(() => {
                setUser(null);
                disconnectWebSocket(); // Disconnect WebSocket on logout
                alert("Logged out successfully!");
                // Optionally redirect to login page
                // navigate('/login');
            })
            .catch(err => {
                console.error("Logout error:", err);
                alert("Logout failed!");
            });
    };

    // Simple ProtectedRoute component
    const ProtectedRoute = ({ children }) => {
        if (!user) {
            return <Navigate to="/login" replace />;
        }
        return children;
    };

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            <Router>
                <nav style={{ padding: '10px', background: '#f0f0f0' }}>
                    <Link to="/">Home</Link> | 
                    {user ? (
                        <>
                            <span> Welcome, {user.username}! </span> | 
                            <Link to="/create-game">Create Game</Link> |
                            <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
                        </>
                    ) : (
                        <Link to="/login">Login</Link>
                    )}
                </nav>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/signup" element={<Signup />}/>
                    <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
                    <Route path="/create-game" element={<ProtectedRoute><CreateGameForm /></ProtectedRoute>} />
                    <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
                    <Route path="*" element={<div>404 Not Found</div>} />
                </Routes>
            </Router>
        </AuthContext.Provider>
    );
}

export default App;