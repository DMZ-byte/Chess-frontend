// src/App.js (Example with basic routing and user state)
import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from '../src/components/auth/Login'; // Your new Login component
import CreateGameForm from '../src/components/CreateGame/CreateGame'; // Your CreateGameForm
import GamePage from '../src/pages/GamePage'; // Your GamePage
import HomePage from '../src/pages/HomePage'; // Assuming you have a Home page
import AboutPage from './pages/AboutPage';
import { disconnectWebSocket, fetchUserId, fetchUser } from '../src/api/api'; // Import disconnect for logout
import axios from 'axios';
import Signup from './components/auth/Signup';
// A simple context for user authentication state
export const AuthContext = React.createContext(null);

function App() {
    const [user, setUser] = useState(null); // Stores logged-in user's username
    const [searchTerm, setSearchTerm] = useState('');
    const [userId, setUserId] = useState(null);
    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

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
        const { user } = useContext(AuthContext);
        console.log("protectedRoute: user = ", user);
        if (!user) {
            console.warn("No user defined. Might redirecting to /login");
        }
        return children;
    };
    useEffect(() => {
        const loadUserId = async () => {
            try { 
                const userId = await fetchUserId();
                console.log("Fetched userId: "+userId);
                const user = await fetchUser(userId);
                console.log("Fetched user:"+String(user));
                setUserId(userId);
                setUser(user);

            } catch(error){
                console.error("error when loading user or userid: "+error);
                setUser(false);
            }

        };
        loadUserId();
    }, []);
    

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            <Router>
<header className="bg-gray-800 shadow-lg py-4 px-6 md:px-10 rounded-b-lg">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-col md:flex-row items-center md:space-x-6 mb-4 md:mb-0">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 md:mb-0">
                        <span className="text-yellow-400">Chessable</span> Chess
                    </h1>
                    <nav className="flex space-x-4 md:space-x-6">
                        <Link to="/" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">Home</Link>
                        
                        <Link to="/how-to-play" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">How to Play</Link>
                        <Link to="/about" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">About</Link>
                        <Link to="/signup" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">Signup</Link>

                    </nav>
                </div>
                <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 w-full md:w-auto">
                    {user ? (
                        <>
                            <span className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700"> Welcome, {user.username}! </span> | 
                            <Link className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700" to="/create-game">Create Game</Link> |
                            <Link className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700" onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</Link>
                        </>
                    ) : (
                        <Link to="/login" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">Login</Link>
                    )}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search players..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="bg-gray-700 text-white placeholder-gray-400 py-2 pl-4 pr-10 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 w-full md:w-48"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>

                </div>
            </div>
        </header>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/signup" element={<Signup />}/>
                    <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
                    <Route path="/create-game" element={<ProtectedRoute><CreateGameForm /></ProtectedRoute>} />
                    <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="*" element={<div>404 Not Found</div>} />
                </Routes>
            </Router>
        </AuthContext.Provider>
    );
}

export default App;