// src/pages/ProfilePage.js
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchUserProfile, fetchUserMatchHistory } from '../api/api';
import { PlayerAvatar } from '../components/PlayerLink/PlayerLink';
import styles from './ProfilePage.module.css';

function resultFor(game, userId) {
    const isWhite = String(game.whitePlayer?.id) === String(userId);
    const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
    const status = game.gameStatus;

    let outcome = 'In progress';
    let outcomeClass = styles.outcomeOngoing;

    if (status && status !== 'ACTIVE' && status !== 'WAITING_FOR_PLAYER') {
        if (game.winner?.id != null) {
            outcome = String(game.winner.id) === String(userId) ? 'Win' : 'Loss';
            outcomeClass = outcome === 'Win' ? styles.outcomeWin : styles.outcomeLoss;
        } else if (status === 'STALEMATE' || status === 'DRAW') {
            outcome = 'Draw';
            outcomeClass = styles.outcomeDraw;
        } else if (status === 'CHECKMATE' || status === 'TIMEOUT') {
            // currentTurn is the side that lost (it was their turn when the game ended)
            const loserIsWhite = game.currentTurn === 'WHITE';
            const viewerLost = loserIsWhite === isWhite;
            outcome = viewerLost ? 'Loss' : 'Win';
            outcomeClass = viewerLost ? styles.outcomeLoss : styles.outcomeWin;
        } else {
            outcome = status.replace(/_/g, ' ');
        }
    }

    return { opponent, outcome, outcomeClass, color: isWhite ? 'White' : 'Black' };
}

function ProfilePage() {
    const { userId } = useParams();
    const [profile, setProfile] = useState(null);
    const [matchHistory, setMatchHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const loadProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const [profileData, history] = await Promise.all([
                    fetchUserProfile(userId),
                    fetchUserMatchHistory(userId).catch(() => []),
                ]);
                if (!cancelled) {
                    setProfile(profileData);
                    setMatchHistory(
                        [...history].sort((a, b) => (b.id || 0) - (a.id || 0))
                    );
                }
            } catch (err) {
                if (!cancelled) setError('Failed to load profile: ' + err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadProfile();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (loading) {
        return <div className={styles.profilePageContainer}><p className={styles.loadingText}>Loading profile...</p></div>;
    }
    if (error) {
        return <div className={styles.profilePageContainer}><p className={styles.errorText}>{error}</p></div>;
    }
    if (!profile) {
        return <div className={styles.profilePageContainer}><p className={styles.errorText}>Player not found.</p></div>;
    }

    const displayName = profile.nickname || profile.username || `Player #${userId}`;
    const wins = matchHistory.filter((g) => resultFor(g, userId).outcome === 'Win').length;
    const losses = matchHistory.filter((g) => resultFor(g, userId).outcome === 'Loss').length;
    const draws = matchHistory.filter((g) => resultFor(g, userId).outcome === 'Draw').length;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <main className={styles.profilePageContainer}>
                <section className={styles.profileHeroCard}>
                    <PlayerAvatar player={profile} fallback={displayName} size={96} />
                    <div className={styles.profileHeroInfo}>
                        <h1 className={styles.profileName}>
                            {displayName}
                            {profile.guest && <span className={styles.guestBadge}>Guest</span>}
                        </h1>
                        <p className={styles.profileUsername}>@{profile.username}</p>
                        <div className={styles.statsRow}>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{profile.rating ?? '—'}</span>
                                <span className={styles.statLabel}>Rating</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{matchHistory.length}</span>
                                <span className={styles.statLabel}>Games</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={`${styles.statValue} ${styles.winColor}`}>{wins}</span>
                                <span className={styles.statLabel}>Wins</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={`${styles.statValue} ${styles.lossColor}`}>{losses}</span>
                                <span className={styles.statLabel}>Losses</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={`${styles.statValue} ${styles.drawColor}`}>{draws}</span>
                                <span className={styles.statLabel}>Draws</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.historySection}>
                    <h2 className={styles.sectionTitle}>Match History</h2>
                    {matchHistory.length === 0 ? (
                        <p className={styles.emptyText}>No games played yet.</p>
                    ) : (
                        <ul className={styles.historyList}>
                            {matchHistory.map((game) => {
                                const { opponent, outcome, outcomeClass, color } = resultFor(game, userId);
                                return (
                                    <li key={game.id} className={styles.historyItem}>
                                        <div className={styles.historyMain}>
                                            <span className={`${styles.outcomeBadge} ${outcomeClass}`}>{outcome}</span>
                                            <span className={styles.historyOpponent}>
                                                vs{' '}
                                                {opponent?.id != null ? (
                                                    <Link to={`/profile/${opponent.id}`} className={styles.opponentLink}>
                                                        {opponent?.nickname || opponent?.username || 'Unknown'}
                                                    </Link>
                                                ) : (
                                                    opponent?.nickname || opponent?.username || 'Waiting for opponent'
                                                )}
                                            </span>
                                            <span className={styles.historyColor}>as {color}</span>
                                        </div>
                                        <div className={styles.historyMeta}>
                                            <span>{game.timeControl ?? '?'} + {game.timeIncrement ?? 0}</span>
                                            <Link to={`/game/${game.id}`} className={styles.viewGameLink}>View game</Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}

export default ProfilePage;
