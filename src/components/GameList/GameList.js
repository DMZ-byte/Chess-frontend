import React from 'react';
import { Link } from 'react-router-dom';
import styles from './GameList.module.css';

function GameList({ games }) {
  if (!games || games.length === 0) {
    return <div className={styles.gameListContainer}>No games available.</div>;
  }

  return (
    <div className={styles.gameListContainer}>
      {games.map((game) => (
        <div key={game.id} className={styles.gameCard}>
          <Link to={`/games/${game.id}`}>
            <h3>Game #{game.id}</h3>
            <p>White: {game.whitePlayer.username}</p>
            <p>Black: {game.blackPlayer.username}</p>
            <p>Status: {game.gameStatus}</p>
          </Link>
        </div>
      ))}
    </div>
  );
}

export default GameList;