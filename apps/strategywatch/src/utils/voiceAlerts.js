// Voice alerts utility for StrategyWatch
// Uses Web Speech API for real-time announcements

class VoiceAlerts {
  constructor() {
    this.isMuted = false;
    this.voiceSettings = {
      voice: null, // Will be set to female voice by default
      volume: 0.8,
      rate: 1.0
    };
    this.speechSynthesis = window.speechSynthesis;
    this.voices = [];

    // Debouncing and duplicate prevention
    this.lastAnnouncement = '';
    this.lastAnnouncementTime = 0;
    this.debounceDelay = 2000; // 2 seconds between same announcements
    this.announcementQueue = new Set(); // Track pending announcements

    // Initialize voices
    this.loadVoices();

    // Reload voices when they change (Chrome bug fix)
    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = this.speechSynthesis.getVoices();

    // Set default to female voice if available
    if (this.voices.length > 0 && !this.voiceSettings.voice) {
      const femaleVoice = this.voices.find(voice =>
        voice.name.includes('Female') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Karen') ||
        (voice.lang.includes('en') && voice.name.includes('female'))
      );

      this.voiceSettings.voice = femaleVoice || this.voices[0];
    }
  }

  speak(text, immediate = false) {
    if (this.isMuted) {
      console.log('🔇 Voice is muted, skipping announcement:', text);
      return;
    }

    if (!this.speechSynthesis || !('speechSynthesis' in window)) {
      console.log('❌ Speech synthesis not supported');
      return;
    }

    // For immediate announcements (like manual tests), cancel and speak immediately
    if (immediate) {
      this.speechSynthesis.cancel();
      this.announcementQueue.clear();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voiceSettings.voice;
      utterance.volume = this.voiceSettings.volume;
      utterance.rate = this.voiceSettings.rate;
      utterance.pitch = 1.0;

      this.speechSynthesis.speak(utterance);
      return;
    }

    // Prevent duplicate announcements within debounce period
    const now = Date.now();
    const isDuplicate = text === this.lastAnnouncement && (now - this.lastAnnouncementTime) < this.debounceDelay;

    if (isDuplicate) {
      return; // Skip duplicate announcement
    }

    // Check if this announcement is already queued
    if (this.announcementQueue.has(text)) {
      return; // Skip if already queued
    }

    // Add to queue and track
    this.announcementQueue.add(text);
    this.lastAnnouncement = text;
    this.lastAnnouncementTime = now;

    // Wait for any current speech to finish naturally, then speak
    const speakWhenReady = () => {
      if (!this.speechSynthesis.speaking) {
        const utterance = new SpeechSynthesisUtterance(text);

        // Apply voice settings
        utterance.voice = this.voiceSettings.voice;
        utterance.volume = this.voiceSettings.volume;
        utterance.rate = this.voiceSettings.rate;
        utterance.pitch = 1.0;

        // Remove from queue when finished
        utterance.onend = () => {
          this.announcementQueue.delete(text);
        };

        utterance.onerror = () => {
          this.announcementQueue.delete(text);
        };

        this.speechSynthesis.speak(utterance);
      } else {
        // Wait a bit and try again
        setTimeout(speakWhenReady, 100);
      }
    };

    speakWhenReady();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    console.log('🔊 Toggle mute - New mute state:', this.isMuted);

    if (this.isMuted) {
      // Cancel current speech and clear queue when muting
      this.speechSynthesis.cancel();
      this.announcementQueue.clear();
      console.log('🔇 Voice muted - current speech cancelled and queue cleared');
    } else {
      console.log('🔊 Voice unmuted');
    }

    return this.isMuted;
  }

  setVolume(volume) {
    this.voiceSettings.volume = Math.max(0, Math.min(1, volume));
  }

  setRate(rate) {
    this.voiceSettings.rate = Math.max(0.5, Math.min(2, rate));
  }

  setVoice(voice) {
    this.voiceSettings.voice = voice;
  }

  getAvailableVoices() {
    return this.voices.filter(voice => voice.lang.includes('en'));
  }

  isSupported() {
    return 'speechSynthesis' in window;
  }
}

// Export singleton instance
export const voiceAlerts = new VoiceAlerts();

// Convenience functions for direct usage
export const announce = (text) => voiceAlerts.speak(text);
export const announceImmediate = (text) => voiceAlerts.speak(text, true);
export const toggleMute = () => voiceAlerts.toggleMute();
export const setVolume = (volume) => voiceAlerts.setVolume(volume);
export const setRate = (rate) => voiceAlerts.setRate(rate);
export const setVoice = (voice) => voiceAlerts.setVoice(voice);
export const getAvailableVoices = () => voiceAlerts.getAvailableVoices();
export const isMuted = () => voiceAlerts.isMuted;
export const isSupported = () => voiceAlerts.isSupported();