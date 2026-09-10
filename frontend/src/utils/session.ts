// frontend/src/utils/session.ts

const Session = {
  save: (key: string, data: unknown): void => {
    try {
      localStorage.setItem(
        `pulse_session_${key}`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error(`Session save failed for ${key}:`, error);
    }
  },

  load: <T,>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(`pulse_session_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error(`Session load failed for ${key}:`, error);
      return null;
    }
  },

  clear: (key: string): void => {
    try {
      localStorage.removeItem(`pulse_session_${key}`);
    } catch (error) {
      console.error(`Session clear failed for ${key}:`, error);
    }
  },

  clearAll: (): void => {
    try {
      const keys = Object.keys(localStorage);

      keys.forEach((key) => {
        if (key.startsWith("pulse_session_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Session clearAll failed:", error);
    }
  },
};

export default Session;