// src/components/MoveHistory/MoveHistory.js
import React, { useEffect,useState } from 'react';
import styles from './MoveHistory.module.css';
import * as api from '../../api/api';

function MoveHistory({ moves }, gameId) {
  const [gameMoves,setGameMoves] = useState([]);
  const [groupedMoves,setGroupedMoves] = useState([]);
  const [noGameMoves,setNoGameMoves] = useState(true);
  // Ensure we are handling potential null or undefined moves array gracefully
  
  useEffect(() =>{
    if (!moves || moves.length === 0) {
    
    return ;
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
    const fetchGameMoves = async () => {
          try {
            const gameMovess = await api.getGameMoves(gameId);
            console.log("Fetched game moves for game:" + gameId + ", moves:" + gameMovess);
            setGameMoves(gameMovess);
          }
          catch (error) {
            console.error("Encountered error while fetching moves."+ error);
            throw error;
          }
    }
    fetchGameMoves();
    

  },[gameId]);

  return (
    <div className={styles.moveHistoryContainer}>
      <h2>Move History</h2>
        
        {noGameMoves ? (<p>No Game Moves</p>) : 
        (groupedMoves.map((group) => (
          // Use turn number for key, assuming turns are unique
                <ul className={styles.moveList}>

          <li key={group.turn} className={styles.moveItem}>
            <span className={styles.moveNumber}>{group.turn}.</span> 
            <span className={styles.move}>{group.whiteMove}</span>
            {group.blackMove && <span className={styles.move}>{group.blackMove}</span>}
          </li>
            </ul>
        )))}
    
    </div>
  );
}

export default MoveHistory;