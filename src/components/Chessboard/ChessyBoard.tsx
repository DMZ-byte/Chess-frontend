// src/components/Chessboard/ChessyBoard.tsx

import React, { useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';

import { Chessboard, SquareHandlerArgs } from '../../chessStuff';

const ChessyBoard = () => {
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});

  function makeRandomMove() {
    if (chessGame.isGameOver()) return;

    const possibleMoves = chessGame.moves();
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    chessGame.move(randomMove);
    setChessPosition(chessGame.fen());
  }

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
    if (!moveFrom && piece) {
      if (getMoveOptions(square as Square)) {
        setMoveFrom(square);
      
      }
      return;
    }

    const moves = chessGame.moves({
      square: moveFrom as Square,
      verbose: true,
    });

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
    } catch {
      if (getMoveOptions(square as Square)) {
        setMoveFrom(square);
      }
      return;
    }

    setChessPosition(chessGame.fen());
    setTimeout(makeRandomMove, 300);
    setMoveFrom('');
    setOptionSquares({});
  }
  const chessboardOptions = {
      allowDragging: false,
      onSquareClick,
      position: chessPosition,
      squareStyles: optionSquares,
      id: 'click-to-move',
    };

  return (
    <Chessboard options={chessboardOptions} />
  );
};

export default ChessyBoard;
