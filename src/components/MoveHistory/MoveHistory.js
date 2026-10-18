// src/components/MoveHistory/MoveHistory.js
import React, { useEffect, useMemo, useRef } from 'react';
import styles from './MoveHistory.module.css';

// Spring may serialize LocalDateTime as an ISO string or as [y, m, d, h, mi, s, nanos].
function parseTimestamp(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0, s = 0, nano = 0] = value;
    return new Date(y, mo - 1, d, h, mi, s, Math.floor(nano / 1e6));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const listStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  maxHeight: '420px',
  overflowY: 'auto',
};
const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '2rem minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.35rem 0.6rem',
  borderLeft: '3px solid transparent',
  fontVariantNumeric: 'tabular-nums',
};
const zebraStyle = { background: 'rgba(255, 255, 255, 0.04)' };
const latestStyle = { borderLeftColor: '#facc15', background: 'rgba(250, 204, 21, 0.08)' };
const numberStyle = { color: '#9ca3af', textAlign: 'right' };
const whoStyle = { display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 };
const nameStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const moveStyle = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 };
const timeStyle = { color: '#9ca3af', fontSize: '0.8rem', minWidth: '4.5rem', textAlign: 'right' };

// whitePlayer / blackPlayer are optional fallbacks used when a move has no player attached.
function MoveHistory({ moves, whitePlayer, blackPlayer }) {
  const listRef = useRef(null);

  // The backend numbers moves per ply (1 = white's first move, 2 = black's reply, ...).
  const rows = useMemo(() => {
    if (!moves || moves.length === 0) return [];
    return [...moves]
        .sort((a, b) => (a.moveNumber || 0) - (b.moveNumber || 0))
        .map((move, index) => {
          const ply = move.moveNumber ?? index + 1;
          const color = move.playerColor || (ply % 2 === 1 ? 'WHITE' : 'BLACK');
          const fallback = color === 'WHITE' ? whitePlayer : blackPlayer;
          const mover =
              move.player?.nickname ||
              move.player?.username ||
              fallback?.nickname ||
              fallback?.username ||
              (color === 'WHITE' ? 'White' : 'Black');
          return {
            key: move.id ?? ply,
            fullMove: Math.ceil(ply / 2),
            color,
            mover,
            san: move.san,
            time: parseTimestamp(move.timestamp),
          };
        });
  }, [moves, whitePlayer, blackPlayer]);

  // Keep the newest move in view.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [rows.length]);

  return (
      <div className={styles.moveHistoryContainer}>
        <h2>Move History</h2>
        {rows.length === 0 ? (
            <p>No moves yet.</p>
        ) : (
            <ol ref={listRef} style={listStyle}>
              {rows.map((row, index) => (
                  <li
                      key={row.key}
                      style={{
                        ...rowStyle,
                        ...(index % 2 === 1 ? zebraStyle : {}),
                        ...(index === rows.length - 1 ? latestStyle : {}),
                      }}
                  >
                    <span style={numberStyle}>{row.color === 'WHITE' ? `${row.fullMove}.` : ''}</span>
                    <span style={whoStyle}>
                <span aria-hidden="true">{row.color === 'WHITE' ? '♙' : '♟'}</span>
                <span style={nameStyle} title={row.mover}>{row.mover}</span>
              </span>
                    <span style={moveStyle}>{row.san}</span>
                    {row.time ? (
                        <time dateTime={row.time.toISOString()} title={row.time.toLocaleString()} style={timeStyle}>
                          {formatTime(row.time)}
                        </time>
                    ) : (
                        <span style={timeStyle} />
                    )}
                  </li>
              ))}
            </ol>
        )}
      </div>
  );
}

export default MoveHistory;