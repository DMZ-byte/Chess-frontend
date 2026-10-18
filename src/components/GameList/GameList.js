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

const opposite = (color) => (color === 'WHITE' ? 'BLACK' : 'WHITE');

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
const PAGE_CSS = `
@keyframes chessClockPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
  50%      { box-shadow: 0 0 0 7px rgba(239, 68, 68, 0); }
}
@keyframes gameResultPop {
  from { opacity: 0; transform: translateY(10px) scale(0.94); }
  to   { opacity: 1; transform: none; }
}
.chess-clock--low { animation: chessClockPulse 1s ease-in-out infinite; }
.game-result-card { animation: gameResultPop 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .chess-clock--low, .game-result-card { animation: none; }
}
`;

/* ------------------------------ Player names ------------------------------ */

function ratingText(player) {
  if (!player) return null;
  if (player.guest) return 'Unrated';
  return player.rating != null ? String(player.rating) : null;
}

const ratingBadgeStyle = {
  marginLeft: '0.4rem',
  padding: '0.05rem 0.45rem',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.12)',
  fontSize: '0.75em',
  fontWeight: 600,
  verticalAlign: 'middle',
};

// Name with the player's rating next to it.
function PlayerName({ player, fallback = 'N/A' }) {
  const name = player?.nickname || player?.username || fallback;
  const rating = ratingText(player);
  return (
      <span>
      {name}
        {rating && <span style={ratingBadgeStyle} title="Rating">{rating}</span>}
    </span>
  );
}

/* --------------------------------- Clocks --------------------------------- */

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
        <span>
          {color === 'WHITE' ? '♙' : '♟'}{' '}
          <PlayerName player={player} fallback="Waiting for player" />
        </span>
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

/* ------------------------------ Game result ------------------------------- */

// Works out how the game ended. After a checkmate or a timeout, currentTurn is
// the side that lost (it was the one to move), so no extra backend field is needed.
function getResult(game) {
  const decisive = (title, loserColor, reason) => ({
    title, draw: false, loserColor, winnerColor: opposite(loserColor), reason,
  });

  switch (game.gameStatus) {
    case 'CHECKMATE':
      return decisive('Checkmate', game.currentTurn, 'by checkmate');
    case 'TIMEOUT': {
      const flagged =
          game.whiteTimeRemaining <= 0 ? 'WHITE'
              : game.blackTimeRemaining <= 0 ? 'BLACK'
                  : game.currentTurn;
      return decisive('Time out', flagged, 'on time');
    }
    case 'STALEMATE':
      return { title: 'Stalemate', draw: true, reason: 'by stalemate' };
    case 'DRAW':
      return { title: 'Draw', draw: true, reason: 'by agreement' };
    default: {
      // Any other finishing status (e.g. resignation): use the winner field if the API sends one.
      const title = String(game.gameStatus || 'Game over')
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/^\w/, (c) => c.toUpperCase());
      if (game.winner?.id != null) {
        const winnerColor = game.winner.id === game.whitePlayer?.id ? 'WHITE' : 'BLACK';
        return { title, draw: false, winnerColor, loserColor: opposite(winnerColor), reason: '' };
      }
      return { title, draw: false, winnerColor: null, loserColor: null, reason: '' };
    }
  }
}

const resultStyles = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'rgba(17, 24, 39, 0.78)',
    backdropFilter: 'blur(3px)',
    borderRadius: '6px',
  },
  card: {
    width: '100%',
    maxWidth: '340px',
    padding: '1.4rem 1.2rem 1.2rem',
    textAlign: 'center',
    borderRadius: '12px',
    border: '2px solid #facc15',
    background: '#1f2937',
    color: '#f9fafb',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
  },
  icon: { fontSize: '2.8rem', lineHeight: 1 },
  eyebrow: {
    margin: '0.6rem 0 0',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#facc15',
  },
  headline: { margin: '0.2rem 0 0.35rem', fontSize: '1.7rem', fontWeight: 800 },
  subline: { margin: '0 0 1rem', color: '#d1d5db' },
  players: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.1rem' },
  chip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.45rem 0.7rem',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#111827',
    color: '#d1d5db',
    textAlign: 'left',
  },
  chipWinner: { borderColor: '#facc15', color: '#fff', background: 'rgba(250, 204, 21, 0.1)' },
  chipTag: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
  button: {
    padding: '0.5rem 1.2rem',
    borderRadius: '999px',
    border: 'none',
    background: '#facc15',
    color: '#111827',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

function ResultChip({ player, color, tag, winner }) {
  return (
      <div style={{ ...resultStyles.chip, ...(winner ? resultStyles.chipWinner : {}) }}>
      <span>
        {color === 'WHITE' ? '♙' : '♟'}{' '}
        <PlayerName player={player} fallback={color === 'WHITE' ? 'White' : 'Black'} />
      </span>
        {tag && <span style={resultStyles.chipTag}>{tag}</span>}
      </div>
  );
}

function resultNames(result, playerOf) {
  const nameOf = (color) => {
    const p = playerOf(color);
    return p?.nickname || p?.username || (color === 'WHITE' ? 'White' : 'Black');
  };
  return {
    winnerName: result.winnerColor ? nameOf(result.winnerColor) : null,
    nameOf,
  };
}

function ResultOverlay({ result, playerOf, viewerColor, onDismiss }) {
  const { winnerName } = resultNames(result, playerOf);

  let icon = '🏁';
  let headline = 'Game over';
  let subline = '';
  if (result.draw) {
    icon = '🤝';
    headline = "It's a draw";
    subline = `The game ended in a draw ${result.reason}.`;
  } else if (result.winnerColor) {
    icon = viewerColor && viewerColor !== result.winnerColor ? '♚' : '🏆';
    if (viewerColor === result.winnerColor) headline = 'You won!';
    else if (viewerColor === result.loserColor) headline = 'You lost';
    else headline = `${winnerName} wins`;
    subline = `${winnerName} wins ${result.reason}`.trim() + '.';
  }

  const decisive = !result.draw && result.winnerColor;
  const order = decisive
      ? [result.winnerColor, result.loserColor]
      : ['WHITE', 'BLACK'];

  return (
      <div style={resultStyles.backdrop}>
        <div className="game-result-card" style={resultStyles.card} role="status" aria-live="polite">
          <div style={resultStyles.icon} aria-hidden="true">{icon}</div>
          <p style={resultStyles.eyebrow}>{result.title}</p>
          <h2 style={resultStyles.headline}>{headline}</h2>
          {subline && <p style={resultStyles.subline}>{subline}</p>}
          <div style={resultStyles.players}>
            {order.map((color) => (
                <ResultChip
                    key={color}
                    player={playerOf(color)}
                    color={color}
                    winner={decisive && color === result.winnerColor}
                    tag={decisive ? (color === result.winnerColor ? 'Winner' : 'Defeated') : 'Draw'}
                />
            ))}
          </div>
          <button type="button" style={resultStyles.button} onClick={onDismiss}>
            View board
          </button>
        </div>
      </div>
  );
}

/* -------------------------------- Game page -------------------------------- */

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
  // The result card sits over the board until the player closes it.
  const [resultDismissed, setResultDismissed] = useState(false);

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

  // Opening another game shows its result card again.
  useEffect(() => {
    setResultDismissed(false);
  }, [gameId]);

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

  // Make sure the final move shows up in the history when the game ends.
  const finishedStatus = !isActive && game && game.gameStatus !== 'WAITING_FOR_PLAYER'
      ? game.gameStatus
      : null;
  useEffect(() => {
    if (finishedStatus) fetchGameMoves();
  }, [finishedStatus, fetchGameMoves]);

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found.</div>;

  const waiting = game.gameStatus === 'WAITING_FOR_PLAYER';
  const gameOver = !waiting && !isActive;
  const result = gameOver ? getResult(game) : null;

  const hasClock = game.whiteTimeRemaining != null && game.blackTimeRemaining != null;
  // timeControl is the starting time in minutes (e.g. "10" or "10+5").
  const totalMs = (parseInt(game.timeControl, 10) || 0) * 60000 || null;

  // Put the viewer's own clock at the bottom.
  const viewerIsBlack = user?.id != null && user.id === game.blackPlayer?.id;
  const viewerIsWhite = user?.id != null && user.id === game.whitePlayer?.id;
  const viewerColor = viewerIsWhite ? 'WHITE' : viewerIsBlack ? 'BLACK' : null;
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

  // One-line summary shown once the result card has been closed.
  let summary = null;
  if (result) {
    const { winnerName } = resultNames(result, playerOf);
    if (result.draw) summary = `🤝 Draw ${result.reason}`;
    else if (winnerName) summary = `🏆 ${winnerName} wins ${result.reason}`.trim();
    else summary = `🏁 ${result.title}`;
  }

  return (
      <div className={styles.gamePageContainer}>
        <style>{PAGE_CSS}</style>
        <h1>Game #{game.id}</h1>
        <p>
          White: <PlayerName player={game.whitePlayer} /> |{' '}
          Black: <PlayerName player={game.blackPlayer} />
        </p>
        {isActive && <p>Current Turn: {game.currentTurn === 'WHITE' ? '♙ White' : '♟ Black'}</p>}
        {isActive && clockExpired && (
            <p role="status" style={{ fontWeight: 700, color: '#fca5a5' }}>
              Time is up. Confirming result...
            </p>
        )}
        {summary && resultDismissed && (
            <p role="status" style={{ fontWeight: 700, color: '#facc15' }}>{summary}</p>
        )}
        <div className={styles.gameContent}>
          <div className={styles.chessboardWrapper}>
            {hasClock && renderClock(topColor)}
            <div style={{ position: 'relative', margin: '0.5rem 0' }}>
              <div style={{ pointerEvents: gameOver || clockExpired ? 'none' : 'auto' }}>
                {(game.blackPlayer && game.whitePlayer) ? (
                    <Chessboard onMoveMade={handleMoveMade} />
                ) : (
                    <p>Both players need to be joined.</p>
                )}
              </div>
              {result && !resultDismissed && (
                  <ResultOverlay
                      result={result}
                      playerOf={playerOf}
                      viewerColor={viewerColor}
                      onDismiss={() => setResultDismissed(true)}
                  />
              )}
            </div>
            {hasClock && renderClock(bottomColor)}
          </div>
          <div className={styles.gameInfo}>
            <MoveHistory
                moves={gameMoves}
                whitePlayer={game.whitePlayer}
                blackPlayer={game.blackPlayer}
            />
          </div>
        </div>
      </div>
  );
}

export default GamePage;