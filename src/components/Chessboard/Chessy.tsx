// src/components/Chessboard/Chessy.tsx

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
// Import Square, Piece, and Move types directly from chess.js
import { Chess, Square, Piece, Move } from 'chess.js';
import type { CSSProperties } from 'react'; // Explicitly import CSSProperties from react

// Define CustomSquareStyles as it's not directly exported by react-chessboard
// It should be a partial record, as not all squares will always have styles.
type CustomSquareStyles = Partial<Record<Square, CSSProperties>>;

// Define types for the props this component will receive
interface ChessyProps {
  initialFen: string;
  onMoveMade: (moveInfo: {
    from: string;
    to: string;
    fen: string;
    pgn: string;
    isGameOver: boolean;
    isCheckmate: boolean;
    isDraw: boolean;
    isStalemate: boolean;
    isThreefoldRepetition: boolean;
    isInsufficientMaterial: boolean;
  }) => void;
  boardOrientation?: 'white' | 'black'; // Optional prop for board orientation
}

// Define the Chessy functional component
const Chessy = ({ initialFen, onMoveMade, boardOrientation = 'white' }: ChessyProps) => {
  // useRef to hold the chess.js game instance. This ensures the instance persists
  // across renders without being recreated, which is crucial for maintaining game state.
  // We initialize it with the provided initialFen or a standard starting FEN.
  const chessGameRef = useRef(new Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  const chessGame = chessGameRef.current; // Access the current Chess.js instance
  const [allowDragging, setAllowDragging] = useState(true);

  // useState to manage the current FEN string displayed on the chessboard.
  // This state is updated after each successful move to trigger a re-render of the board.
  const [chessPosition, setChessPosition] = useState(chessGame.fen()); // Removed explicit <string> type argument

  // useState to track the 'from' square for click-to-move functionality.
  // It stores the square from which a piece is selected.
  const [moveFrom, setMoveFrom] = useState<Square | ''>(''); // Kept type here for union type inference clarity

  // useState to store custom CSS styles for squares, primarily used for highlighting
  // valid move destinations and the selected 'from' square.
  const [optionSquares, setOptionSquares] = useState<CustomSquareStyles>({}); // Kept type here for custom type clarity

  // useEffect hook to synchronize the internal chess.js state with the `initialFen` prop.
  // This is important if the `initialFen` can change from the parent component (e.g., loading a new game).
  useEffect(() => {
    // Only load if the FEN from props is different from the current game state
    if (initialFen && chessGame.fen() !== initialFen) {
      chessGame.load(initialFen); // Load the new FEN into the chess.js instance
      setChessPosition(initialFen); // Update the local FEN state
      setMoveFrom(''); // Clear any pending click-to-move state
      setOptionSquares({}); // Clear any highlighted squares
    }
  }, [initialFen, chessGame]); // Dependencies: `initialFen` and `chessGame` (the ref's current value)

  /**
   * Calculates and sets the CSS for highlighting possible moves for a given square.
   * This function is memoized with `useCallback` to prevent unnecessary re-creations.
   * @param {Square} square - The square (e.g., 'e2') to get move options for.
   * @returns {boolean} - True if there are move options, false otherwise.
   */
  const getMoveOptions = useCallback((square: Square): boolean => {
    // Get all possible moves for the piece on the given square in verbose format
    const moves: Move[] = chessGame.moves({ // Use Move type from chess.js
      square: square,
      verbose: true,
    });

    // If no moves are possible from this square, clear any existing highlights
    // and return false, indicating no options.
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    // Create an object to store CSS properties for squares that are valid move destinations.
    const newSquares: CustomSquareStyles = {}; // Now correctly typed as Partial<Record<Square, CSSProperties>>

    for (const move of moves) {
      // Determine the background style: a larger circle for captures, smaller for simple moves.
      // chessGame.get() returns Piece | null, so the type assertion is not strictly needed if chess.js types are correct.
      // However, if your specific chess.js types return Piece | undefined, this will handle it.
      const targetPiece = chessGame.get(move.to) as Piece | null | undefined;
      const sourcePiece = chessGame.get(square) as Piece | null | undefined;

      newSquares[move.to] = {
        background:
          targetPiece && targetPiece.color !== sourcePiece?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    }

    // Highlight the initially clicked 'from' square in yellow.
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };

    setOptionSquares(newSquares); // Update state to apply these highlights to the board
    return true; // Indicate that move options were found
  }, [chessGame]); // Dependency: `chessGame` instance

  /**
   * Handles a click event on a chessboard square. This function implements the
   * "click-to-move" logic: first click selects a piece, second click attempts a move.
   * This function is memoized with `useCallback`.
   * @param {object} args - Object containing 'square' (string) and 'piece' (object or null).
   */
  const onSquareClick = useCallback(({ square, piece }: { square: Square; piece: Piece | null }): void => { // Use Square, Piece from chess.js
    console.log("onSquareClick triggered in Chessy:", { square, piece }); // Debug log

    // Scenario 1: No piece is currently selected (`moveFrom` is empty)
    // and the user clicked on a square that contains a piece.
    if (!moveFrom && piece) {
      const hasMoveOptions = getMoveOptions(square); // Get and display move options for this piece
      if (hasMoveOptions) {
        setMoveFrom(square); // Set this square as the origin for the next move
      }
      return; // Exit early
    }

    // Scenario 2: A piece is already selected (`moveFrom` is set),
    // and the user clicked on a potential destination square.
    // IMPORTANT: Only try to get moves if moveFrom is a valid square string
    if (!moveFrom) {
        // This case should ideally not be reached if logic is perfect,
        // but as a safeguard, if moveFrom is empty, clear and return.
        setOptionSquares({});
        return;
    }

    const moves: Move[] = chessGame.moves({ // Use Move type from chess.js
      square: moveFrom, // Now guaranteed to be a Square due to the check above
      verbose: true,
    });

    // Find if the clicked `square` is a valid destination for the selected piece (`moveFrom`).
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    // Scenario 2a: The clicked `square` is NOT a valid move for the selected piece.
    if (!foundMove) {
      // Check if the newly clicked `square` itself contains a piece with valid moves.
      const hasMoveOptions = getMoveOptions(square);
      // If it does, set this new square as the `moveFrom` (user is selecting a new piece).
      // Otherwise, clear `moveFrom` (user clicked an empty or invalid square, deselecting).
      setMoveFrom(hasMoveOptions ? square : '');
      setOptionSquares({}); // Clear any previous highlights
      return; // Exit early
    }

    // Scenario 2b: The clicked `square` IS a valid move for the selected piece.
    // Attempt to make the move using `chess.js`.
    try {
      // `promotion: 'q'` defaults pawn promotion to a queen for simplicity.
      // In a full game, you'd implement a UI for promotion choice.
      const result = chessGame.move({
        from: moveFrom,
        to: square,
        promotion: 'q',
      });

      if (result) {
        // If the move was legal and successful, update the board position.
        setChessPosition(chessGame.fen());

        // Call the `onMoveMade` prop to notify the parent component (GamePage)
        // about the successful move and updated game state.
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
            isInsufficientMaterial: chessGame.isInsufficientMaterial(),
          });
        }
      }
    } catch (e) {
      // Catch any errors from `chess.js` (e.g., if a move is somehow illegal despite checks).
      console.error("Illegal move attempt (onSquareClick):", e);
      // Reset the selection and highlights.
      setMoveFrom('');
      setOptionSquares({});
      return; // Exit early
    }

    // After a successful move (or failed attempt), clear the temporary state for the next move.
    setMoveFrom('');
    setOptionSquares({});
  }, [moveFrom, chessGame, getMoveOptions, onMoveMade]); // Dependencies for useCallback

  /**
   * Handles a piece being dropped on a square after being dragged.
   * This function is memoized with `useCallback`.
   * @param {Square} sourceSquare - The square the piece was dragged from.
   * @param {Square} targetSquare - The square the piece was dropped on.
   * @param {Piece} piece - The piece that was dragged.
   * @returns {boolean} - True if the move was legal and should be applied visually, false otherwise (piece snaps back).
   */
  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square, piece: Piece): boolean => { // Use Square, Piece from chess.js
    console.log("onDrop triggered in Chessy:", { sourceSquare, targetSquare, piece }); // Debug log

    try {
      // Attempt to make the move using `chess.js`.
      const result = chessGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Default promotion to queen
      });

      if (result) {
        // If the move was legal, update the board position.
        setChessPosition(chessGame.fen());

        // Notify the parent component about the successful move.
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
            isInsufficientMaterial: chessGame.isInsufficientMaterial(),
          });
        }
        return true; // Indicate to `react-chessboard` that the piece should stay on the new square
      } else {
        return false; // Indicate to `react-chessboard` that the move was illegal, piece snaps back
      }
    } catch (e) {
      console.error("Illegal move attempt (onDrop):", e);
      return false; // Indicate illegal move
    }
  }, [chessGame, onMoveMade]); // Dependencies for useCallback

  // Define the props for the Chessboard component from `react-chessboard`
  const chessboardProps = {
    position: chessPosition, // Current FEN string from state
    boardOrientation: boardOrientation, // Use the prop for orientation
    onSquareClick: onSquareClick, // Handler for click-to-move
    onPieceDrop: onDrop, // Handler for drag-and-drop (this also enables dragging)
    customSquareStyles: optionSquares, // Styles for highlighting valid moves
    id: 'chess-board-game', // Unique ID for the board
    animationDuration: 200, // Smooth piece movement
    showBoardNotation: true, // Display algebraic notation on the board
  };
  const chessboardOptions = {
      allowDragging,
      id: 'allow-dragging'
    };

  // Render the Chessboard and game status
  return (
    <div style={{ maxWidth: '600px', margin: 'auto' }}>
      <Chessboard options={chessboardOptions} />
      <h2 className="text-xl mt-4 text-center text-gray-200">
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
      <div className="flex justify-center mt-4">
        <button
          onClick={() => {
            chessGame.reset(); // Reset chess.js game state
            setChessPosition(chessGame.fen()); // Update board to initial FEN
            setMoveFrom(''); // Clear selected piece
            setOptionSquares({}); // Clear highlights
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
        >
          Reset Game
        </button>
      </div>
    </div>
  );
};

export default Chessy;
