import { useState, useEffect, useCallback,useRef } from 'react';
import { getGameById, makeMove as apiMakeMove } from '../api/chessApi';

const useGame = (gameId) => {
  const stompClientInstance = useRef(null);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [pgnMoves, setPgnMoves] = useState("");

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameData = await getGameById(gameId);
        setGame(gameData);
        setFen(gameData.fenPosition);
        setPgnMoves(gameData.pgnMoves || "");
      } catch (err) {
        setError("Failed to load game.");
        console.error("Error fetching game:", err);
      } finally {
        setLoading(false);
      }
    };
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const makeMove = useCallback(async (sanMove, playerId) => {
    try {
      const response = await apiMakeMove(gameId, { san: sanMove, playerId });
      setGame(prevGame => ({
        ...prevGame,
        fenPosition: response.fenPosition,
        pgnMoves: response.pgnMoves,
        currentTurn: response.currentTurn,
        moves: [...(prevGame.moves || []), response] // Assuming backend returns the new move to append
      }));
      setFen(response.fenPosition);
      setPgnMoves(response.pgnMoves);
      return true; // Indicate success
    } catch (err) {
      console.error("Error making move:", err);
      setError("Failed to make move. Please try again.");
      return false; // Indicate failure
    }
  }, [gameId]);

  return { game, fen, pgnMoves, loading, error, makeMove, setGame };
};

export default useGame;