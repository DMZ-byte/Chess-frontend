import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Import everything from your api file
import {
    getAllGames,
    joinMatchmakingQueue,
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage, // Potentially not used directly here, but good to import
    subscribeToTopic // This function is now managed within connectWebSocket
} from '../api/api'; // <--- Make sure this path is correct: '../api/api' or '../api'

import styles from './HomePage.module.css'; // Importing the CSS module

// Header Component (from your provided code)
const ChessHeader = ({ ping, ms }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    return (
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
                    </nav>
                </div>
                <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 w-full md:w-auto">
                    <Link to="/login" className="text-gray-300 hover:text-white text-lg font-medium transition duration-300 ease-in-out px-3 py-2 rounded-md hover:bg-gray-700">Log In</Link>
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
                    <div className="text-gray-300 text-sm md:text-base ml-0 md:ml-4 mt-2 md:mt-0">
                        Ping: {ping}ms | MS: {ms}
                    </div>
                </div>
            </div>
        </header>
    );
};


function HomePage() {
    const [isConnected, setIsConnected] = useState(false);
    const [matchmakingStatus, setMatchmakingStatus] = useState('');
    const [games, setGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorGames, setErrorGames] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null);
    const [isQueued, setIsQueued] = useState(false);
    const navigate = useNavigate();

    const [ping, setPing] = useState(0);
    const [ms, setMs] = useState(0);

    // --- Temporary User ID for demonstration (replace with actual auth) ---
    const [currentUserId, setCurrentUserId] = useState(() => {
        let id = localStorage.getItem('currentUserId');
        if (!id) {
            id = `user_${Math.random().toString(36).substring(2, 11)}`;
            localStorage.setItem('currentUserId', id);
        }
        return id;
    });
    // --- End Temporary User ID ---

    // Callback for when WebSocket connects
    const onWebSocketConnected = useCallback(() => {
        console.log("HomePage: WebSocket connected successfully.");
        setIsConnected(true); // Set connection status
        if (isQueued) {
            // If already queued before disconnect, re-join.
            // This relies on your backend handling re-joins gracefully.
            joinMatchmakingQueue(currentUserId);
        }
    }, [isQueued, currentUserId]);

    // Callback for when a match is found (from WebSocket)
    const onMatchFound = useCallback((matchFoundMessage) => {
        console.log("HomePage: Received match found message:", matchFoundMessage);
        setQueueStatus("Match found! Joining game...");
        setIsQueued(false); // No longer in queue
        navigate(`/games/${matchFoundMessage.gameId}`); // Assuming matchFoundMessage has gameId
    }, [navigate]);

    // Callback for general matchmaking status messages (if your backend sends them)
    const onMatchStatus = useCallback((statusMessage) => {
        setQueueStatus(statusMessage);
    }, []);

    // Callback for WebSocket errors
    const onWebSocketError = useCallback((errorMessage) => {
        console.error("HomePage: WebSocket Error:", errorMessage);
        setIsConnected(false); // Set connection status
        setQueueStatus("WebSocket Error: " + errorMessage);
        setIsQueued(false); // Cannot be queued if connection failed
    }, []);

    // Effect for fetching all games (REST API)
    useEffect(() => {
        const fetchGames = async () => {
            try {
                setLoadingGames(true);
                const fetchedGames = await getAllGames();
                setGames(fetchedGames);
            } catch (err) {
                setErrorGames("Failed to fetch games: " + err.message);
            } finally {
                setLoadingGames(false);
            }
        };
        fetchGames(); // Initial fetch

        const intervalId = setInterval(fetchGames, 15000); // Poll for games every 15 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

    // Effect for WebSocket connection and setting up listeners
    useEffect(() => {
        // Pass all necessary callbacks to your centralized connectWebSocket function
        connectWebSocket(currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError);

        return () => {
            disconnectWebSocket(); // Clean up WebSocket on component unmount
            console.log("HomePage: WebSocket disconnected on unmount.");
        };
    }, [currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError]); // Depend on callbacks and userId

    // Effect for simulating Ping and MS
    useEffect(() => {
        const interval = setInterval(() => {
            const simulatedPing = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
            setPing(simulatedPing);
            setMs(simulatedPing);
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const handlePlayGame = () => {
        if (!currentUserId) {
            console.error("User ID not set. Please refresh or check console for errors.");
            setQueueStatus("Error: User ID not set. Please refresh.");
            return;
        }
        // Only attempt to join queue if WebSocket is connected
        if (isConnected) {
            setIsQueued(true);
            setQueueStatus("Joining queue...");
            joinMatchmakingQueue(currentUserId); // This sends the WebSocket message
        } else {
            setQueueStatus("Not connected to server. Please wait or refresh.");
            console.warn("Attempted to queue up but WebSocket is not connected.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <ChessHeader ping={ping} ms={ms} />

            <main className={styles.homePageContainer}>
                <p className="text-center text-xl text-gray-400 mb-8">
                    Welcome to the ultimate chess experience!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <section className={styles.playGameSection}>
                        <h2>Play Game</h2>
                        <button
                            onClick={handlePlayGame}
                            disabled={isQueued || !isConnected} // Disable if queued OR not connected
                            className={isQueued || !isConnected ? styles.buttonDisabled : styles.buttonPrimary}
                        >
                            {isQueued ? 'In Queue...' : (isConnected ? 'Play Game (Queue Up)' : 'Connecting...')}
                        </button>
                        {queueStatus && <p className={styles.queueStatus}>{queueStatus}</p>}
                        {isQueued && <p className={styles.waitingMessage}>Waiting for an opponent. Please keep this tab open.</p>}
                    </section>

                    <section className={`${styles.activeGamesSection} md:col-span-2`}>
                        <h2>Active/Available Games</h2>
                        {loadingGames ? (
                            <p className="text-gray-400">Loading games...</p>
                        ) : errorGames ? (
                            <p className={styles.errorMessage}>{errorGames}</p>
                        ) : games.length === 0 ? (
                            <p className="text-gray-400">No active games found. Be the first to create one!</p>
                        ) : (
                            <ul className={styles.activeGamesList}> {/* Changed class name for clarity */}
                                {games.map((game) => (
                                    <li key={game.id} className={styles.gameItem}>
                                        <div className="flex-grow mb-2 md:mb-0">
                                            <span className="font-medium">Game ID:</span> {game.id} | <span className="font-medium">Status:</span> {game.gameStatus}
                                            {/* Adjusted player display based on your JSON structure */}
                                            <p className="text-sm text-gray-300">
                                                Players: {game.whitePlayerId ? `Player ${game.whitePlayerId}` : 'N/A'}
                                                {game.blackPlayerId ? ` vs Player ${game.blackPlayerId}` : (game.gameStatus === 'WAITING_FOR_PLAYER' ? ' (Waiting)' : '')}
                                            </p>
                                        </div>
                                        <div>
                                            {game.gameStatus === 'WAITING_FOR_PLAYER' && (
                                                <Link to={`/games/${game.id}`} className={styles.joinSpectateButton}>Join</Link>
                                            )}
                                            {game.gameStatus === 'ACTIVE' && (
                                                <Link to={`/games/${game.id}`} className={styles.joinSpectateButton}>Spectate</Link>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className={styles.createGameSection}>
                        <h2>Create Custom Game</h2>
                        <Link to="/create-game" className={styles.createGameButton}>Create New Game</Link>
                        <p className="mt-4 text-center text-gray-400 text-sm">Share the game ID with a friend to play privately.</p>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default HomePage;