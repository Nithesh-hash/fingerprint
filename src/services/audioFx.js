// Audio effects disabled per user preference
export const soundManager = {
  getMuted() {
    return true;
  },
  toggleMute() {
    return true;
  },
  setMuted() {},
  playClick() {},
  playScanSweep() {
    return null;
  },
  playSuccessChime() {},
  playWarning() {},
  playConnect() {},
  playDisconnect() {}
};
