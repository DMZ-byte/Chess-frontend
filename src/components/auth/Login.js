// src/components/Auth/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { connectWebSocket } from '../../api/api'; // Import your WebSocket connect function
import styles from './Login.module.css'; // Create this CSS module for styling

function Login({ onLoginSuccess }) { // onLoginSuccess will be a callback from App.js
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8080/login', 
                new URLSearchParams({ username, password }).toString(), // Spring Security's formLogin expects x-www-form-urlencoded
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true // Important for sending/receiving JSESSIONID cookie
                }
            );

            console.log('Login successful:', response.data);
            // Assuming your Spring backend returns the username on success
            const loggedInUsername = response.data.username || username; 
            
            // Call the callback to inform parent (App.js) about successful login
            if (onLoginSuccess) {
                onLoginSuccess(loggedInUsername);
            }

            // After successful login, establish WebSocket connection for the authenticated user
            // Use the username as the userId for WebSocket connection
            connectWebSocket(loggedInUsername, () => {
                console.log("WebSocket connected after login for user:", loggedInUsername);
                navigate('/'); // Redirect to games list or dashboard after login
            }, null, null, (wsError) => {
                console.error("WebSocket connection error after login:", wsError);
                setError("Login successful, but WebSocket connection failed: " + wsError);
            });

        } catch (err) {
            console.error('Login error:', err.response ? err.response.data : err.message);
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginContainer}>
            <h2>Login</h2>
            <form onSubmit={handleLogin} className={styles.loginForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit" disabled={loading} className={styles.loginButton}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

export default Login;