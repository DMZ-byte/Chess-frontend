import React, { useRef, useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js'; // Make sure to import Chess from chess.js

function ChessBoardComponent({ initialFen, onMoveMade }) {
  // Use useRef to maintain the Chess.js game instance across renders
  const chessGameRef = useRef(new Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  const chessGame = chessGameRef.current; // Get the current game instance

  // State to track the current position of the chessboard (FEN string)
  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  // State to track the square a piece is picked up from
  const [moveFrom, setMoveFrom] = useState('');
  // State to store styles for valid move options (dots/circles)
  const [optionSquares, setOptionSquares] = useState({});

  // Use useEffect to update the board if initialFen changes (e.g., loading a new game)
  useEffect(() => {
    if (initialFen && chessGame.fen() !== initialFen) {
      chessGame.load(initialFen);
      setChessPosition(chessGame.fen());
    }
  }, [initialFen]); // Depend on initialFen

  // Function to get the valid move options for a given square
  function getMoveOptions(square) {
    // Get all possible moves for the piece on the given square
    const moves = chessGame.moves({
      square,
      verbose: true // Get verbose move objects for 'from', 'to', 'color', etc.
    });

    // If no moves are possible from this square, clear option squares and return false
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    // Create an object to store CSS properties for valid move squares
    const newSquares = {};

    for (const move of moves) {
      // Determine background style based on whether it's a capture or a simple move
      newSquares[move.to] = {
        background:
          chessGame.get(move.to) &&
          chessGame.get(move.to).color !== chessGame.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' // Larger circle for capture
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)', // Smaller circle for move
        borderRadius: '50%' // Make it a circle
      };
    }

    // Highlight the clicked square in yellow
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };

    setOptionSquares(newSquares); // Update state to show move options
    return true; // Indicate that there are valid move options
  }

  // Handle a square click event
  function onSquareClick(square) {
    console.log("squareclicked");
    // If no piece has been picked up yet (moveFrom is empty)
    if (!moveFrom) {
      const piece = chessGame.get(square); // Get the piece on the clicked square

      // If a piece exists on the clicked square, get its move options
      if (piece) {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) {
          setMoveFrom(square); // Set this square as the origin of the move
        }
      }
      return; // Exit early
    }

    // If a piece has been picked up (moveFrom is set), this click is for the destination square
    const moves = chessGame.moves({
      square: moveFrom,
      verbose: true
    });

    // Find if the clicked 'to' square is a valid move from 'moveFrom'
    const foundMove = moves.find(m => m.from === moveFrom && m.to === square);

    // If it's not a valid move (e.g., clicked on an invalid square, or clicked on a new piece)
    if (!foundMove) {
      // Try to get move options for the newly clicked square
      const hasMoveOptions = getMoveOptions(square);
      // If the new square has move options, set it as the new moveFrom; otherwise, clear moveFrom
      setMoveFrom(hasMoveOptions ? square : '');
      return; // Exit early
    }

    // It's a valid move, attempt to make the move
    try {
      // The `promotion: 'q'` promotes to queen by default for simplicity.
      // In a real game, you'd prompt the user for promotion choice.
      const result = chessGame.move({
        from: moveFrom,
        to: square,
        promotion: 'q'
      });

      if (result) { // Check if the move was legal and successful
        setChessPosition(chessGame.fen()); // Update the board position

        // Call the parent's onMoveMade callback
        if (onMoveMade) {
          onMoveMade({
            from: moveFrom,
            to: square,
            fen: chessGame.fen(),
            pgn: chessGame.pgn(),
            isGameOver: chessGame.isGameOver(),
            isCheckmate: chessGame.isCheckmate(),
            isDraw: chessGame.isDraw(),
            isStalemate: chessGame.isStalemate(),
            isThreefoldRepetition: chessGame.isThreefoldRepetition(),
            isInsufficientMaterial: chessGame.isInsufficientMaterial()
          });
        }
      }
    } catch (e) {
      console.error("Illegal move attempt:", e);
      // If the move failed (e.g., `chess.js` rejected it for some reason not caught by `moves()`)
      // Clear moveFrom and optionSquares or give feedback.
      setMoveFrom('');
      setOptionSquares({});
      return; // Exit early
    }

    // After a successful move, clear temporary states
    setMoveFrom('');
    setOptionSquares({});
  }

  // Handle piece drop (draggable functionality)
  function onDrop(sourceSquare, targetSquare, piece) {
    console.log("piece drop");
    try {
      // Attempt to make the move
      const result = chessGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // default promotion to queen
      });

      if (result) { // If the move was legal
        setChessPosition(chessGame.fen()); // Update the board position

        // Call the parent's onMoveMade callback
        if (onMoveMade) {
          onMoveMade({
            from: sourceSquare,
            to: targetSquare,
            fen: chessGame.fen(),
            pgn: chessGame.pgn(),
            isGameOver: chessGame.isGameOver(),
            isCheckmate: chessGame.isCheckmate(),
            isDraw: chessGame.isDraw(),
            isStalemate: chessGame.isStalemate(),
            isThreefoldRepetition: chessGame.isThreefoldRepetition(),
            isInsufficientMaterial: chessGame.isInsufficientMaterial()
          });
        }
        return true; // Indicate successful move to react-chessboard
      } else {
        return false; // Indicate illegal move
      }
    } catch (e) {
      console.error("Illegal move attempt (onDrop):", e);
      return false; // Indicate illegal move
    }
  }


  // Define the options for the Chessboard component
  const chessboardProps = {
    position: chessPosition, // Current FEN string
    boardOrientation: 'white', // Or 'black' depending on player's side
    // onSquareClick expects a `square` string argument
    onSquareClick: onSquareClick,
    // onPieceDrop expects sourceSquare, targetSquare, and piece arguments
    onPieceDrop: onDrop, // Enable dragging and dropping
    customSquareStyles: optionSquares, // Apply styles for valid move options
    id: 'chess-board-game', // Unique ID for the board
    animationDuration: 200, // Smooth piece movement
  };

  // Render the Chessboard
  return (
    <div style={{ maxWidth: '600px', margin: 'auto' }}>
      <Chessboard {...chessboardProps} />
      {/* You can add game status here */}
      <h2 className="text-xl mt-4">
        {chessGame.isGameOver()
          ? chessGame.isCheckmate()
            ? 'Checkmate!'
            : chessGame.isStalemate()
              ? 'Stalemate!'
              : chessGame.isDraw()
                ? 'Draw!'
                : 'Game Over!'
          : `Turn: ${chessGame.turn() === 'w' ? 'White' : 'Black'}`}
      </h2>
      <button
        onClick={() => {
          chessGame.reset();
          setChessPosition(chessGame.fen());
          setMoveFrom('');
          setOptionSquares({});
        }}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Reset Game
      </button>
    </div>
  );
}

export default ChessBoardComponent;