import axios from 'axios';
const API_BASE_URL = 'http://localhost:8080/api'; // Adjust if your backend port is different

export const getAllGames = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/games`);
    return response.data;
  } catch (error) {
    console.error("Error fetching all games:", error);
    throw error;
  }
};

export const getGameById = async (gameId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/games/${gameId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching game ${gameId}:`, error);
    throw error;
  }
};

export const makeMove = async (gameId, moveRequest) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/games/${gameId}/moves`, moveRequest);
    return response.data; // The backend should return the updated move object/game state
  } catch (error) {
    console.error(`Error making move in game ${gameId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
};