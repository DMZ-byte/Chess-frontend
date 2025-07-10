// src/pages/GamePage.js

import React from 'react'; // No need for useRef, useState, useEffect, useCallback here for board logic
import { useParams } from 'react-router-dom';
import useGame from '../hooks/useGame';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';
import { ClickToMove } from '../stories/ClickToMove.stories';
import ChessyBoard from '../components/Chessboard/ChessyBoard';
function GamePage() {
  const { gameId } = useParams();
  // makeMove from useGame hook is crucial for sending moves to backend
  const { game, fen, pgnMoves, loading, error, makeMove } = useGame(gameId);

  // This function will be called by Chessy.tsx when a move is successfully made on the board
  const handleMoveMadeOnBoard = ({ from, to, fen: newFen, pgn }) => {
    console.log("Move successfully made on the board by Chessy.tsx:", { from, to, newFen, pgn });

    // Determine the current player's ID to send with the move to the backend
    // This logic should align with how your backend determines whose turn it is
    // and which player ID corresponds to that turn.
    const currentPlayerId = game?.currentTurn === 'WHITE' ? game?.whitePlayer?.id : game?.blackPlayer?.id;

    // IMPORTANT: Convert 'from' and 'to' to the format your backend's makeMove expects.
    // The `chess.js` library provides SAN (Standard Algebraic Notation) in the `pgn` string.
    // If your backend `makeMove` expects SAN, you'll need to parse it from `pgn`.
    // For now, using a simplified 'from-to' notation as you had.
    const sanMove = `${from}${to}`; // Example: "e2e4". Verify if your backend expects this or actual SAN ("e4").

    if (currentPlayerId) {
      makeMove(sanMove, currentPlayerId); // Call the backend API to register the move
    }
  };

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  return (
    <div className={styles.gamePageContainer}>
      <h1>Game #{game.id}</h1>
      <p>White: {game.whitePlayer?.username || 'N/A'} | Black: {game.blackPlayer?.username || 'N/A'}</p>
      <p>Current Turn: {game.currentTurn}</p>
      <div className={styles.gameContent}>
        <div className={styles.chessboardWrapper}>
        <ChessyBoard />
        </div>
        <div className={styles.gameInfo}>
          <MoveHistory moves={pgnMoves} />
          {/* Other game info like time remaining, status */}
        </div>
      </div>
    </div>
  );
}

export default GamePage;