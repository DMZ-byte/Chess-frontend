// src/components/CreateGame/CreateGame.js (if this is your chosen location)
// OR src/pages/CreateGame.js (if this is your chosen location)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Important for routing after game creation
import axios from "axios";
import * as api from "../../api/api";
import styles from './CreateGame.module.css'; // Adjust path if CSS is elsewhere

// 1. Component name MUST start with an uppercase letter
function CreateGameForm() {
    // 2. ALL useState calls MUST be inside the component function
    const [time, setTime] = useState(1);
    const [incrementTime, setIncrementTime] = useState(0);
    const [player1Id, setPlayer1Id] = useState(null);
    const [player2Id, setPlayer2Id] = useState("");
    const [playerColor,setPlayerColor] = useState("");
    // Initialize useNavigate hook INSIDE the component
    const navigate = useNavigate();
    useEffect(() => {
        const getUserId = async () => {
            const id = await api.fetchUserId();
            if (id){
                setPlayer1Id(id);
            }
        }

        getUserId();
    }, []);
    const handleSubmit = async (event) => {
        event.preventDefault();

        const payload = {
            player1Id: player1Id,
            player2Id: player2Id,
            timeControl: parseInt(time, 10), // Ensure numbers are sent as numbers
            timeIncrement: parseInt(incrementTime, 10), // Ensure numbers are sent as numbers
            color: playerColor
        };

        try {
            const response = await axios.post("http://localhost:8080/api/games/create", payload);
            const newGameId = response.data.id; // Assuming Spring returns { id: "..." }

            alert("Game created successfully!");
            // Redirect to the new game's page
            navigate(`/game/${newGameId}`);

        } catch (error) {
            console.error("Error creating game:", error.response ? error.response.data : error.message);
            alert("Failed to create game. See console for details.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.createGameForm}>
            <label>
                Create Game
            </label>

            <label>
                Minutes per side: {time}
            </label>
            <input
                className={styles.range}
                type="range"
                min="1"
                max="30"
                value={time}
                onChange={(e) => setTime(e.target.value)} // Don't parse here, parse in payload
            />
            <p>Current players Id: {player1Id}</p><br></br>
            <label>Seconds Increment: {incrementTime}</label>
            <input
                className={styles.range}
                type="range"
                min="0"
                max="30"
                value={incrementTime}
                onChange={(e) => setIncrementTime(e.target.value)} // Don't parse here, parse in payload
            />
            <label> Play as black or white:</label>
            <select onSelect={(e) => setPlayerColor(e.target.value)}>
                <option value="WHITE">WHITE</option>
                <option value="BLACK">BLACK</option>
            </select>

            <input type="submit" value="Create Game" />
        </form>
    );
}

export default CreateGameForm; // Export the capitalized component