import React from 'react';
import { Chessboard as ReactChessboard } from "react-chessboard";
import { Chess } from 'chess.js'; // A client-side chess library for move validation and SAN generation

function Chessboard({ position, onDrop }) {
  const chess = new Chess(position); // Initialize with the current FEN

  const onPieceDrop = (sourceSquare, targetSquare, piece) => {
    let move = null;
    try {
      // Attempt to make the move on the client-side board
      move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Simplistic: always promote to queen for now, you'll need a UI for this
      });
    } catch (e) {
      console.log("Invalid move on client-side:", e);
      return false; // Reject the move if invalid on client-side
    }

    if (move === null) return false; // Invalid move

    // If the move is valid on the client-side, we pass relevant info to the parent
    // The parent (GamePage) will then call the backend.
    onDrop(sourceSquare, targetSquare, piece);

    return true; // Indicate that the client-side move was successful (for react-chessboard to update its internal state)
  };

  return (
    <ReactChessboard
      position={position}
      onPieceDrop={onPieceDrop}
      // Add other props like boardOrientation, customSquareStyles, etc.
    />
  );
}

export default Chessboard;