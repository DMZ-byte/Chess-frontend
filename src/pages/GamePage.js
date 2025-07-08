// src/pages/GamePage.js (with useGame hook)
import React from 'react';
import { useParams } from 'react-router-dom';
import useGame from '../hooks/useGame'; // Import the custom hook
import Chessboard from '../components/Chessboard/ChessBoard';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';

function GamePage() {
  const { gameId } = useParams();
  const { game, fen, pgnMoves, loading, error, makeMove } = useGame(gameId);

  const handleChessboardMove = async (sourceSquare, targetSquare, piece) => {
    // This is where you'd use chess.js to derive the SAN move from source/target/piece
    // For simplicity, let's assume 'e2e4' for now.
    // In a real app, you'd get the current board from `fen`, use chess.js to validate
    // the move (sourceSquare, targetSquare, piece for promotion), and get the SAN.

    // Example with chess.js (assuming it's imported and initialized in Chessboard.js or a helper)
    // const gameInstance = new Chess(fen);
    // const move = gameInstance.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    // if (move) {
    //   const san = move.san; // This is the SAN
    //   const currentPlayerId = game.currentTurn === 'WHITE' ? game.whitePlayerId : game.blackPlayerId;
    //   await makeMove(san, currentPlayerId);
    // } else {
    //   console.warn("Invalid move attempted on chessboard.");
    // }

    // Placeholder for actual SAN derivation
    const sanMove = `${sourceSquare}${targetSquare}`; // This is not proper SAN
    const currentPlayerId = game.currentTurn === 'WHITE' ? game.whitePlayer.id : game.blackPlayer.id; // Use actual player ID from game object
    await makeMove(sanMove, currentPlayerId);
  };
  console.log(<Chessboard options={chessboardOptions} />);
  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  return (
    <div className={styles.gamePageContainer}>
      <h1>Game #{game.id}</h1>
      <p>White: {game.whitePlayer.username} | Black: {game.blackPlayer.username}</p>
      <p>Current Turn: {game.currentTurn}</p>
      <div className={styles.gameContent}>
        <div className={styles.chessboardWrapper}>
          <Chessboard
            position={fen}
            onDrop={handleChessboardMove}
          />
        </div>
        <div className={styles.gameInfo}>
          <MoveHistory moves={game.moves} />
          {/* Other game info like time remaining, status */}
        </div>
      </div>
    </div>
  );
}

export default GamePage;