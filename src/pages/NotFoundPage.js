// src/pages/NotFoundPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NotFoundPage.module.css'; // Create this CSS module too

function NotFoundPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>404 - Page Not Found</h1>
      <p className={styles.message}>The page you are looking for does not exist.</p>
      <Link to="/" className={styles.link}>Go to Home</Link>
    </div>
  );
}

export default NotFoundPage;