import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Import everything from your api file
import {
    getAllGames,
    joinMatchmakingQueue,
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage, 
    subscribeToTopic,
    fetchUserId 
} from '../api/api';
import styles from './HomePage.module.css'; 



function HomePage() {
    const [isConnected, setIsConnected] = useState(false);
    const [matchmakingStatus, setMatchmakingStatus] = useState('');
    const [games, setGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorGames, setErrorGames] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null);
    const [isQueued, setIsQueued] = useState(false);
    const navigate = useNavigate();

    
    const [currentUserId, setCurrentUserId] = useState(null);
    
    const onWebSocketConnected = useCallback(() => {
        try {
            console.log("HomePage: WebSocket connected successfully.");
            setIsConnected(true); // Set connection status

        }
        catch (error) {
            console.error("error when trying to connect websocket in home page: "+ error);
            throw error;
        }        
    }, [isQueued, currentUserId]);
    useEffect(() => {
        const initializeUserId = async () => {
            try {
                const userId = await fetchUserId();
                setCurrentUserId(userId);
                localStorage.setItem('currentUserId', userId);
                console.log("Fetched user ID:", userId);
            } catch (error) {
                console.error("Failed to fetch user ID:", error);
            }
        };

        initializeUserId();
    }, []);
    // Callback for when a match is found (from WebSocket)
    const onMatchFound = useCallback((matchFoundMessage) => {
        console.log("HomePage: Received match found message:", matchFoundMessage);
        setQueueStatus("Match found! Joining game...");
        setIsQueued(false); //not working 
        const gameId = matchFoundMessage.gameId;
        if(!gameId){
            console.error("No gameId found in match found message",matchFoundMessage);
            return;
        }
        navigate(`/game/${gameId}`); // Assuming matchFoundMessage has gameId
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
            console.log("im about to join: "+currentUserId);
            joinMatchmakingQueue(currentUserId); // This sends the WebSocket message
        } else {
            setQueueStatus("Not connected to server. Please wait or refresh.");
            console.warn("Attempted to queue up but WebSocket is not connected.");
        }
    };

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
                            <ul className={styles.activeGamesList}> 
                                {games.map((game) => (
                                    <li key={game.id} className={styles.gameItem}>
                                        <div className="flex-grow mb-2 md:mb-0">
                                            <span className="font-medium">Game ID:</span> {game.id} | <span className="font-medium">Status:</span> {game.gameStatus}
                                            {/* Adjusted player display based on your JSON structure */}
                                            <p className="text-sm text-gray-300">
                                                Players: {game.whitePlayer.id ? `Player ${game.whitePlayer.id}` : 'N/A'}
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