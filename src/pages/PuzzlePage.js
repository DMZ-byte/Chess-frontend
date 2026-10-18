// src/pages/PuzzlePage.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from '../chessStuff';
import { fetchRandomPuzzle, submitPuzzleSolution, fetchUserId } from '../api/api';
import styles from './PuzzlePage.module.css';

// Turns "e2e4" / "e7e8q" into { from, to, promotion }.
function parseUci(uci) {
    if (!uci || uci.length < 4) return null;
    return {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    };
}

function PuzzlePage() {
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;

    const [userId, setUserId] = useState(null);
    const [puzzle, setPuzzle] = useState(null);
    const [solutionMoves, setSolutionMoves] = useState([]);
    const [moveIndex, setMoveIndex] = useState(0);
    const [chessPosition, setChessPosition] = useState('start');
    const [status, setStatus] = useState('idle'); // idle | solving | solved | failed
    const [moveFrom, setMoveFrom] = useState('');
    const [optionSquares, setOptionSquares] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [solvedCount, setSolvedCount] = useState(0);
    const [attemptCount, setAttemptCount] = useState(0);

    useEffect(() => {
        fetchUserId().then(setUserId).catch(() => setUserId(null));
    }, []);

    const loadPuzzle = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStatus('idle');
        setOptionSquares({});
        setMoveFrom('');
        try {
            const data = await fetchRandomPuzzle(userId);
            setPuzzle(data);
            chessGame.load(data.fen);
            setChessPosition(chessGame.fen());
            const moves = (data.solution || data.moves || '').split(' ').filter(Boolean);
            setSolutionMoves(moves);
            setMoveIndex(0);
            setStatus('solving');
        } catch (err) {
            setError('Could not load a puzzle right now. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [userId, chessGame]);

    useEffect(() => {
        loadPuzzle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const finishPuzzle = useCallback(async (success) => {
        setStatus(success ? 'solved' : 'failed');
        setAttemptCount((c) => c + 1);
        if (success) setSolvedCount((c) => c + 1);
        if (puzzle?.id) {
            try {
                await submitPuzzleSolution(puzzle.id, { userId, success });
            } catch (err) {
                console.warn('Could not record puzzle result:', err.message);
            }
        }
    }, [puzzle, userId]);

    function getMoveOptions(square) {
        const moves = chessGame.moves({ square, verbose: true });
        if (moves.length === 0) {
            setOptionSquares({});
            return false;
        }
        const newSquares = {};
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

    function onSquareClick({ square, piece }) {
        if (status !== 'solving') return;

        if (!moveFrom && piece) {
            if (getMoveOptions(square)) setMoveFrom(square);
            return;
        }

        const legalMoves = chessGame.moves({ square: moveFrom, verbose: true });
        const foundMove = legalMoves.find((m) => m.from === moveFrom && m.to === square);
        if (!foundMove) {
            if (getMoveOptions(square)) setMoveFrom(square);
            else setMoveFrom('');
            return;
        }

        const expected = parseUci(solutionMoves[moveIndex]);
        const isCorrect = expected && expected.from === moveFrom && expected.to === square;

        if (!isCorrect) {
            // Show the attempted (invalid for this puzzle) move being reverted, then fail.
            setMoveFrom('');
            setOptionSquares({});
            finishPuzzle(false);
            return;
        }

        try {
            chessGame.move({ from: moveFrom, to: square, promotion: expected.promotion || 'q' });
            setChessPosition(chessGame.fen());
            setMoveFrom('');
            setOptionSquares({});

            const nextIndex = moveIndex + 1;
            // The opponent's reply (if any) is played automatically from the solution.
            const opponentReply = parseUci(solutionMoves[nextIndex]);
            if (opponentReply) {
                setTimeout(() => {
                    try {
                        chessGame.move(opponentReply);
                        setChessPosition(chessGame.fen());
                        const afterReplyIndex = nextIndex + 1;
                        if (afterReplyIndex >= solutionMoves.length) {
                            finishPuzzle(true);
                        } else {
                            setMoveIndex(afterReplyIndex);
                        }
                    } catch (e) {
                        console.warn('Failed to play opponent reply:', e);
                    }
                }, 300);
            } else {
                finishPuzzle(true);
            }
        } catch (e) {
            console.warn('Invalid move attempted on puzzle board:', e);
        }
    }

    const chessboardOptions = {
        id: 'puzzle-board',
        position: chessPosition,
        onSquareClick,
        squareStyles: optionSquares,
        boardOrientation: puzzle?.sideToMove === 'BLACK' ? 'black' : 'white',
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <main className={styles.puzzlePageContainer}>
                <header className={styles.puzzleHeader}>
                    <h1 className={styles.title}>Puzzles</h1>
                    <p className={styles.subtitle}>Find the best move for the side to play.</p>
                    <div className={styles.scoreRow}>
                        <span className={styles.scoreBadge}>Solved: {solvedCount}</span>
                        <span className={styles.scoreBadge}>Attempts: {attemptCount}</span>
                    </div>
                </header>

                <section className={styles.boardSection}>
                    {loading ? (
                        <p className={styles.infoText}>Loading puzzle...</p>
                    ) : error ? (
                        <p className={styles.errorText}>{error}</p>
                    ) : (
                        <>
                            <div className={styles.boardWrapper}>
                                <Chessboard options={chessboardOptions} />
                            </div>

                            {status === 'solved' && (
                                <div className={`${styles.resultBanner} ${styles.success}`}>
                                    🎉 Puzzle solved!
                                </div>
                            )}
                            {status === 'failed' && (
                                <div className={`${styles.resultBanner} ${styles.failure}`}>
                                    ❌ Not quite — that wasn't the best move.
                                </div>
                            )}
                            {status === 'solving' && (
                                <p className={styles.infoText}>
                                    {puzzle?.sideToMove === 'BLACK' ? 'Black' : 'White'} to move
                                    {puzzle?.rating ? ` · Rating ${puzzle.rating}` : ''}
                                </p>
                            )}

                            <button type="button" className={styles.nextPuzzleBtn} onClick={loadPuzzle}>
                                Next Puzzle
                            </button>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}

export default PuzzlePage;
