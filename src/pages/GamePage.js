import React, { useState, useEffect, useCallback, useContext } from 'react'; 
import { useParams } from 'react-router-dom';
import Chessboard from '../components/Chessboard/ChessyBoard';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';
import * as api from '../api/api';
import { AuthContext } from '../App';

function GamePage() {
  const { gameId } = useParams();
  const { user } = useContext(AuthContext);
  const [game, setGame] = useState(null);
  const [gameMoves, setGameMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // inside GamePage()
  


  const fetchGameMoves = useCallback(async () => {
    try {
      const moves = await api.getGameMoves(gameId);
      setGameMoves(moves);
    } catch (err) {
      console.error("Failed to fetch moves:", err);
    }
  }, [gameId]);
  const handleMoveMade = useCallback(async () => {
    try {
    const updatedGame = await api.getGameById(gameId);
    setGame(updatedGame);
    fetchGameMoves();     
  } catch (err) {
    console.error("Failed to update game after move:", err);
  }
  }, [gameId,fetchGameMoves]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        const gameData = await api.getGameById(gameId);

        const userId = await api.fetchUserId();
        console.log("user id is: " + userId);
        if((gameData.whitePlayer == null || gameData.blackPlayer == null) && (userId != gameData.whitePlayer?.id && userId != gameData.blackPlayer?.id)){
          console.log("We are about to make a join game request to " + gameId + " with userid " + userId);
          const success = await api.joinGame(gameId,userId);
        } 
        setGame(gameData);
      } catch (err) {
        setError("Failed to load game: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
    fetchGameMoves();
  }, [gameId, fetchGameMoves]);

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  return (
    <div className={styles.gamePageContainer}>
      <h1>Game #{game.id}</h1>
      <p>White: {game.whitePlayer?.username || 'N/A'} | Black: {game.blackPlayer?.username || 'N/A'}</p>
      <p>Current Turn: {game.currentTurn === 'WHITE' ? '♙ White' : '♟ Black'}</p>
      <div className={styles.gameContent}>
        <div className={styles.chessboardWrapper}>
          {(game.blackPlayer && game.whitePlayer) ? (
            <Chessboard onMoveMade={handleMoveMade} />
          ) : (
            <p>Both players need to be joined.</p>
          )}
        </div>
        <div className={styles.gameInfo}>
          <MoveHistory moves={gameMoves} />
        </div>
      </div>
    </div>
  );
}

export default GamePage;
