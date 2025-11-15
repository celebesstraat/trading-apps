
import React, { useState } from 'react';
import './Header.css';
import { toggleMute } from '../utils/voiceAlerts';
import { VoiceSettings } from './VoiceSettings';
import { useData } from '../hooks/useData';
import { MarketStatusHeader } from '../types/types';

interface HeaderProps {
  connected: boolean;
  currentTime: string;
  marketOpen: boolean;
  marketStatus: MarketStatusHeader;
  apiConfigured: boolean;
  isHoliday?: boolean;
  isWeekend?: boolean;
  isLoading?: boolean;
}

export function Header({
  connected,
  currentTime,
  marketOpen,
  marketStatus,
  apiConfigured,
  isHoliday = false,
  isWeekend = false,
  isLoading = false
}: HeaderProps) {
  const { globalMuted, setGlobalMuted } = useData();
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
   * @param status - Market status
   * @param isHoliday - Whether today is a holiday
   * @param isWeekend - Whether today is a weekend
   * @returns CSS class name
   */
  const getMarketStatusClass = (status: string, isHoliday: boolean, isWeekend: boolean): string => {
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
   * @param status - Market status
   * @param isHoliday - Whether today is a holiday
   * @param isWeekend - Whether today is a weekend
   * @returns Display text
   */
  const getStatusDisplay = (status: string, isHoliday: boolean, isWeekend: boolean): React.ReactNode => {
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
        </div>
    </header>

      {/* Voice Settings Modal */}
      <VoiceSettings isOpen={showVoiceSettings} onClose={handleCloseVoiceSettings} />
    </>
  );
}

export default Header;
