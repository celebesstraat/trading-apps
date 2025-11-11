import './Header.css';
import { useState } from 'react';
import { toggleMute } from '../utils/voiceAlerts';
import { VoiceSettings } from './VoiceSettings';
import { useData } from '../hooks/useData';
import { ModeToggle } from './ModeToggle';

/**
 * Header Component
 * Displays app title, connection status, and current time with calendar-aware market status
 *
 * @param {object} props
 * @param {boolean} props.connected WebSocket connection status
 * @param {string} props.currentTime Current time string (ET)
 * @param {boolean} props.marketOpen Whether market is currently open
 * @param {object} props.marketStatus Market status object with timing info
 * @param {boolean} props.apiConfigured Whether API keys are configured
 * @param {boolean} props.isHoliday Whether today is a market holiday
 * @param {boolean} props.isWeekend Whether today is a weekend
 * @param {boolean} props.isLoading Whether calendar data is still loading
 */
export function Header({ connected, currentTime, marketOpen, marketStatus, apiConfigured, isHoliday = false, isWeekend = false, isLoading = false }) {
  const {
    globalMuted,
    setGlobalMuted,
    isLiveMode,
    toggleLiveMode
  } = useData();
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const handleToggleMute = () => {
    const newMutedState = toggleMute();
    setGlobalMuted(newMutedState);
  };

  const handleVoiceSettingsClick = () => {
    setShowVoiceSettings(true);
  };

  const handleCloseVoiceSettings = () => {
    setShowVoiceSettings(false);
  };

  /**
   * Get CSS class for market status based on status, holiday, and weekend
   * @param {string} status - Market status
   * @param {boolean} isHoliday - Whether today is a holiday
   * @param {boolean} isWeekend - Whether today is a weekend
   * @returns {string} CSS class name
   */
  const getMarketStatusClass = (status, isHoliday, isWeekend) => {
    if (status === 'Regular Hours') {
      return 'market-open';
    } else if (isHoliday) {
      return 'market-holiday';
    } else if (isWeekend) {
      return 'market-weekend';
    } else {
      return 'market-closed';
    }
  };

  /**
   * Get display text for market status
   * @param {string} status - Market status
   * @param {boolean} isHoliday - Whether today is a holiday
   * @param {boolean} isWeekend - Whether today is a weekend
   * @returns {string} Display text
   */
  const getStatusDisplay = (status, isHoliday, isWeekend) => {
    if (isHoliday) {
      return (
        <div>
          🎉 {status}
          <div className="status-subtitle">Market Holiday</div>
        </div>
      );
    } else if (isWeekend) {
      return (
        <div>
          {status}
          <div className="status-subtitle">Weekend</div>
        </div>
      );
    } else {
      return status;
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">StrategyWatch</h1>
        {isLoading ? (
          <div className="market-info">
            <span className="market-status market-loading">
              Loading...
            </span>
          </div>
        ) : (marketStatus?.status) ? (
          <div className="market-info">
            <span className={`market-status ${getMarketStatusClass(marketStatus.status, isHoliday, isWeekend)}`}>
              {getStatusDisplay(marketStatus.status, isHoliday, isWeekend)}
            </span>
            <span className={`market-hours mono ${isHoliday ? 'holiday-message' : ''}`}>
              {marketStatus.nextStatus}
            </span>
          </div>
        ) : (
          <span className={`market-status ${marketOpen ? 'market-open' : 'market-closed'}`}>
            {marketOpen ? 'Market Open' : 'Market Closed'}
          </span>
        )}
        {currentTime && (
          <div className={`current-time mono ${marketStatus?.status === 'Regular Hours' ? 'time-market-open' : 'time-market-closed'}`}>
            {currentTime}
          </div>
        )}
      </div>

      <div className="header-right">
        <div className="mode-control">
          {/* Live/Test mode toggle */}
          <ModeToggle
            isLiveMode={isLiveMode}
            onToggle={toggleLiveMode}
          />
        </div>
        <div className="voice-control">
          {/* Voice alert controls */}
          <button
            className={`voice-mute-btn ${globalMuted ? 'muted' : 'unmuted'}`}
            onClick={handleToggleMute}
            title={globalMuted ? 'Unmute voice alerts' : 'Mute voice alerts'}
          >
            {globalMuted ? '🔇' : '🔊'}
          </button>
          <button
            className="voice-settings-btn"
            onClick={handleVoiceSettingsClick}
            title="Voice settings"
          >
            ⚙️
          </button>
        </div>
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {connected ? 'WebSocket' : 'WebSocket'}
          </span>
        </div>
        <div className="api-status">
          <span className={`status-dot ${apiConfigured ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            API Keys
          </span>
        </div>
        <div className="mode-status" title={isLiveMode ? 'Using real market data' : 'Using simulated data for testing'}>
          <span className={`status-dot ${isLiveMode ? 'connected' : 'warning'}`}></span>
          <span className="status-text">
            {isLiveMode ? 'LIVE' : 'TEST'}
          </span>
        </div>
      </div>
    </header>

      {/* Voice Settings Modal */}
      <VoiceSettings isOpen={showVoiceSettings} onClose={handleCloseVoiceSettings} />
    </>
  );
}

export default Header;
