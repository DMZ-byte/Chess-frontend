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

export const registerUser = async (username,password) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/register`,{
            username:username,
            password:password
        });
    } catch (error){
        throw error.response?.data?.error || 'Registration Failed.';
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

export const unsubscribeFromGameUpdates = (gameId) => {
    if(gameSubscriptions.has(gameId)){
        const subscription = gameSubscriptions.get(gameId);
        subscription.unsubscribe();
        gameSubscriptions.delete(gameId);
        console.log('Unsubscribed from /topic/game/{gameId}');
    }
};

export const getGameById = async (gameId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/games/${gameId}`);
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching game:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const setWhiteOrBlackPlayer = async (gameId) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/games/${gameId}`);
        console.log("Trying to become white or black player for game: " + gameId);
        return response;
    }
    catch (error) {
        console.error("An error occured when trying to become white or black player");
        throw error;
    }
}

export const getGameMoves = async (gameId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/games/${gameId}/moves`);
        return response.data;
    } catch (error){
        console.error('Error fetching game moves', error.response ? error.response.data : error.message);
        throw error;
    }
};

export const joinGame = async (gameId, player2Id) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/games/${gameId}/join`, { playerId: String(player2Id) });
        return response.data;
    } catch (error) {
        console.error("Error joining game:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const fetchUserId = async () => {
    try {
        const response = await axios.get("http://localhost:8080/api/auth/userid",{
            withCredentials:true,
        });
        if (response.headers['content-type'].includes('text/html')) {
            throw new Error("Not authenticated (received html");
        }
        return response.data;
    } catch(error){
        throw error;
    }
};

export const fetchUser = async (userId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/games/user/${userId}`);
        if (response.headers['content-type'].includes('text/html')) {
            throw new Error("Not authenticated.");
        }
        return response.data;
    } catch (error) {
        console.error("An error occured while fetching for user.:" + error);
        throw error;
    }
};

// --- WebSocket Setup and Queue Logic ---

let stompClientInstance = null;
let currentConnectedUserId = null;
const gameSubscriptions = new Map();

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
        webSocketFactory: () => {
            const socket = new SockJS(`${API_BASE_URL}/ws`);
            socket.withCredentials = true;
            return socket;
        },
        connectHeaders: {
            login: userId,
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000
    });

    stompClientInstance.onConnect = (frame) => {
        console.log('WebSocket Connected:', frame);

        // Subscribe to user-specific queue for match notifications
        stompClientInstance.subscribe(`/user/queue/match-found`, (message) => {
            console.log("Raw message received on /user/queue/match-found:", message);
            console.log("Message body:", message.body);
            
            try {
                const matchFound = JSON.parse(message.body);
                console.log("Parsed match found message:", matchFound);
                
                if (onMatchFoundCallback) {
                    onMatchFoundCallback(matchFound);
                } else {
                    console.error("No onMatchFoundCallback provided");
                }
            } catch (error) {
                console.error("Error parsing match found message:", error);
                console.error("Raw message body:", message.body);
            }
        });

        // Subscribe to user-specific queue for general status messages
        stompClientInstance.subscribe(`/user/queue/match-status`, (message) => {
            console.log("Match Status received:", message.body);
            if (onMatchStatusCallback) {
                onMatchStatusCallback(message.body);
            }
        });

        // Subscribe to user-specific queue for errors
        stompClientInstance.subscribe(`/user/queue/errors`, (message) => {
            console.error("WebSocket Error received:", message.body);
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

export const subscribeToGameTopic = (gameId, callback) => {
    if (stompClientInstance && stompClientInstance.connected) {
        const subscription = stompClientInstance.subscribe(`/topic/game/${gameId}`, (message) => {
            callback(JSON.parse(message.body));
        });
        gameSubscriptions.set(gameId,subscription);
        console.log(`Subscribed to /topic/game/${gameId}`);
        return subscription; // Return the subscription object so it can be unsubscribed later
    } else {
        console.error("WebSocket not connected. Cannot subscribe to game topic.");
        return null;
    }
};

export const sendMove = (gameId, move) => {
    if (stompClientInstance && stompClientInstance.connected) {
        console.log("The move appears as:"+JSON.stringify(move));
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
        console.log("Sending join queue request for user:", userId);
        stompClientInstance.publish({
            destination: `/app/queue/join`,
            body: JSON.stringify({ userId: userId })
        });
        console.log("Sent join queue request for user:", userId);
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
            body: JSON.stringify({ userId: currentConnectedUserId })
        });
        console.log("Sent leave queue request for user:", currentConnectedUserId);
    } else {
        console.warn("WebSocket not connected. Cannot leave queue.");
    }
};

export const subscribeToGameUpdates = (gameId,onUpdateCallback) => {
    if(!stompClientInstance || !stompClientInstance.connected){
        console.error("Websocket not connected.");
        return null;
    }
    const topic = `/topic/game/${gameId}`;
    if(gameSubscriptions.has(gameId)){
        console.warn(`Already subscribed to ${gameId}`);
        return gameSubscriptions.get(gameId);
    }
    const subscription = stompClientInstance.subscribe(topic, (message) => {
        const updateGame = JSON.parse(message.body);
        onUpdateCallback(updateGame);
    }); 
    gameSubscriptions.set(gameId, subscription);
    console.log(`Subscribed to ${topic}`);
    return subscription;
};