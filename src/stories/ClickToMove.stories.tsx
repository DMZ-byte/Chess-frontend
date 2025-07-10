import type { Meta, StoryObj } from '@storybook/react';
import { Chess, Square } from 'chess.js';
import { useState, useRef, useCallback } from 'react';
import { Chessboard, SquareHandlerArgs } from '../chessStuff';
import defaultMeta from './Default.stories';


const meta: Meta<typeof Chessboard> = {
  ...defaultMeta,
  title: 'stories/ClickToMove',
} satisfies Meta<typeof Chessboard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Define a React component for the ClickToMove logic
const ClickToMoveComponent: React.FC = () => {
  // Create a chess game using a ref to maintain game state across renders
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  // Track the current position of the chess game in state to trigger re-renders
  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});

  // Make a random "CPU" move
  const makeRandomMove = useCallback(() => {
    const possibleMoves = chessGame.moves();
    if (chessGame.isGameOver()) {
      return;
    }
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    chessGame.move(randomMove);
    setChessPosition(chessGame.fen());
  }, [chessGame]);

  // Get move options for a square to show valid moves
  const getMoveOptions = useCallback(
    (square: Square) => {
      const moves = chessGame.moves({
        square,
        verbose: true,
      });

      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares: Record<string, React.CSSProperties> = {};
      for (const move of moves) {
        newSquares[move.to] = {
          background:
            chessGame.get(move.to) &&
            chessGame.get(move.to)?.color !== chessGame.get(square)?.color
              ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
              : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      }

      newSquares[square] = {
        background: 'rgba(255, 255, 0, 0.4)',
      };

      setOptionSquares(newSquares);
      return true;
    },
    [chessGame],
  );

  // Handle square clicks
  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (!moveFrom && piece) {
        const hasMoveOptions = getMoveOptions(square as Square);
        if (hasMoveOptions) {
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
        const hasMoveOptions = getMoveOptions(square as Square);
        setMoveFrom(hasMoveOptions ? square : '');
        return;
      }

      try {
        chessGame.move({
          from: moveFrom,
          to: square,
          promotion: 'q',
        });
        setChessPosition(chessGame.fen());
        setTimeout(makeRandomMove, 300);
        setMoveFrom('');
        setOptionSquares({});
      } catch {
        const hasMoveOptions = getMoveOptions(square as Square);
        if (hasMoveOptions) {
          setMoveFrom(square);
        }
        return;
      }
    },
    [chessGame, moveFrom, getMoveOptions, makeRandomMove],
  );

  // Set the chessboard options
  const chessboardOptions = {
    allowDragging: false,
    onSquareClick,
    position: chessPosition,
    squareStyles: optionSquares,
    id: 'click-to-move',
  };

  return <Chessboard options={chessboardOptions} />;
};

// Define the Story
export const ClickToMove: Story = {
  render: () => <ClickToMoveComponent />,
};