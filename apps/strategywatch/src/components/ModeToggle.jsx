import React from 'react';
import styles from './ModeToggle.module.css';

/**
 * ModeToggle Component
 * Simple switch to toggle between LIVE and TEST modes
 */
export function ModeToggle({ isLiveMode, onToggle, disabled = false }) {
  const handleTestClick = () => {
    if (isLiveMode) {
      onToggle(); // Only toggle if currently in LIVE mode
    }
  };

  const handleLiveClick = () => {
    if (!isLiveMode) {
      onToggle(); // Only toggle if currently in TEST mode
    }
  };

  return (
    <div className={styles.modeToggle}>
      <button
        className={`${styles.modeLabel} ${!isLiveMode ? styles.active : ''}`}
        onClick={handleTestClick}
        disabled={disabled}
        title="Switch to Test Mode"
      >
        TEST
      </button>
      <button
        className={`${styles.toggleSwitch} ${isLiveMode ? styles.live : styles.test}`}
        onClick={onToggle}
        disabled={disabled}
        title={isLiveMode ? 'Switch to Test Mode' : 'Switch to Live Mode'}
      >
        <div className={styles.toggleSlider} />
      </button>
      <button
        className={`${styles.modeLabel} ${isLiveMode ? styles.active : ''}`}
        onClick={handleLiveClick}
        disabled={disabled}
        title="Switch to Live Mode"
      >
        LIVE
      </button>
    </div>
  );
}

export default ModeToggle;