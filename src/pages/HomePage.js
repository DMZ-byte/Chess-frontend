// src/HomePage.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllGames, joinMatchmakingQueue, connectWebSocket, disconnectWebSocket } from '../api/api';
import styles from './HomePage.module.css'; // Assuming you have a CSS module for styling

function HomePage() {
    const [games, setGames] = useState([]);
    const [color,setColor] = useState("red");
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorGames, setErrorGames] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null); // To display queue messages
    const [isQueued, setIsQueued] = useState(false); // To track if player is in queue
    const navigate = useNavigate();

    const updateColor = () => {
        setColor("blue");
    }
    // --- Temporary User ID for demonstration (replace with actual auth) ---
    // This ensures a consistent user ID for WebSocket connections across sessions.
    // In a real application, this would come from your authentication system (e.g., JWT token).
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
        // If we were trying to queue, re-send the queue request if connection was lost
        if (isQueued) {
            joinMatchmakingQueue(currentUserId);
        }
    }, [isQueued, currentUserId]);

    // Callback for when a match is found
    const onMatchFound = useCallback((matchFoundMessage) => {
        console.log("HomePage: Received match found message:", matchFoundMessage);
        setQueueStatus("Match found! Joining game...");
        setIsQueued(false); // No longer in queue
        // Navigate to the new game board using the gameId from the message
        navigate(`/game/${matchFoundMessage.gameId}`);
    }, [navigate]);

    // Callback for general match status messages (e.g., "Waiting for opponent...")
    const onMatchStatus = useCallback((statusMessage) => {
        setQueueStatus(statusMessage);
    }, []);

    // Callback for WebSocket errors
    const onWebSocketError = useCallback((errorMessage) => {
        console.error("HomePage: WebSocket Error:", errorMessage);
        setQueueStatus("WebSocket Error: " + errorMessage);
        setIsQueued(false); // Stop queuing on error
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
        fetchGames();

        // Optional: Refresh games list periodically
        const intervalId = setInterval(fetchGames, 15000); // Refresh every 15 seconds
        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, []);

    // Effect for WebSocket connection and setting up listeners
    useEffect(() => {
        // Connect WebSocket and set up listeners
        // Pass the currentUserId so the backend can identify the Principal
        connectWebSocket(currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError);

        // Cleanup function: disconnect WebSocket when HomePage component unmounts
        // This is important to prevent memory leaks and unnecessary open connections.
        return () => {
            // Only disconnect if this is the last component using the WebSocket,
            // or if you have a more sophisticated context/Redux for managing the connection.
            // For a simple app, disconnecting here is generally safe.
            disconnectWebSocket();
            console.log("HomePage: WebSocket disconnected on unmount.");
        };
    }, [currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError]); // Dependencies for useEffect

    const handlePlayGame = () => {
        if (!currentUserId) {
            alert("User ID not set. Please refresh or check console for errors.");
            return;
        }
        setIsQueued(true);
        setQueueStatus("Joining queue...");
        joinMatchmakingQueue(currentUserId); // Call the API function to send STOMP message
    };

    return (
        <div className={styles.homePageContainer}>
            <h1>Chess Home</h1>
            <button onClick={updateColor}>Change color</button>
            <p>{color}</p>
            <section className={styles.playGameSection}>
                <h2>Play Game</h2>
                <button
                    onClick={handlePlayGame}
                    disabled={isQueued}
                    className={isQueued ? styles.buttonDisabled : styles.buttonPrimary}
                >
                    {isQueued ? 'In Queue...' : 'Play Game (Queue Up)'}
                </button>
                {queueStatus && <p className={styles.queueStatus}>{queueStatus}</p>}
                {isQueued && <p className={styles.waitingMessage}>Waiting for an opponent. Please keep this tab open.</p>}
            </section>

            <section className={styles.activeGamesSection}>
                <h2>Active/Available Games</h2>
                {loadingGames ? (
                    <p>Loading games...</p>
                ) : errorGames ? (
                    <p className={styles.errorMessage}>{errorGames}</p>
                ) : games.length === 0 ? (
                    <p>No active games found. Be the first to create one!</p>
                ) : (
                    <ul className={styles.gameList}>
                        {games.map((game) => (
                            <li key={game.id} className={styles.gameItem}>
                                Game ID: {game.id} | Status: {game.gameStatus} | Players:
                                {game.whitePlayer ? game.whitePlayerId : 'N/A'}
                                {game.blackPlayer ? ` vs ${game.blackPlayerId}` : ' (Waiting)'}
                                {game.gameStatus === 'WAITING_FOR_PLAYER' && (
                                    <Link to={`/games/${game.id}`} className={styles.joinSpectateButton}>Join</Link>
                                )}
                                {game.gameStatus === 'ACTIVE' && (
                                    <Link to={`/games/${game.id}`} className={styles.joinSpectateButton}>Spectate</Link>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={styles.createGameSection}>
                <h2>Create Custom Game</h2>
                <Link to="/create-game" className={styles.createGameButton}>Create New Game</Link>
                <p>Share the game ID with a friend to play privately.</p>
            </section>
        </div>
    );
}

export default HomePage;