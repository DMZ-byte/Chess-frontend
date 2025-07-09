// src/api.js
import axios from 'axios';
import { Client } from '@stomp/stompjs'; // Use { Client } for named import from @stomp/stompjs
import SockJS from 'sockjs-client'; // Import SockJS for the fallback

// Define your base URL.
const API_BASE_URL = 'http://localhost:8080';

// --- REST API Calls ---

export const getAllGames = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/games`);
        return response.data;
    } catch (error) {
        console.error("Error fetching all games:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const createNewGame = async (player1Id) => {
    try {
        // Updated to send a DTO-like structure if needed by backend, otherwise keep it simple
        const response = await axios.post(`${API_BASE_URL}/api/games/create`, { player1Id });
        return response.data;
    } catch (error) {
        console.error("Error creating game:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const getGameById = async (gameId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/games/${gameId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching game:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const joinGame = async (gameId, player2Id) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/games/${gameId}/join`, { playerId: player2Id });
        return response.data;
    } catch (error) {
        console.error("Error joining game:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// --- WebSocket Setup and Queue Logic ---

let stompClientInstance = null;
// Store the userId locally within the API file if necessary for subscriptions
let currentConnectedUserId = null;

/**
 * Connects to the WebSocket and sets up subscriptions for private user messages.
 * This function should ideally be called once, perhaps in your App.js or a top-level context provider.
 * @param {string} userId - The ID of the current authenticated user.
 * @param {function} onConnectedCallback - Callback when WebSocket is successfully connected.
 * @param {function} onMatchFoundCallback - Callback when a match is found.
 * @param {function} onMatchStatusCallback - Callback for general queue status messages.
 * @param {function} onErrorCallback - Callback for STOMP errors.
 */
export const connectWebSocket = (userId, onConnectedCallback, onMatchFoundCallback, onMatchStatusCallback, onErrorCallback) => {
    // If client is already connected and it's the same user, just call onConnected and return
    if (stompClientInstance && stompClientInstance.connected && currentConnectedUserId === userId) {
        console.log("WebSocket already connected for user:", userId);
        if (onConnectedCallback) onConnectedCallback(); // Call the callback immediately
        return stompClientInstance;
    }

    // If a connection exists for a different user, or is not connected, deactivate it first
    if (stompClientInstance) {
        stompClientInstance.deactivate();
        stompClientInstance = null;
    }

    currentConnectedUserId = userId; // Store the user ID for internal use

    // Use SockJS for fallback if direct WebSocket isn't available
    const socket = new SockJS(`${API_BASE_URL}/ws`);

    stompClientInstance = new Client({
        webSocketFactory: () => socket, // Use the SockJS wrapper
        // brokerURL: `ws://localhost:8080/ws`, // This is an alternative if not using SockJS
        // Headers for STOMP CONNECT frame.
        // The 'login' header will be used by Spring to identify the Principal (e.g., in @SendToUser).
        connectHeaders: {
            login: userId,
            // passcode: 'password' // Include if your backend expects a passcode for STOMP auth
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: function (str) {
            // console.log('STOMP Debug:', str); // Uncomment for detailed STOMP logs
        },
    });

    stompClientInstance.onConnect = (frame) => {
        console.log('WebSocket Connected:', frame);

        // Subscribe to user-specific queue for match notifications
        // The `/user/queue/` prefix is handled by Spring's UserDestinationResolver
        // Spring will translate this to a unique user-specific queue based on the Principal's name (which is 'userId' from connectHeaders)
        stompClientInstance.subscribe(`/user/queue/match-found`, (message) => {
            const matchFound = JSON.parse(message.body);
            console.log("Match found!", matchFound);
            if (onMatchFoundCallback) {
                onMatchFoundCallback(matchFound);
            }
        });

        // Subscribe to user-specific queue for general status messages (e.g., "Waiting for opponent...")
        stompClientInstance.subscribe(`/user/queue/match-status`, (message) => {
            console.log("Match Status:", message.body);
            if (onMatchStatusCallback) {
                onMatchStatusCallback(message.body);
            }
        });

        // Subscribe to user-specific queue for errors (if your backend sends specific error messages to users)
        stompClientInstance.subscribe(`/user/queue/errors`, (message) => {
            console.error("WebSocket Error:", message.body);
            if (onErrorCallback) {
                onErrorCallback(message.body);
            }
        });

        if (onConnectedCallback) {
            onConnectedCallback();
        }
    };

    stompClientInstance.onStompError = (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
        if (onErrorCallback) {
            onErrorCallback('STOMP Error: ' + (frame.headers['message'] || frame.body));
        }
    };

    stompClientInstance.onWebSocketError = (event) => {
        console.error('Underlying WebSocket Error:', event);
        if (onErrorCallback) {
            onErrorCallback('WebSocket connection failed unexpectedly.');
        }
    };

    stompClientInstance.onDisconnect = () => {
        console.log("WebSocket Disconnected.");
        currentConnectedUserId = null; // Clear userId on disconnect
    };

    stompClientInstance.activate(); // Initiate connection
    return stompClientInstance;
};

export const disconnectWebSocket = () => {
    if (stompClientInstance) {
        stompClientInstance.deactivate();
        stompClientInstance = null;
        currentConnectedUserId = null; // Ensure userId is cleared on explicit disconnect
        console.log("WebSocket deactivated.");
    }
};

/**
 * Subscribes to a specific game topic for real-time game state updates.
 * This is typically called from the GamePage component.
 * @param {string} gameId - The ID of the game to subscribe to.
 * @param {function} callback - Callback function to handle received game state updates.
 * @returns {object|null} A subscription object if successful, null otherwise.
 */
export const subscribeToGameTopic = (gameId, callback) => {
    if (stompClientInstance && stompClientInstance.connected) {
        const subscription = stompClientInstance.subscribe(`/topic/game/${gameId}`, (message) => {
            callback(JSON.parse(message.body));
        });
        console.log(`Subscribed to /topic/game/${gameId}`);
        return subscription; // Return the subscription object so it can be unsubscribed later
    } else {
        console.error("WebSocket not connected. Cannot subscribe to game topic.");
        // You might want to re-attempt connection here or show a user message
        return null;
    }
};

/**
 * Sends a chess move via WebSocket.
 * @param {string} gameId - The ID of the game.
 * @param {object} move - The move object (e.g., { san: "e4", playerId: "123" }).
 */
export const sendMove = (gameId, move) => {
    if (stompClientInstance && stompClientInstance.connected) {
        stompClientInstance.publish({
            destination: `/app/game/${gameId}/move`,
            body: JSON.stringify(move),
        });
        console.log("Sent move:", move);
    } else {
        console.error("WebSocket not connected. Cannot send move.");
        alert("Cannot send move: WebSocket not connected. Please refresh or try again.");
    }
};

/**
 * Sends a request to join the matchmaking queue via WebSocket.
 * The user ID is expected to be provided via the STOMP CONNECT frame's 'login' header.
 */
export const joinMatchmakingQueue = () => { // Removed userId param as it's from currentConnectedUserId
    if (stompClientInstance && stompClientInstance.connected) {
        stompClientInstance.publish({
            destination: `/app/queue/join`,
            // No body needed as the server should get player ID from Principal (derived from 'login' header)
            // If your backend *still* needs it in the body, uncomment and adjust:
            // body: JSON.stringify({ userId: currentConnectedUserId })
        });
        console.log("Sent join queue request for user:", currentConnectedUserId);
    } else {
        console.error("WebSocket not connected. Cannot join queue.");
        alert("Cannot join queue: WebSocket not connected. Please refresh or try again.");
    }
};

/**
 * Sends a request to leave the matchmaking queue via WebSocket.
 */
export const leaveMatchmakingQueue = () => {
    if (stompClientInstance && stompClientInstance.connected) {
        stompClientInstance.publish({
            destination: `/app/queue/leave`,
            // body: JSON.stringify({ userId: currentConnectedUserId }) // If your backend needs it
        });
        console.log("Sent leave queue request for user:", currentConnectedUserId);
    } else {
        console.warn("WebSocket not connected. Cannot leave queue.");
    }
};