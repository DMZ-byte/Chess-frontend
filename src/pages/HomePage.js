import React, { useEffect, useState, useCallback, useRef } from 'react'; // Import useRef
import { Link, useNavigate } from 'react-router-dom';
import {
    getAllGames,
    joinMatchmakingQueue,
    connectWebSocket,
    disconnectWebSocket,
    subscribeToTopic, // Not used in the provided code, but good to keep if needed
    fetchUserId,
    leaveMatchmakingQueue // Add leaveMatchmakingQueue
} from '../api/api';
import styles from './HomePage.module.css';

function HomePage() {
    const [isConnected, setIsConnected] = useState(false);
    const [matchmakingStatus, setMatchmakingStatus] = useState(''); // This seems unused, consider removing
    const [games, setGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorGames, setErrorGames] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null);
    const [isQueued, setIsQueued] = useState(false);
    const navigate = useNavigate();
    const [currentUserId, setCurrentUserId] = useState(null);

    // Use a ref to store callbacks that need to be stable but access latest state
    const callbacksRef = useRef({});

    // Define callbacks using useCallback, ensuring their dependencies are correct
    // These callbacks will be stable across renders as long as their dependencies don't change.
    // They will be passed to connectWebSocket.
    const onWebSocketConnected = useCallback(() => {
        console.log("HomePage: WebSocket connected successfully.");
        setIsConnected(true);
    }, []); // No dependencies for this callback, so it's truly stable

    const onMatchFound = useCallback((matchFoundMessage) => {
        console.log("HomePage: Received match found message:", matchFoundMessage);
        // Use the ref to access the latest state setter without re-creating the callback
        callbacksRef.current.setQueueStatus("Match found! Joining game...");
        callbacksRef.current.setIsQueued(false);

        const gameId = matchFoundMessage.gameId;
        console.log("Extracted gameId:", gameId);

        if (!gameId) {
            console.error("No gameId found in match found message", matchFoundMessage);
            console.error("Available keys in message:", Object.keys(matchFoundMessage));
            callbacksRef.current.setQueueStatus("Error: No game ID received");
            return;
        }

        try {
            console.log("Navigating to game with ID:", gameId);
            setTimeout(() => {
                callbacksRef.current.navigate(`/game/${gameId}`);
            }, 100);
        } catch (err) {
            console.error("navigate failed, using window.location", err);
            window.location.href = `/game/${gameId}`;
        }
    }, []); // This callback only depends on values that will be accessed via ref

    const onMatchStatus = useCallback((statusMessage) => {
        console.log("Match status received:", statusMessage);
        callbacksRef.current.setQueueStatus(statusMessage);
    }, []); // Only depends on the ref

    const onWebSocketError = useCallback((errorMessage) => {
        console.error("HomePage: WebSocket Error:", errorMessage);
        callbacksRef.current.setIsConnected(false);
        callbacksRef.current.setQueueStatus("WebSocket Error: " + errorMessage);
        callbacksRef.current.setIsQueued(false);
    }, []); // Only depends on the ref

    // Update the ref whenever state setters or navigate change
    useEffect(() => {
        callbacksRef.current = {
            setIsConnected,
            setQueueStatus,
            setIsQueued,
            navigate,
        };
    }, [setIsConnected, setQueueStatus, setIsQueued, navigate]);


    const handlePlayGame = () => {
        if (!currentUserId) {
            console.error("User ID not set. Please refresh or check console for errors.");
            setQueueStatus("Error: User ID not set. Please refresh.");
            return;
        }
        if (isConnected) {
            setIsQueued(true);
            setQueueStatus("Joining queue...");
            console.log("Joining queue with user ID:", currentUserId);
            joinMatchmakingQueue(currentUserId);
        } else {
            setQueueStatus("Not connected to server. Please wait or refresh.");
            console.warn("Attempted to queue up but WebSocket is not connected.");
        }
    };

    const handleLeaveQueue = () => {
        if (isConnected) {
            leaveMatchmakingQueue();
            setIsQueued(false);
            setQueueStatus("You have left the queue.");
        } else {
            console.warn("Cannot leave queue, WebSocket not connected.");
        }
    };

    // Effect to fetch userId once on component mount
    useEffect(() => {
        const initializeUserId = async () => {
            try {
                const userId = await fetchUserId();
                setCurrentUserId(userId);
                localStorage.setItem('currentUserId', userId);
                console.log("Fetched user ID:", userId);
            } catch (error) {
                console.error("Failed to fetch user ID:", error);
                // Handle authentication error, e.g., redirect to login
                // navigate('/login'); // Example redirect
            }
        };

        initializeUserId();
    }, []); // Empty dependency array means this runs once on mount


    // Effect to manage WebSocket connection.
    // This now only depends on currentUserId and the *stable* callback references.
    useEffect(() => {
        if (!currentUserId) return; // Don't connect until we have the userId

        console.log("Connecting WebSocket for user:", currentUserId);
        connectWebSocket(
            currentUserId,
            onWebSocketConnected,
            onMatchFound,
            onMatchStatus,
            onWebSocketError
        );

        return () => {
            console.log("HomePage: Disconnecting WebSocket on unmount.");
            disconnectWebSocket();
        };
    }, [currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError]); // These are stable due to useCallback

    // Effect to fetch and poll for games
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

        const intervalId = setInterval(fetchGames, 15000); // Poll for games every 15 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <main className={styles.homePageContainer}>
                <p className="text-center text-xl text-gray-400 mb-8">
                    Welcome to the ultimate chess experience! {currentUserId ? currentUserId : "N/A"}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <section className={styles.playGameSection}>
                        <h2>Play Game</h2>
                        <button
                            onClick={handlePlayGame}
                            disabled={isQueued || !isConnected}
                            className={isQueued || !isConnected ? styles.buttonDisabled : styles.buttonPrimary}
                        >
                            {isQueued ? 'In Queue...' : (isConnected ? 'Play Game (Queue Up)' : 'Connecting...')}
                        </button>
                        {isQueued && (
                            <button
                                onClick={handleLeaveQueue}
                                className={styles.buttonSecondary} // You might want to define a secondary button style
                                style={{marginTop: '10px'}}
                            >
                                Leave Queue
                            </button>
                        )}
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
                            <ul className={styles.activeGamesList}>
                                {games.map((game) => (
                                    <li key={game.id} className={styles.gameItem}>
                                        <div className="flex-grow mb-2 md:mb-0">
                                            <span className="font-medium">Game ID:</span> {game.id} | <span className="font-medium">Status:</span> {game.gameStatus}
                                            <p className="text-sm text-gray-300">
                                                Players: {game.whitePlayer ? `${game.whitePlayer.id}` : (game.gameStatus === 'WAITING_FOR_PLAYER' ? ' (Waiting)' : '')}
                                                {game.blackPlayer ? ` vs Player ${game.blackPlayer.id}` : (game.gameStatus === 'WAITING_FOR_PLAYER' ? ' (Waiting)' : '')}
                                            </p>
                                        </div>
                                        <div>
                                            {game.gameStatus === 'WAITING_FOR_PLAYER' && (
                                                <Link to={`/game/${game.id}`} className={styles.joinSpectateButton}>Join</Link>
                                            )}
                                            {game.gameStatus === 'ACTIVE' && (
                                                <Link to={`/game/${game.id}`} className={styles.joinSpectateButton}>Spectate</Link>
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
                    </section>
                </div>
            </main>
        </div>
    );
}

export default HomePage;