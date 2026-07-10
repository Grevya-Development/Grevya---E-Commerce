const enabled = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === 'true';

export const authDebug = (event: string, details?: Record<string, unknown>) => {
  if (!enabled) return;
  console.info(`[auth] ${event}`, details || {});
};
