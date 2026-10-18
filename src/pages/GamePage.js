import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams } from 'react-router-dom';
import Chessboard from '../components/Chessboard/ChessyBoard';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import styles from './GamePage.module.css';
import * as api from '../api/api';
import { AuthContext } from '../App';

const RESYNC_MS = 5000;       // safety-net refetch while a game is running
const FLAG_RETRY_MS = 1000;   // how often to ask the server to confirm a timeout
const LOW_TIME_MS = 30000;    // clock turns red and pulses below this

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

// Keyframes can't be written as inline styles, so they live in one small block.
const CLOCK_CSS = `
@keyframes chessClockPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
  50%      { box-shadow: 0 0 0 7px rgba(239, 68, 68, 0); }
}
.chess-clock--low { animation: chessClockPulse 1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .chess-clock--low { animation: none; }
}
`;

const clockStyles = {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    padding: '0.5rem 0.9rem 0.6rem',
    borderRadius: '6px',
    border: '2px solid #374151',
    background: '#1f2937',
    color: '#d1d5db',
    fontVariantNumeric: 'tabular-nums',
    transition: 'border-color 150ms, background 150ms',
  },
  active: { borderColor: '#facc15', color: '#fff' },
  low: { borderColor: '#ef4444', background: '#3b1d1d', color: '#fecaca' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' },
  time: { fontSize: '1.6rem', fontWeight: 700 },
  track: { height: '4px', borderRadius: '2px', background: '#111827', overflow: 'hidden' },
  bar: { height: '100%', width: '100%', transformOrigin: 'left center' },
};

// Each clock runs its own animation loop, so the rest of the page (and the
// chessboard) is not re-rendered on every frame.
function PlayerClock({ player, color, baseMs, running, lastMoveAt, serverOffset, totalMs, onExpire }) {
  const [ms, setMs] = useState(baseMs);

  useEffect(() => {
    const remainingNow = () =>
        running && lastMoveAt ? baseMs - (Date.now() + serverOffset - lastMoveAt) : baseMs;

    setMs(remainingNow());
    if (!running) return undefined;

    let frame;
    const tick = () => {
      const remaining = remainingNow();
      setMs(remaining);
      if (remaining <= 0) {
        onExpire();
        return; // stop animating; the server decides the result
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [baseMs, running, lastMoveAt, serverOffset, onExpire]);

  const shown = Math.max(0, ms);
  const low = running && shown < LOW_TIME_MS;
  const fraction = totalMs ? Math.min(1, shown / totalMs) : null;
  const name = player?.nickname || player?.username || 'Waiting for player';

  const style = {
    ...clockStyles.base,
    ...(running ? clockStyles.active : {}),
    ...(low ? clockStyles.low : {}),
  };
  const barColor = low ? '#ef4444' : running ? '#facc15' : '#6b7280';

  return (
      <div
          className={low ? 'chess-clock--low' : undefined}
          style={style}
          role="timer"
          aria-label={`${color.toLowerCase()} clock`}
      >
        <div style={clockStyles.row}>
          <span>{color === 'WHITE' ? '♙' : '♟'} {name}</span>
          <span style={clockStyles.time}>{formatClock(shown)}</span>
        </div>
        {fraction !== null && (
            <div style={clockStyles.track}>
              <div
                  style={{
                    ...clockStyles.bar,
                    background: barColor,
                    transform: `scaleX(${fraction})`,
                  }}
              />
            </div>
        )}
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
  // Set by a clock when it reaches zero, until the server confirms the result.
  const [clockExpired, setClockExpired] = useState(false);
  const onClockExpired = useCallback(() => setClockExpired(true), []);

  const applyGame = useCallback((gameData) => {
    setGame(gameData);
    // serverTime is stamped by the backend each time the DTO is built.
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

  // A new move (or a finished game) clears any pending "time is up" state.
  useEffect(() => {
    setClockExpired(false);
  }, [game?.lastMoveAt, game?.gameStatus]);

  // Safety net: periodically resync with the server while the game runs.
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => {
      refreshGame();
      fetchGameMoves();
    }, RESYNC_MS);
    return () => clearInterval(id);
  }, [isActive, refreshGame, fetchGameMoves]);

  // When a clock hits zero, ask the server to confirm. It is the only
  // authority on timeouts; keep asking until it flips the game to finished.
  useEffect(() => {
    if (!isActive || !clockExpired) return undefined;
    refreshGame();
    const id = setInterval(refreshGame, FLAG_RETRY_MS);
    return () => clearInterval(id);
  }, [isActive, clockExpired, refreshGame]);

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  const waiting = game.gameStatus === 'WAITING_FOR_PLAYER';
  const gameOver = !waiting && !isActive;

  const hasClock = game.whiteTimeRemaining != null && game.blackTimeRemaining != null;
  const timeoutRecorded =
      hasClock && (game.whiteTimeRemaining <= 0 || game.blackTimeRemaining <= 0);
  // timeControl is the starting time in minutes (e.g. "10" or "10+5").
  const totalMs = (parseInt(game.timeControl, 10) || 0) * 60000 || null;

  // Put the viewer's own clock at the bottom.
  const viewerIsBlack = user?.id != null && user.id === game.blackPlayer?.id;
  const topColor = viewerIsBlack ? 'WHITE' : 'BLACK';
  const bottomColor = viewerIsBlack ? 'BLACK' : 'WHITE';
  const playerOf = (color) => (color === 'WHITE' ? game.whitePlayer : game.blackPlayer);

  const renderClock = (color) => (
      <PlayerClock
          player={playerOf(color)}
          color={color}
          baseMs={color === 'WHITE' ? game.whiteTimeRemaining : game.blackTimeRemaining}
          running={isActive && game.currentTurn === color}
          lastMoveAt={game.lastMoveAt}
          serverOffset={serverOffset}
          totalMs={totalMs}
          onExpire={onClockExpired}
      />
  );

  let banner = null;
  if (isActive && clockExpired) {
    banner = 'Time is up. Confirming result...';
  } else if (gameOver && timeoutRecorded) {
    const flagged = game.whiteTimeRemaining <= 0 ? 'WHITE' : 'BLACK';
    const winner = playerOf(flagged === 'WHITE' ? 'BLACK' : 'WHITE');
    const winnerName = winner?.nickname || winner?.username || (flagged === 'WHITE' ? 'Black' : 'White');
    banner = `${winnerName} wins on time.`;
  } else if (gameOver) {
    const winner = game.currentTurn === 'WHITE' ? game.blackPlayer : game.whitePlayer;
    const winnerName = winner?.nickname || winner?.username || (game.currentTurn === 'WHITE' ? 'Black' : 'White');
    banner = `${winnerName} wins by checkmate.`;
  }

  return (
      <div className={styles.gamePageContainer}>
        <style>{CLOCK_CSS}</style>
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
            {hasClock && renderClock(topColor)}
            <div style={{ pointerEvents: gameOver || clockExpired ? 'none' : 'auto', margin: '0.5rem 0' }}>
              {(game.blackPlayer && game.whitePlayer) ? (
                  <Chessboard onMoveMade={handleMoveMade} />
              ) : (
                  <p>Both players need to be joined.</p>
              )}
            </div>
            {hasClock && renderClock(bottomColor)}
          </div>
          <div className={styles.gameInfo}>
            <MoveHistory moves={gameMoves} />
          </div>
        </div>
      </div>
  );
}

export default GamePage;