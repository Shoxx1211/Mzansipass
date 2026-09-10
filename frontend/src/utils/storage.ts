// frontend/src/utils/storage.ts

const Storage = {
  save: (user: string, key: string, data: unknown): void => {
    try {
      localStorage.setItem(
        `pulse_${key}_${user}`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error(`Storage save failed for ${key}:`, error);
    }
  },

  load: <T,>(user: string, key: string): T | null => {
    try {
      const raw = localStorage.getItem(`pulse_${key}_${user}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error(`Storage load failed for ${key}:`, error);
      return null;
    }
  },

  clear: (user: string, key: string): void => {
    try {
      localStorage.removeItem(`pulse_${key}_${user}`);
    } catch (error) {
      console.error(`Storage clear failed for ${key}:`, error);
    }
  },
};

export default Storage;