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
      if(!fetchedUserId) return; 
      setUserId(fetchedUserId);

        const game = await getGameById(gameId);
        chessGame.reset();
        game.pgnMoves.split(" ").forEach((move: string | { from: string; to: string; promotion?: string | undefined; } | null) => {
            try {
                chessGame.move(move); // UCI format supported
            } catch (e) {
                console.warn("Invalid UCI move:", move);
            }
        });

        setChessPosition(chessGame.fen());
      console.log("GAME WHITE PLAYER ID IS : "+ game.whitePlayer.id);
      const isWhite = game.whitePlayer.id === fetchedUserId;
      setPlayerColor(isWhite ? 'w' : 'b');

      // Determine turn from FEN
        setIsMyTurn(
            (isWhite && game.currentTurn === 'WHITE') ||
            (!isWhite && game.currentTurn === 'BLACK')
        );
        console.log("attempting to subscribe to topic");
        await api.connectWebSocket(
            fetchedUserId,
            () => {
                console.log("WebSocket connected for ChessyBoard.");

                // Safe to subscribe now
                subscribeToGameTopic(game.id, (updatedGame: any) => {
                    if (!updatedGame || typeof updatedGame.pgnMoves !== 'string') {
                        console.warn("Invalid game update received:", updatedGame);
                        return;
                    }

                    try {
                        // Load all moves from PGN
                        chessGame.reset();
                        chessGame.loadPgn(updatedGame.pgnMoves);
                        setChessPosition(chessGame.fen());

                        // Determine whose turn it is
                        const isWhite = updatedGame.whitePlayer.id === fetchedUserId;
                        setIsMyTurn(
                            (isWhite && updatedGame.currentTurn === 'WHITE') ||
                            (!isWhite && updatedGame.currentTurn === 'BLACK')
                        );
                        setMoveFrom('');
                        setOptionSquares({});
                    } catch (e) {
                        console.error("Failed to load game PGN:", e);
                    }
                });

            },
            null,
            null,
            (error: any) => console.error("WebSocket error:", error)
        );
      
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
      sendMove(gameId, { from: moveFrom, to: square, uci: `${moveFrom}${square}`, playerId: userId });
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
