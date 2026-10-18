// src/components/PlayerLink/PlayerLink.js
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './PlayerLink.module.css';

// Picks a stable color for the avatar background based on the player's id/name.
function colorFor(seed) {
    const palette = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
    let hash = 0;
    const text = String(seed || 'guest');
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

export function PlayerAvatar({ player, fallback = '?', size = 32 }) {
    const name = player?.nickname || player?.username || fallback;
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    const background = colorFor(player?.id ?? name);
    return (
        <span
            className={styles.avatar}
            style={{ width: size, height: size, fontSize: size * 0.48, background }}
            aria-hidden="true"
        >
            {initial}
        </span>
    );
}

function ratingText(player) {
    if (!player) return null;
    if (player.guest) return 'Unrated';
    return player.rating != null ? String(player.rating) : null;
}

/**
 * Renders a player's avatar + name. If the player has an id, both the avatar
 * and the name link to that player's profile page.
 */
function PlayerLink({ player, fallback = 'N/A', showAvatar = true, showRating = true, avatarSize = 32, className }) {
    const name = player?.nickname || player?.username || fallback;
    const rating = showRating ? ratingText(player) : null;

    const content = (
        <>
            {showAvatar && <PlayerAvatar player={player} fallback={fallback} size={avatarSize} />}
            <span className={styles.name}>{name}</span>
            {rating && <span className={styles.ratingBadge} title="Rating">{rating}</span>}
        </>
    );

    if (player?.id != null) {
        return (
            <Link to={`/profile/${player.id}`} className={`${styles.playerLink} ${className || ''}`}>
                {content}
            </Link>
        );
    }

    return <span className={`${styles.playerLink} ${className || ''}`}>{content}</span>;
}

export default PlayerLink;
