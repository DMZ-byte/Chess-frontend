// src/components/MoveHistory/MoveHistory.js
import React, { useEffect,useState } from 'react';
import styles from './MoveHistory.module.css';
import * as api from '../../api/api';

function MoveHistory({ moves }) {
  const [groupedMoves,setGroupedMoves] = useState([]);
  const [noGameMoves,setNoGameMoves] = useState(true);
  // Ensure we are handling potential null or undefined moves array gracefully
  
  useEffect(() =>{
    if(!moves || moves.length === 0){
      setGroupedMoves([]);
      setNoGameMoves(true);
      return;
    }
    const turnMap = new Map();
    for(const move of moves){
      const moveNum = move.moveNumber;
      const color = move.playerColor
      const san = move.san;
      if (!turnMap.has(moveNum)){
        turnMap.set(moveNum,{turn:moveNum,whiteMove: '', blackMove: ''});
      }
      const turn = turnMap.get(moveNum);
      if (color === 'WHITE'){
        turn.whiteMove = san;
      } else if (color === 'BLACK'){
        turn.blackMove = san;
      }
    }
    const grouped = Array.from(turnMap.values()).sort((a,b) => a.turn - b.turn);
    setGroupedMoves(grouped);

  },[moves]);

  return (
    <div className={styles.moveHistoryContainer}>
      <h2>Move History</h2>
        
        {groupedMoves.length === 0  ? (<p>No Game Moves</p>) : 
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