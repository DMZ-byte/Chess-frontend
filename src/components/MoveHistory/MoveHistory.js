// src/components/MoveHistory/MoveHistory.js
import React from 'react';
import styles from './MoveHistory.module.css';

function MoveHistory({ moves }) {
  // Ensure we are handling potential null or undefined moves array gracefully
  if (!moves || moves.length === 0) {
    return <div className={styles.moveHistoryContainer}>No moves yet.</div>;
  }

  // Grouping moves by turn number (e.g., 1. e4 e5)
  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      turn: Math.floor(i / 2) + 1,
      whiteMove: moves[i]?.san,
      blackMove: moves[i + 1]?.san || null,
    });
  }

  return (
    <div className={styles.moveHistoryContainer}>
      <h2>Move History</h2>
      <ul className={styles.moveList}>
        {groupedMoves.map((group) => (
          // Use turn number for key, assuming turns are unique
          <li key={group.turn} className={styles.moveItem}>
            <span className={styles.moveNumber}>{group.turn}.</span> 
            <span className={styles.move}>{group.whiteMove}</span>
            {group.blackMove && <span className={styles.move}>{group.blackMove}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MoveHistory;