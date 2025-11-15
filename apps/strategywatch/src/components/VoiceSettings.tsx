
import React, { useState, useEffect } from 'react';
import './VoiceSettings.css';
import { voiceAlerts, setVolume, setRate, setVoice, getAvailableVoices } from '../utils/voiceAlerts';

interface VoiceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ isOpen, onClose }) => {
  const [volume, setVolumeState] = useState(0.8);
  const [rate, setRateState] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const voices = getAvailableVoices();
    setAvailableVoices(voices);

    const femaleVoice = voices.find(voice =>
      voice.name.includes('Female') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen') ||
      (voice.lang.includes('en') && voice.name.includes('female'))
    );

    const defaultVoice = femaleVoice || voices[0];
    if (defaultVoice) {
      setSelectedVoice(defaultVoice);
      setVoice(defaultVoice);
    }

    setVolumeState(0.8);
    setRateState(1.0);
  }, []);

  const handleVolumeChange = (newVolume: number) => {
    setVolumeState(newVolume);
    setVolume(newVolume);
  };

  const handleRateChange = (newRate: number) => {
    setRateState(newRate);
    setRate(newRate);
  };

  const handleVoiceChange = (voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    setVoice(voice);
  };

  const testVoice = () => {
    voiceAlerts.speak('Voice settings test complete');
  };

  if (!isOpen) return null;

  return (
    <div className="voice-settings-overlay">
      <div className="voice-settings-panel">
        <div className="voice-settings-header">
          <h3>Voice Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="voice-settings-content">
          <div className="setting-group">
            <label>Voice</label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value);
                if (voice) {
                  handleVoiceChange(voice);
                }
              }}
              className="voice-select"
            >
              {availableVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label>Volume: {Math.round(volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>

          <div className="setting-group">
            <label>Speech Rate: {rate.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="rate-slider"
            />
          </div>

          <button className="test-voice-btn" onClick={testVoice}>
            Test Voice
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;

