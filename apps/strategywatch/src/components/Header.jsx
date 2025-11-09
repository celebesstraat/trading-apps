import './Header.css';
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { toggleMute, isMuted, isSupported } from '../utils/voiceAlerts';
import { VoiceSettings } from './VoiceSettings';
import { MOCK_DATA_MODE } from '../config/constants';
import { useData } from '../context/DataContext';

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
  const { globalMuted, setGlobalMuted } = useData();
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  useEffect(() => {
    const supported = isSupported();
    setVoiceSupported(supported);
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
        <div className="mode-status" title={MOCK_DATA_MODE ? 'Using simulated data for testing' : 'Using real market data'}>
          <span className={`status-dot ${MOCK_DATA_MODE ? 'warning' : 'connected'}`}></span>
          <span className="status-text">
            {MOCK_DATA_MODE ? 'TEST' : 'LIVE'}
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
