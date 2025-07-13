import { Chess } from 'chess.js';
import { useState, useRef, useCallback, useEffect} from 'react';
import { getGameById, makeMove as apiMakeMove } from '../api/chessApi';

const useGame = (gameId) => {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [pgnMoves, setPgnMoves] = useState("");

  const chessRef = useRef(new Chess());

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameData = await getGameById(gameId);
        setGame(gameData);
        setFen(gameData.fenPosition);
        setPgnMoves(gameData.pgnMoves || "");
        chessRef.current.load(gameData.fenPosition);
      } catch (err) {
        setError("Failed to load game.");
        console.error("Error fetching game:", err);
      } finally {
        setLoading(false);
      }
    };
    if (gameId) fetchGame();
  }, [gameId]);

  const makeMove = useCallback(
    async ({ from, to, promotion = 'q' }, playerId) => {
      const move = { from, to, promotion };
      const moveResult = chessRef.current.move(move); // gets { san, lan, etc. }

      if (!moveResult) {
        console.warn("Illegal move attempted:", move);
        return false;
      }

      try {
        const response = await apiMakeMove(gameId, {
          san: moveResult.san,
          uci: `${from}${to}`,
          playerId,
        });

        setGame((prevGame) => ({
          ...prevGame,
          fenPosition: response.fenPosition,
          pgnMoves: response.pgnMoves,
          currentTurn: response.currentTurn,
          moves: [...(prevGame.moves || []), response],
        }));

        setFen(response.fenPosition);
        setPgnMoves(response.pgnMoves);
        return true;
      } catch (err) {
        console.error("Error making move:", err);
        setError("Failed to make move. Please try again.");
        return false;
      }
    },
    [gameId]
  );

  return { game, fen, pgnMoves, loading, error, makeMove, setGame };
};

export default useGame;
