import React from 'react';
import styles from './MoveHistory.module.css';

function MoveHistory({ moves }) {
  if (!moves || moves.length === 0) {
    return <div className={styles.moveHistoryContainer}>No moves yet.</div>;
  }

  return (
    <div className={styles.moveHistoryContainer}>
      <h2>Move History</h2>
      <ul className={styles.moveList}>
        {moves.map((move, index) => (
          <li key={move.id || index} className={styles.moveItem}>
            <span className={styles.moveNumber}>{(index / 2) + 1}.</span> {move.san}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MoveHistory;