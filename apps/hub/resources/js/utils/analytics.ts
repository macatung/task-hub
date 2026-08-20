/**
 * Lightweight Privacy-First Beacon Analytics Tracker
 */
export const trackEvent = (eventType: string, eventData: Record<string, any> = {}) => {
  try {
    const payload = JSON.stringify({
      event_type: eventType,
      event_data: eventData,
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/event', blob);
    } else if (typeof fetch !== 'undefined') {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Fail silently to never impact user experience
  }
};
