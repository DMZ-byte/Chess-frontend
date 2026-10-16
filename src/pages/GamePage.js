import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Chessboard from '../components/Chessboard/ChessyBoard';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';
import * as api from '../api/api';
import { AuthContext } from '../App';

const TICK_MS = 100;          // how often the clocks repaint
const RESYNC_MS = 5000;       // safety-net refetch while a game is running
const FLAG_RETRY_MS = 1000;   // how often to ask the server to confirm a timeout

// Formats milliseconds as m:ss, switching to m:ss.t under 10 seconds.
function formatClock(ms) {
  if (ms === null || ms === undefined) return '--:--';
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  if (safe < 10000) {
    return `${minutes}:${seconds}.${Math.floor((safe % 1000) / 100)}`;
  }
  return `${minutes}:${seconds}`;
}

const clockStyles = {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '6px',
    border: '2px solid #374151',
    background: '#1f2937',
    color: '#d1d5db',
    fontVariantNumeric: 'tabular-nums',
    transition: 'border-color 150ms, background 150ms',
  },
  active: { borderColor: '#facc15', color: '#fff' },
  low: { borderColor: '#ef4444', background: '#3b1d1d', color: '#fecaca' },
  time: { fontSize: '1.6rem', fontWeight: 700 },
};

function PlayerClock({ player, color, ms, isActive }) {
  const isLow = ms !== null && ms < 30000;
  const style = {
    ...clockStyles.base,
    ...(isActive ? clockStyles.active : {}),
    ...(isActive && isLow ? clockStyles.low : {}),
  };
  const name = player?.nickname || player?.username || 'Waiting for player';
  return (
      <div style={style} aria-label={`${color.toLowerCase()} clock`}>
        <span>{color === 'WHITE' ? '♙' : '♟'} {name}</span>
        <span style={clockStyles.time}>{formatClock(ms)}</span>
      </div>
  );
}

function GamePage() {
  const { gameId } = useParams();
  const { user } = useContext(AuthContext);
  const [game, setGame] = useState(null);
  const [gameMoves, setGameMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Difference between the server's clock and this browser's clock (ms).
  const [serverOffset, setServerOffset] = useState(0);
  // Re-rendered every TICK_MS so the displayed clocks count down.
  const [now, setNow] = useState(Date.now());
  const lastFlagCheck = useRef(0);

  const applyGame = useCallback((gameData) => {
    setGame(gameData);
    // serverTime is stamped by the backend when the DTO is built.
    setServerOffset(gameData.serverTime ? gameData.serverTime - Date.now() : 0);
  }, []);

  const fetchGameMoves = useCallback(async () => {
    try {
      const moves = await api.getGameMoves(gameId);
      setGameMoves(moves);
    } catch (err) {
      console.error('Failed to fetch moves:', err);
    }
  }, [gameId]);

  const refreshGame = useCallback(async () => {
    try {
      const updated = await api.getGameById(gameId);
      applyGame(updated);
    } catch (err) {
      console.error('Failed to refresh game:', err);
    }
  }, [gameId, applyGame]);

  const handleMoveMade = useCallback(async () => {
    await refreshGame();
    fetchGameMoves();
  }, [refreshGame, fetchGameMoves]);

  // Initial load (and join if there is a free seat).
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        let gameData = await api.getGameById(gameId);

        const userId = await api.fetchUserId();
        const seatFree = gameData.whitePlayer == null || gameData.blackPlayer == null;
        const alreadySeated =
            userId == gameData.whitePlayer?.id || userId == gameData.blackPlayer?.id;

        if (seatFree && !alreadySeated) {
          await api.joinGame(gameId, userId);
          // Joining starts the clocks on the server, so reload the fresh state.
          gameData = await api.getGameById(gameId);
        }
        applyGame(gameData);
      } catch (err) {
        setError('Failed to load game: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
    fetchGameMoves();
  }, [gameId, fetchGameMoves, applyGame]);

  const isActive = game?.gameStatus === 'ACTIVE';

  // Tick: repaint the clocks while the game is running.
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [isActive]);

  // Safety net: periodically resync with the server while the game runs.
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => {
      refreshGame();
      fetchGameMoves();
    }, RESYNC_MS);
    return () => clearInterval(id);
  }, [isActive, refreshGame, fetchGameMoves]);

  // Remaining time for a colour, counting down the side whose turn it is.
  const remainingFor = (color) => {
    if (!game) return null;
    const base = color === 'WHITE' ? game.whiteTimeRemaining : game.blackTimeRemaining;
    if (base === null || base === undefined) return null;
    const running = isActive && game.currentTurn === color && game.lastMoveAt;
    if (!running) return base;
    return base - (now + serverOffset - game.lastMoveAt);
  };

  const whiteLeft = remainingFor('WHITE');
  const blackLeft = remainingFor('BLACK');
  const hasClock = whiteLeft !== null && blackLeft !== null;
  const clockExpired = hasClock && (whiteLeft <= 0 || blackLeft <= 0);

  // When a clock hits zero, ask the server to confirm. It is the only
  // authority on timeouts; we retry until it flips the game to finished.
  useEffect(() => {
    if (!isActive || !clockExpired) return;
    const elapsed = Date.now() - lastFlagCheck.current;
    if (elapsed >= FLAG_RETRY_MS) {
      lastFlagCheck.current = Date.now();
      refreshGame();
    }
  }, [isActive, clockExpired, now, refreshGame]);

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  const waiting = game.gameStatus === 'WAITING_FOR_PLAYER';
  const gameOver = !waiting && !isActive;

  // Put the viewer's own clock at the bottom.
  const viewerIsBlack = user?.id != null && user.id === game.blackPlayer?.id;
  const topColor = viewerIsBlack ? 'WHITE' : 'BLACK';
  const bottomColor = viewerIsBlack ? 'BLACK' : 'WHITE';
  const playerOf = (color) => (color === 'WHITE' ? game.whitePlayer : game.blackPlayer);
  const msOf = (color) => (color === 'WHITE' ? whiteLeft : blackLeft);

  let banner = null;
  if (isActive && clockExpired) {
    banner = 'Time is up. Confirming result...';
  } else if (gameOver && clockExpired) {
    const flagged = whiteLeft <= 0 ? 'WHITE' : 'BLACK';
    const winner = playerOf(flagged === 'WHITE' ? 'BLACK' : 'WHITE');
    const winnerName = winner?.nickname || winner?.username || (flagged === 'WHITE' ? 'Black' : 'White');
    banner = `${winnerName} wins on time.`;
  } else if (gameOver) {
    banner = 'Game over.';
  }

  return (
      <div className={styles.gamePageContainer}>
        <h1>Game #{game.id}</h1>
        <p>
          White: {game.whitePlayer?.nickname || game.whitePlayer?.username || 'N/A'} |
          Black: {game.blackPlayer?.nickname || game.blackPlayer?.username || 'N/A'}
        </p>
        <p>Current Turn: {game.currentTurn === 'WHITE' ? '♙ White' : '♟ Black'}</p>
        {banner && (
            <p role="status" style={{ fontWeight: 700, color: gameOver ? '#facc15' : '#fca5a5' }}>
              {banner}
            </p>
        )}
        <div className={styles.gameContent}>
          <div className={styles.chessboardWrapper}>
            {hasClock && (
                <PlayerClock
                    player={playerOf(topColor)}
                    color={topColor}
                    ms={msOf(topColor)}
                    isActive={isActive && game.currentTurn === topColor}
                />
            )}
            <div style={{ pointerEvents: gameOver || clockExpired ? 'none' : 'auto', margin: '0.5rem 0' }}>
              {(game.blackPlayer && game.whitePlayer) ? (
                  <Chessboard onMoveMade={handleMoveMade} />
              ) : (
                  <p>Both players need to be joined.</p>
              )}
            </div>
            {hasClock && (
                <PlayerClock
                    player={playerOf(bottomColor)}
                    color={bottomColor}
                    ms={msOf(bottomColor)}
                    isActive={isActive && game.currentTurn === bottomColor}
                />
            )}
          </div>
          <div className={styles.gameInfo}>
            <MoveHistory moves={gameMoves} />
          </div>
        </div>
      </div>
  );
}

export default GamePage;