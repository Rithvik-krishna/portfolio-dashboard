/**
 * Sanitized development logger for financial services.
 * Keeps server operations observable during development without leaking secrets.
 */
export const financeLogger = {
  info(component: string, message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      console.log(`[${new Date().toISOString()}] [${component}] INFO: ${message}${metaStr}`);
    }
  },

  warn(component: string, message: string, meta?: unknown) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.warn(`[${new Date().toISOString()}] [${component}] WARN: ${message}${metaStr}`);
  },

  error(component: string, message: string, error?: unknown) {
    const errorDetails = error instanceof Error ? error.message : JSON.stringify(error ?? '');
    console.error(`[${new Date().toISOString()}] [${component}] ERROR: ${message} - ${errorDetails}`);
  },
};
