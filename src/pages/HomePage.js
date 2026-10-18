import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import {
    getAllGames,
    joinMatchmakingQueue,
    connectWebSocket,
    disconnectWebSocket,
    fetchUserId,
    fetchUser,
    createGuest,
    leaveMatchmakingQueue
} from '../api/api';
import styles from './HomePage.module.css';

const TIME_CATEGORIES = [
    {
        duration: 1,
        title: '1 min',
        category: 'Bullet',
        choices: [
            { minutes: 1, increment: 0, label: '1 + 0' },
            { minutes: 1, increment: 1, label: '1 + 1' },
            { minutes: 1, increment: 2, label: '1 + 2' },
        ],
    },
    {
        duration: 2,
        title: '2 min',
        category: 'Bullet',
        choices: [
            { minutes: 2, increment: 0, label: '2 + 0' },
            { minutes: 2, increment: 1, label: '2 + 1' },
            { minutes: 2, increment: 2, label: '2 + 2' },
        ],
    },
    {
        duration: 3,
        title: '3 min',
        category: 'Blitz',
        choices: [
            { minutes: 3, increment: 0, label: '3 + 0' },
            { minutes: 3, increment: 1, label: '3 + 1' },
            { minutes: 3, increment: 2, label: '3 + 2' },
        ],
    },
    {
        duration: 5,
        title: '5 min',
        category: 'Blitz',
        choices: [
            { minutes: 5, increment: 0, label: '5 + 0' },
            { minutes: 5, increment: 2, label: '5 + 2' },
            { minutes: 5, increment: 5, label: '5 + 5' },
        ],
    },
    {
        duration: 10,
        title: '10 min',
        category: 'Rapid',
        choices: [
            { minutes: 10, increment: 0, label: '10 + 0' },
            { minutes: 10, increment: 2, label: '10 + 2' },
            { minutes: 10, increment: 5, label: '10 + 5' },
        ],
    },
    {
        duration: 15,
        title: '15 min',
        category: 'Rapid',
        choices: [
            { minutes: 15, increment: 0, label: '15 + 0' },
            { minutes: 15, increment: 5, label: '15 + 5' },
            { minutes: 15, increment: 10, label: '15 + 10' },
        ],
    },
    {
        duration: 30,
        title: '30 min',
        category: 'Classical',
        choices: [
            { minutes: 30, increment: 0, label: '30 + 0' },
            { minutes: 30, increment: 10, label: '30 + 10' },
            { minutes: 30, increment: 30, label: '30 + 30' },
        ],
    },
];

const DURATION_OPTIONS = [1, 2, 3, 5, 10, 15, 30];
const INCREMENT_OPTIONS = [0, 1, 2, 5, 10, 30];

function HomePage() {
    const [isConnected, setIsConnected] = useState(false);
    const [games, setGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [errorGames, setErrorGames] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null);
    const [isQueued, setIsQueued] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTimeControl, setSelectedTimeControl] = useState(null);
    const [customMinutes, setCustomMinutes] = useState(5);
    const [customIncrement, setCustomIncrement] = useState(2);

    const navigate = useNavigate();
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentNickname, setCurrentNickname] = useState(null);

    const { setUser } = useContext(AuthContext);
    // Use a ref to store callbacks that need to be stable but access latest state
    const callbacksRef = useRef({});

    // Define callbacks using useCallback, ensuring their dependencies are correct
    const onWebSocketConnected = useCallback(() => {
        console.log("HomePage: WebSocket connected successfully.");
        setIsConnected(true);
    }, []);

    const onMatchFound = useCallback((matchFoundMessage) => {
        console.log("HomePage: Received match found message:", matchFoundMessage);
        callbacksRef.current.setQueueStatus("Match found! Joining game...");
        callbacksRef.current.setIsQueued(false);

        const gameId = matchFoundMessage.gameId;
        console.log("Extracted gameId:", gameId);

        if (!gameId) {
            console.error("No gameId found in match found message", matchFoundMessage);
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
    }, []);

    const onMatchStatus = useCallback((statusMessage) => {
        console.log("Match status received:", statusMessage);
        callbacksRef.current.setQueueStatus(statusMessage);
    }, []);

    const onWebSocketError = useCallback((errorMessage) => {
        console.error("HomePage: WebSocket Error:", errorMessage);
        callbacksRef.current.setIsConnected(false);
        callbacksRef.current.setQueueStatus("WebSocket Error: " + errorMessage);
        callbacksRef.current.setIsQueued(false);
    }, []);

    // Update the ref whenever state setters or navigate change
    useEffect(() => {
        callbacksRef.current = {
            setIsConnected,
            setQueueStatus,
            setIsQueued,
            navigate,
        };
    }, [setIsConnected, setQueueStatus, setIsQueued, navigate]);

    useEffect(() => {
        const initializeUserId = async () => {
            try {
                let userId;
                try {
                    userId = await fetchUserId();
                } catch {
                    await createGuest();
                    userId = await fetchUserId();
                }
                setCurrentUserId(userId);
                localStorage.setItem('currentUserId', userId);

                const profile = await fetchUser(userId);
                setCurrentNickname(profile.nickname || profile.username);
                setUser(profile);
            } catch (error) {
                console.error("Failed to initialize user:", error);
                setQueueStatus("could not reach server");
            }
        };
        initializeUserId();
    }, [setUser]);

    const handleSelectTimeControl = (minutes, increment) => {
        if (!currentUserId) {
            console.error("User ID not set. Please refresh or check console for errors.");
            setQueueStatus("Error: User ID not set. Please refresh.");
            return;
        }
        if (isConnected) {
            setIsQueued(true);
            setSelectedTimeControl({ minutes, increment });
            setQueueStatus(`Queued for ${minutes} min + ${increment} sec...`);
            setIsModalOpen(false);
            console.log(`Joining queue: user=${currentUserId}, time=${minutes}m, inc=${increment}s`);
            joinMatchmakingQueue(currentUserId, minutes, increment);
        } else {
            setQueueStatus("Not connected to server. Please wait or refresh.");
            console.warn("Attempted to queue up but WebSocket is not connected.");
        }
    };

    const handlePlayGameClick = () => {
        if (!isConnected) {
            setQueueStatus("Not connected to server. Please wait or refresh.");
            return;
        }
        setIsModalOpen(true);
    };

    const handleLeaveQueue = () => {
        if (isConnected) {
            leaveMatchmakingQueue();
            setIsQueued(false);
            setSelectedTimeControl(null);
            setQueueStatus("You have left the queue.");
        } else {
            console.warn("Cannot leave queue, WebSocket not connected.");
        }
    };

    // Effect to manage WebSocket connection
    useEffect(() => {
        if (!currentUserId) return;

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
    }, [currentUserId, onWebSocketConnected, onMatchFound, onMatchStatus, onWebSocketError]);

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

        const intervalId = setInterval(fetchGames, 15000);
        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <main className={styles.homePageContainer}>
                <p className="text-center text-xl text-gray-400 mb-8">
                    Welcome to the ultimate chess experience! {currentNickname || "N/A"}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <section className={styles.playGameSection}>
                        <h2>Play Game</h2>

                        {!isQueued ? (
                            <button
                                onClick={handlePlayGameClick}
                                disabled={!isConnected}
                                className={!isConnected ? styles.buttonDisabled : styles.buttonPrimary}
                            >
                                {isConnected ? 'Play Game' : 'Connecting...'}
                            </button>
                        ) : (
                            <div className={styles.inQueueCard}>
                                <div className={styles.queueDetailText}>
                                    {selectedTimeControl
                                        ? `${selectedTimeControl.minutes} min + ${selectedTimeControl.increment} sec`
                                        : 'Quick Match'}
                                </div>
                                <button
                                    onClick={handleLeaveQueue}
                                    className={styles.buttonSecondary}
                                >
                                    Leave Queue
                                </button>
                            </div>
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
                                                Players: {game.whitePlayer ? game.whitePlayer.nickname : (game.gameStatus === 'WAITING_FOR_PLAYER' ? ' (Waiting)' : '')}
                                                {game.blackPlayer ? ` vs ${game.blackPlayer.nickname}` : (game.gameStatus === 'WAITING_FOR_PLAYER' ? ' (Waiting)' : '')}
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

            {/* Time Control Selection Modal */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Choose Time Control</h3>
                            <button
                                className={styles.closeButton}
                                onClick={() => setIsModalOpen(false)}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {/* 3 Choices Each for 1 min, 2 min, 3 min, 5 min, 10 min, 15 min, 30 min */}
                        <div className={styles.timePresetsGrid}>
                            {TIME_CATEGORIES.map((cat) => (
                                <div key={cat.duration} className={styles.durationCard}>
                                    <div className={styles.durationHeader}>
                                        <span className={styles.durationTitle}>{cat.title}</span>
                                        <span className={styles.durationBadge}>{cat.category}</span>
                                    </div>
                                    <div className={styles.choicesRow}>
                                        {cat.choices.map((choice) => (
                                            <button
                                                key={`${choice.minutes}-${choice.increment}`}
                                                className={styles.choiceBtn}
                                                onClick={() => handleSelectTimeControl(choice.minutes, choice.increment)}
                                            >
                                                {choice.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Custom increment & duration selector (1s, 2s, 5s, 10s, 30s increments) */}
                        <div className={styles.customSection}>
                            <h4 className={styles.customSectionTitle}>Custom Time & Increment Options</h4>

                            <div className={styles.selectorLabel}>Duration:</div>
                            <div className={styles.pillRow}>
                                {DURATION_OPTIONS.map((min) => (
                                    <button
                                        key={min}
                                        className={customMinutes === min ? styles.selectorPillActive : styles.selectorPill}
                                        onClick={() => setCustomMinutes(min)}
                                    >
                                        {min} min
                                    </button>
                                ))}
                            </div>

                            <div className={styles.selectorLabel}>Increment:</div>
                            <div className={styles.pillRow}>
                                {INCREMENT_OPTIONS.map((sec) => (
                                    <button
                                        key={sec}
                                        className={customIncrement === sec ? styles.selectorPillActive : styles.selectorPill}
                                        onClick={() => setCustomIncrement(sec)}
                                    >
                                        {sec === 0 ? '0 sec (None)' : `${sec} sec`}
                                    </button>
                                ))}
                            </div>

                            <button
                                className={styles.customPlayBtn}
                                onClick={() => handleSelectTimeControl(customMinutes, customIncrement)}
                            >
                                Play {customMinutes} min + {customIncrement} sec
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HomePage;