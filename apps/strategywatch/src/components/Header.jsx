import './Header.css';
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { toggleMute, isMuted, isSupported } from '../utils/voiceAlerts';
import { VoiceSettings } from './VoiceSettings';
import { runTestScenario, runAllTests, startRandomTesting, stopRandomTesting } from '../utils/orbTestConsole';

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
  const [muted, setMuted] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isRandomTesting, setIsRandomTesting] = useState(false);
  const [randomTestInterval, setRandomTestInterval] = useState(null);

  useEffect(() => {
    const supported = isSupported();
    console.log('Voice support detected:', supported);
    setVoiceSupported(supported);
    setMuted(isMuted());
  }, []);

  const handleToggleMute = () => {
    const newMutedState = toggleMute();
    setMuted(newMutedState);
  };

  const handleVoiceSettingsClick = () => {
    setShowVoiceSettings(true);
  };

  const handleCloseVoiceSettings = () => {
    setShowVoiceSettings(false);
  };

  // ORB Test handlers
  const handleTestORBConfirmed = () => {
    runTestScenario('strongBreakout');
  };

  const handleTestStrongOpening = () => {
    runTestScenario('strongOpening');
  };

  const handleRunAllTests = () => {
    runAllTests();
  };

  const handleToggleRandomTesting = () => {
    if (isRandomTesting) {
      stopRandomTesting(randomTestInterval);
      setRandomTestInterval(null);
      setIsRandomTesting(false);
    } else {
      const intervalId = startRandomTesting(3000); // Test every 3 seconds
      setRandomTestInterval(intervalId);
      setIsRandomTesting(true);
    }
  };

  // Cleanup random testing on unmount
  useEffect(() => {
    return () => {
      if (randomTestInterval) {
        stopRandomTesting(randomTestInterval);
      }
    };
  }, [randomTestInterval]);
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
            className={`voice-mute-btn ${muted ? 'muted' : 'unmuted'}`}
            onClick={handleToggleMute}
            title={muted ? 'Unmute voice alerts' : 'Mute voice alerts'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            className="voice-settings-btn"
            onClick={handleVoiceSettingsClick}
            title="Voice settings"
          >
            ⚙️
          </button>

          {/* ORB Test buttons - only show if voice is supported */}
          {voiceSupported && (
            <>
              <button
                className="orb-test-btn"
                onClick={handleTestORBConfirmed}
                title="Test 'ORB is confirmed' voice announcement"
              >
                🎯 ORB ✅
              </button>
              <button
                className="orb-test-btn"
                onClick={handleTestStrongOpening}
                title="Test 'opening candle is strong' voice announcement"
              >
                📈 Strong 🟡
              </button>
              <button
                className="orb-test-btn"
                onClick={handleRunAllTests}
                title="Run all ORB voice tests"
              >
                🧪 All Tests
              </button>
              <button
                className={`orb-test-btn ${isRandomTesting ? 'random-testing-active' : ''}`}
                onClick={handleToggleRandomTesting}
                title={isRandomTesting ? 'Stop random ORB testing' : 'Start random ORB testing'}
              >
                {isRandomTesting ? '⏹️ Stop' : '🎲 Random'}
              </button>
            </>
          )}
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
      </div>
    </header>

      {/* Voice Settings Modal */}
      <VoiceSettings isOpen={showVoiceSettings} onClose={handleCloseVoiceSettings} />
    </>
  );
}

export default Header;
