// src/api.js
import axios from 'axios';
import * as StompJs from '@stomp/stompjs';

// Define your base URL. For development with Create React App's proxy,
// you can use an empty string for relative paths.
// For production, this would be your actual backend domain.
const API_BASE_URL = 'http://localhost:8080'; // Or '' if using proxy in package.json

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

// This will be a single STOMP client instance that can be reused across your app
let stompClientInstance = null;

/**
 * Connects to the WebSocket and sets up subscriptions for private user messages.
 * This function should ideally be called once, perhaps in your App.js or a top-level context provider.
 * @param {string} userId - The ID of the current authenticated user.
 * @param {function} onConnectedCallback - Callback when WebSocket is successfully connected.
 * @param {function} onMatchFoundCallback - Callback when a match is found.
 * @param {function} onMatchStatusCallback - Callback for general queue status messages.
 * @param {function} onErrorCallback - Callback for STOMP errors.
 * @returns {StompJs.Client} The STOMP client instance.
 */
export const connectWebSocket = (userId, onConnectedCallback, onMatchFoundCallback, onMatchStatusCallback, onErrorCallback) => {
    if (stompClientInstance && stompClientInstance.connected) {
        console.log("WebSocket already connected.");
        onConnectedCallback(); // Call the callback immediately
        return stompClientInstance;
    }

    stompClientInstance = new StompJs.Client({
        brokerURL: `ws://localhost:8080/ws`, // Use your configured WebSocket endpoint
        // Headers for STOMP CONNECT frame.
        // If you're using Spring Security, you might pass a JWT token here.
        // For now, we're passing a simple 'login' header for the Principal.getName() in Spring.
        connectHeaders: {
            login: userId, // This 'login' header will be used by Spring Security to populate Principal.getName()
            passcode: 'password' // Dummy passcode, not used but often expected by STOMP
        },
        reconnectDelay: 5000, // Reconnect after 5 seconds if connection is lost
        heartbeatIncoming: 4000, // Client expects to receive heartbeats every 4s
        heartbeatOutgoing: 4000  // Client sends heartbeats every 4s
    });

    stompClientInstance.onConnect = (frame) => {
        console.log('WebSocket Connected:', frame);

        // Subscribe to user-specific queue for match notifications
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

        // Subscribe to user-specific queue for errors
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
        if (onErrorCallback) { // Use the general error callback for STOMP errors
            onErrorCallback('STOMP Error: ' + (frame.headers['message'] || frame.body));
        }
    };

    stompClientInstance.onDisconnect = () => {
        console.log("WebSocket Disconnected.");
    };

    stompClientInstance.activate(); // Initiate connection
    return stompClientInstance;
};

export const disconnectWebSocket = () => {
    if (stompClientInstance && stompClientInstance.connected) {
        stompClientInstance.deactivate();
        stompClientInstance = null;
        console.log("WebSocket deactivated.");
    }
};

/**
 * Subscribes to a specific game topic for real-time game state updates.
 * This is typically called from the GamePage component.
 * @param {string} gameId - The ID of the game to subscribe to.
 * @param {function} callback - Callback function to handle received game state updates.
 */
export const subscribeToGameTopic = (gameId, callback) => {
    if (stompClientInstance && stompClientInstance.connected) {
        // Ensure we don't double-subscribe if already subscribed to this topic
        // StompJs handles this somewhat, but explicit check can be safer.
        // For simplicity, we'll just subscribe.
        stompClientInstance.subscribe(`/topic/game/${gameId}`, (message) => {
            callback(JSON.parse(message.body));
        });
        console.log(`Subscribed to /topic/game/${gameId}`);
    } else {
        console.error("WebSocket not connected. Cannot subscribe to game topic.");
        // You might want to re-attempt connection here or show a user message
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
 */
export const joinMatchmakingQueue = (userId) => {
    if (stompClientInstance && stompClientInstance.connected) {
        stompClientInstance.publish({
            destination: `/app/queue/join`,
            // No body needed as the server gets player ID from Principal
            // body: JSON.stringify({ playerId: userId }) // If your backend expects it in body
        });
        console.log("Sent join queue request for user:", userId);
    } else {
        console.error("WebSocket not connected. Cannot join queue.");
        alert("Cannot join queue: WebSocket not connected. Please refresh or try again.");
    }
};