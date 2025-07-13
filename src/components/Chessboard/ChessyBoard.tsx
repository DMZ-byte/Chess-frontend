import React, { useEffect, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import {ChessboardOptions} from 'react-chessboard'
import { useParams } from 'react-router-dom';
import { Chessboard, SquareHandlerArgs } from '../../chessStuff';
import * as api from '../../api/api'

// Assign `any` type to individual functions
const fetchUserId: any = api.fetchUserId;
const sendMove: any = api.sendMove;
const subscribeToGameTopic: any = api.subscribeToGameTopic;
const getGameById: any = api.getGameById;
const ChessyBoard = () => {
  const { gameId } = useParams();
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [userId, setUserId] = useState(null);
  const [playerColor, setPlayerColor] = useState('w');
  const [isMyTurn, setIsMyTurn] = useState(true);

  useEffect(() => {
    const init = async () => {
      const fetchedUserId = await fetchUserId();
      setUserId(fetchedUserId);

      const game = await getGameById(gameId);
      const isWhite = game.whitePlayerId === fetchedUserId;
      setPlayerColor(isWhite ? 'w' : 'b');

      // Determine turn from FEN
      setIsMyTurn((isWhite && chessGame.turn() === 'w') || (!isWhite && chessGame.turn() === 'b'));

      subscribeToGameTopic(gameId, (updatedGame: any) => {
        const latestMove = updatedGame.moves[updatedGame.moves.length - 1];
        if (latestMove) {
          chessGame.move(latestMove.san);
          setChessPosition(chessGame.fen());
          setIsMyTurn(latestMove.playerId !== fetchedUserId);
        }
      });
    };
    init();
  }, [gameId]);

  function getMoveOptions(square: Square) {
    const moves = chessGame.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const newSquares: Record<string, React.CSSProperties> = {};
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          chessGame.get(move.to)?.color !== chessGame.get(square)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    }
    newSquares[square] = { background: 'rgba(255, 255, 0, 0.4)' };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!isMyTurn) return;

    if (!moveFrom && piece) {
      if (getMoveOptions(square as Square)) {
        setMoveFrom(square);
      }
      return;
    }

    const moves = chessGame.moves({ square: moveFrom as Square, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);
    if (!foundMove) {
      if (getMoveOptions(square as Square)) {
        setMoveFrom(square);
      } else {
        setMoveFrom('');
      }
      return;
    }

    try {
      chessGame.move({ from: moveFrom, to: square, promotion: 'q' });
      setChessPosition(chessGame.fen());
      sendMove(gameId, { from: moveFrom, to: square, san: foundMove.san, playerId: userId });
      setIsMyTurn(false);
    } catch (e) {
      console.warn('Invalid move:', e);
    }

    setMoveFrom('');
    setOptionSquares({});
  }

  const chessboardOptions: ChessboardOptions = {
    id: 'click-to-move',
    position: chessPosition,
    onSquareClick,
    squareStyles: optionSquares,
    boardOrientation: playerColor === 'w' ? 'white' : 'black',
  };

  return <Chessboard options={chessboardOptions} />;
};

export default ChessyBoard;
