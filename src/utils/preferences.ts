const VIDEO_MUTED_KEY = 'videoMuted';

export function getVideoMutedPreference(): boolean {
  try {
    const raw = localStorage.getItem(VIDEO_MUTED_KEY);
    if (raw !== null) {
      return raw === 'true';
    }
  } catch (e) {
    console.warn('Failed to read video muted preference', e);
  }
  return false;
}

export function setVideoMutedPreference(isMuted: boolean) {
  try {
    localStorage.setItem(VIDEO_MUTED_KEY, isMuted ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save video muted preference', e);
  }
}
