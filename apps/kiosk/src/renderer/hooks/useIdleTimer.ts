import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Idle seconds before the "still there?" prompt appears */
  timeoutSeconds: number;
  /** Seconds the prompt stays up before the order is abandoned */
  graceSeconds?: number;
  /** Disabled on the attract screen and during payment */
  enabled: boolean;
  onTimeout: () => void;
}

/**
 * Kiosk inactivity guard. A customer who walks away must not leave their order
 * on screen for the next person, but we warn before discarding anything rather
 * than wiping the basket silently.
 */
export function useIdleTimer({ timeoutSeconds, graceSeconds = 45, enabled, onTimeout }: Options) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(graceSeconds);
  const lastActivity = useRef(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Any touch anywhere counts as activity
  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, markActive));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setWarning(false);
      lastActivity.current = Date.now();
      return;
    }

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      setWarning(idleMs >= timeoutSeconds * 1000);
    }, 500);

    return () => clearInterval(interval);
  }, [enabled, timeoutSeconds]);

  // Countdown while the prompt is up
  useEffect(() => {
    if (!warning) {
      setSecondsLeft(graceSeconds);
      return;
    }

    setSecondsLeft(graceSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [warning, graceSeconds]);

  const keepAlive = () => {
    lastActivity.current = Date.now();
    setWarning(false);
  };

  return { warning, secondsLeft, keepAlive };
}
