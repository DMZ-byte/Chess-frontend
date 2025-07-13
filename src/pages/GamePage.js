// src/pages/GamePage.js (with useGame hook)
import React, { useState, useRef, useEffect, useCallback,useContext } from 'react'; // Added useRef, useEffect, useCallback
import { useParams } from 'react-router-dom';
import useGame from '../hooks/useGame'; // Import the custom hook
import Chessboard from '../components/Chessboard/ChessyBoard';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';
import * as api from '../api/api';
import { Chess } from 'chess.js'; // Assuming chess.js is installed and imported
import { AuthContext } from '../App';

function GamePage() {
  const { gameId } = useParams();
  const { fen, pgnMoves, makeMove } = useGame(gameId);
  const [game,setGame] = useState(null);
  const {user} = useContext(AuthContext);
  const [error,setError] = useState(null);
  const [loading,setLoading] = useState(true);
  const handleGameUpdate = useCallback((updatedGame) => {
    setGame(updatedGame);
  },[]);


  useEffect(() => {
    if(user?.id){
      api.connectWebSocket(
        user.id,
        () => {
          console.log("WebSocket reconnected for GamePage.");
          api.subscribeToGameUpdates(gameId,handleGameUpdate);
        },
        null,
        null,
        (err) => {
          console.error("GamePage: WebSocket error", err);
        }
      );
    }
    return () => {
      api.unsubscribeFromGameUpdates(gameId);
      api.disconnectWebSocket();
    };
  },[user?.id,gameId,handleGameUpdate]);


  useEffect(() => {
    const fetchAndSubscribe = async () => {
      try {
        setLoading(true);
        const initialGame = await api.getGameById(gameId);
        setGame(initialGame);
      }catch(err){
        setError("Failed to load game: "+err.message);
      } finally {
        setLoading(false)
      }
    };
    fetchAndSubscribe();
    return () => {
      api.unsubscribeFromGameUpdates(gameId);
    };
  },[gameId,handleGameUpdate]);




  const handleMoveMadeOnBoard = ({san,from,to}) => {
    if(!user || !game){
      console.warn("User or game data missing. Cannot send move.");
      return; 
    }
    const playerId = user.id;
    api.sendMove(game.id, {san,playerId});
  };

  const gameMoves = game?.moves || [];
  // Initialize Chess.js instance using useRef to persist it across renders
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  // State for the current chess position (FEN string)
  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  // State to track the square from which a piece is being moved
  const [moveFrom, setMoveFrom] = useState('');
  // State to store CSS properties for highlighting possible move squares
  const [optionSquares, setOptionSquares] = useState({});

  // Effect to update the chess.js instance and position when the 'fen' from useGame changes
  useEffect(() => {
    if (fen && chessGame.fen() !== fen) {
      chessGame.load(fen); // Load the FEN from the backend into the chess.js instance
      setChessPosition(fen); // Update local state
    }
  }, [fen, chessGame]); // Dependencies: fen from hook, and the chessGame instance

 const getMoveOptions = useCallback((square) => {
    const moves = chessGame.moves({
      square,
      verbose: true, // Get detailed move info (from, to, piece, etc.)
    });

    if (moves.length === 0) {
      setOptionSquares({}); // Clear highlights if no moves
      return false;
    }

    const newSquares = {};
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          chessGame.get(move.to) &&
          chessGame.get(move.to)?.color !== chessGame.get(square)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' // Larger circle for capturing
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)', // Smaller circle for moving
        borderRadius: '50%',
      };
    }
    // Highlight the selected 'from' square
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };
    setOptionSquares(newSquares); // Update state to apply highlights
    return true;
  }, [chessGame]); // Dependency: chessGame instance

 
  const onSquareClick = useCallback(({ square, piece }) => {
    // If no piece is currently selected (moveFrom is empty) and a piece is clicked
    if (!moveFrom && piece) {
      // Get possible moves for the clicked piece
      const hasMoveOptions = getMoveOptions(square);

      // If there are valid move options, set the clicked square as the 'from' square
      if (hasMoveOptions) {
        setMoveFrom(square);
      }
      return; // Exit early
    }

    // If a piece is already selected (moveFrom is set), try to make a move
    const moves = chessGame.moves({
      square: moveFrom, // Use the stored 'from' square
      verbose: true,
    });

    // Find if the clicked 'to' square is a valid destination for the selected piece
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    // If the clicked 'to' square is not a valid move for the selected piece
    if (!foundMove) {
      // Check if the new clicked square itself has move options (i.e., user clicked a new piece)
      const hasMoveOptions = getMoveOptions(square);

      // If it's a new piece, set it as 'moveFrom'; otherwise, clear 'moveFrom'
      setMoveFrom(hasMoveOptions ? square : '');
      setOptionSquares({}); // Clear any previous highlights
      return; // Exit early
    }

    // If a valid move is found, attempt to execute it
    try {
      chessGame.move({
        from: moveFrom,
        to: square,
        promotion: 'q', // Default to queen promotion for simplicity
      });
      // Update the local chess position (FEN) after a successful move
      setChessPosition(chessGame.fen());

      // After a human move, simulate a CPU move (for single-player testing)
      // setTimeout(makeRandomMove, 300); // makeRandomMove is not defined in this scope

      // Clear the 'from' square and option highlights after a move
      setMoveFrom('');
      setOptionSquares({});

      // Call the makeMove function from the useGame hook to send the move to the backend
      // You'll need to derive the SAN (Standard Algebraic Notation) here
      // For now, using a simplified representation.
      const sanMove = `${foundMove.from}${foundMove.to}`; // This is NOT proper SAN
      const currentPlayerId = game?.currentTurn === 'WHITE' ? game?.whitePlayer?.id : game?.blackPlayer?.id;
      if (currentPlayerId) {
        makeMove(sanMove, currentPlayerId);
      }


    } catch (error) {
      // If the move was invalid (e.g., due to race condition or unexpected state)
      console.error("Invalid move caught:", error);
      // Re-evaluate move options for the clicked square
      const hasMoveOptions = getMoveOptions(square);

      // If the new square has options, set it as 'moveFrom', otherwise clear
      if (hasMoveOptions) {
        setMoveFrom(square);
      } else {
        setMoveFrom('');
      }
      setOptionSquares({}); // Clear highlights
      return; // Exit early
    }
  }, [moveFrom, chessGame, getMoveOptions, makeMove, game]); // Dependencies for useCallback



  const chessboardOptions = {
    squareStyles: optionSquares, // Pass the calculated square styles
    onSquareClick: onSquareClick, // Pass the click handler
    // Other options like draggable, orientation, etc.
  };

  console.log(chessboardOptions);

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
          <Chessboard
            position={fen} // Use the fen from the useGame hook for the board position
            onSquareClick={onSquareClick} // Pass the click handler
            // onDrop={handleChessboardMove} // If you also want drag-and-drop
            customSquareStyles={optionSquares} // Pass custom styles for highlighting
            onPieceDrop={handleMoveMadeOnBoard}
          />
        </div>
        <div className={styles.gameInfo}>
          <MoveHistory moves={gameMoves} />
        </div>
      </div>
    </div>
  );
}

export default GamePage;