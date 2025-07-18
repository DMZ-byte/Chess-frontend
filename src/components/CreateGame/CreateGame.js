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
    const [playerColor,setPlayerColor] = useState("WHITE");
    // Initialize useNavigate hook INSIDE the component
    const navigate = useNavigate();
    useEffect(() => {
        const getUserId = async () => {
          try{
            const id = await api.fetchUserId();
            if (id){
                setPlayer1Id(id);
            }
          } catch (error){
            console.log("Couldnt fetch id.");
            navigate("/login");
          } 
        }

        getUserId();
    }, [navigate]);
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
            console.log("We are making a post request with payload: "+payload.player1Id + ", " + payload.color + ", " + payload.player2Id + ", " + payload.timeControl + ", " + payload.timeIncrement);
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
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-blue-300">
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md space-y-6"
    >
      <h2 className="text-2xl font-bold text-center text-blue-800">Create a New Game</h2>

      <div>
        <label className="block text-gray-700 font-medium mb-1">
          Minutes per side: <span className="font-bold text-blue-600">{time}</span>
        </label>
        <input
          type="range"
          min="1"
          max="30"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full accent-blue-600"
        />
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-1">
          Seconds increment: <span className="font-bold text-blue-600">{incrementTime}</span>
        </label>
        <input
          type="range"
          min="0"
          max="30"
          value={incrementTime}
          onChange={(e) => setIncrementTime(e.target.value)}
          className="w-full accent-blue-600"
        />
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-1">
          Play as:
        </label>
        <select
          value={playerColor}
          onChange={(e) => setPlayerColor(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="WHITE">White</option>
          <option value="BLACK">Black</option>
        </select>
      </div>

      <p className="text-sm text-gray-500">Your player ID: <span className="text-black font-medium">{player1Id || "Loading..."}</span></p>

      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
      >
        Create Game
      </button>
    </form>
  </div>
);

}

export default CreateGameForm; // Export the capitalized component