import './Header.css';
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { toggleMute, isMuted, isSupported } from '../utils/voiceAlerts';
import { VoiceSettings } from './VoiceSettings';
import { MOCK_DATA_MODE } from '../config/constants';
import { useData } from '../context/DataContext';
import NewsAlertBanner from './NewsAlertBanner';
import { ModeToggle } from './ModeToggle';

/**
 * Header Component
 * Displays app title, connection status, and current time
 *
 * @param {object} props
 * @param {boolean} props.connected WebSocket connection status
 * @param {string} props.currentTime Current time string (ET)
 * @param {boolean} props.marketOpen Whether market is currently open
 * @param {object} props.marketStatus Market status object with timing info
 * @param {boolean} props.apiConfigured Whether API keys are configured
 */
export function Header({ connected, currentTime, marketOpen, marketStatus, apiConfigured }) {
  const {
    globalMuted,
    setGlobalMuted,
    newsItems,
    newsConnected,
    dismissNewsItem,
    markNewsAsRead,
    getUnreadNewsCount,
    isLiveMode,
    toggleLiveMode
  } = useData();
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showNewsAlert, setShowNewsAlert] = useState(false);
  const [tickerFilter, setTickerFilter] = useState(null); // For filtering news by specific ticker

  useEffect(() => {
    const supported = isSupported();
    setVoiceSupported(supported);

    // Listen for custom event from ticker news icons
    const handleOpenNewsAlert = (event) => {
      const ticker = event.detail?.ticker;
      setTickerFilter(ticker); // Set the ticker filter
      setShowNewsAlert(true);
    };

    window.addEventListener('openNewsAlert', handleOpenNewsAlert);

    return () => {
      window.removeEventListener('openNewsAlert', handleOpenNewsAlert);
    };
  }, []);

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

  const handleNewsIconClick = () => {
    setTickerFilter(null); // Clear ticker filter when clicking universal news icon
    setShowNewsAlert(!showNewsAlert);
  };

  const handleDismissNews = (newsId) => {
    dismissNewsItem(newsId);
  };

  const handleMarkNewsRead = (newsId) => {
    markNewsAsRead(newsId);
  };

  const unreadCount = getUnreadNewsCount();

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">StrategyWatch</h1>
        {(marketStatus?.status) ? (
          <div className="market-info">
            <span className={`market-status ${marketStatus.status === 'Regular Hours' ? 'market-open' : 'market-closed'}`}>
              {marketStatus.status === 'Weekend' ? (
                <div>
                  {marketStatus.status}
                  <div className="market-hours weekend-message">
                    {marketStatus.nextStatus}
                  </div>
                </div>
              ) : (
                marketStatus.status
              )}
            </span>
            {marketStatus.status !== 'Weekend' && (
              <span className="market-hours mono">
                {marketStatus.nextStatus}
              </span>
            )}
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
        <div className="news-control">
          {/* News alert button */}
          <button
            className={`news-alert-btn ${unreadCount > 0 ? 'has-news' : ''}`}
            onClick={handleNewsIconClick}
            title={`${unreadCount} unread news item${unreadCount !== 1 ? 's' : ''}`}
          >
            📰
            {unreadCount > 0 && (
              <span className="news-badge">{unreadCount}</span>
            )}
          </button>
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

      {/* News Alert Banner */}
      {showNewsAlert && (
        <NewsAlertBanner
          newsItems={newsItems}
          onDismiss={handleDismissNews}
          onMarkRead={handleMarkNewsRead}
          tickerFilter={tickerFilter}
          onClearFilter={() => setTickerFilter(null)}
        />
      )}

      {/* Voice Settings Modal */}
      <VoiceSettings isOpen={showVoiceSettings} onClose={handleCloseVoiceSettings} />
    </>
  );
}

export default Header;
