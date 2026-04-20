// services/habitEngine.ts

import type { TransitNetwork } from "../types";

// ===============================
// TYPES
// ===============================
type Habit = {
  hour: number;
  network: TransitNetwork;
  count: number;
  lastUsed: number; // 🔥 recency tracking
};

// ===============================
// CONFIG
// ===============================
const STORAGE_KEY = "mzansi_habits_v2";

const CONFIG = {
  MAX_ENTRIES: 100,
  DECAY_FACTOR: 0.98, // 🔥 older habits slowly lose weight
  MIN_CONFIDENCE: 0.6
};

// ===============================
// ENGINE
// ===============================
export class HabitEngine {
  private static habits: Habit[] = [];
  private static loaded = false;

  // ===============================
  // INIT (SAFE LOAD)
  // ===============================
  private static ensureLoaded() {
    if (this.loaded) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.habits = parsed;
        }
      }
    } catch {
      this.habits = [];
    }

    this.loaded = true;
  }

  // ===============================
  // SAVE (SAFE)
  // ===============================
  private static persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.habits));
    } catch {
      // silent fail (storage full / blocked)
    }
  }

  // ===============================
  // LEARN (IMPROVED)
  // ===============================
  static learn(network: TransitNetwork) {
    this.ensureLoaded();

    const now = Date.now();
    const hour = new Date().getHours();

    // apply decay first (important 🔥)
    this.applyDecay();

    const existing = this.habits.find(
      h => h.hour === hour && h.network === network
    );

    if (existing) {
      existing.count += 1;
      existing.lastUsed = now;
    } else {
      this.habits.push({
        hour,
        network,
        count: 1,
        lastUsed: now
      });
    }

    // 🔥 keep dataset clean
    this.trim();

    this.persist();
  }

  // ===============================
  // PREDICT (WITH CONFIDENCE)
  // ===============================
  static predict(): {
    network: TransitNetwork | null;
    confidence: number;
  } {
    this.ensureLoaded();

    const hour = new Date().getHours();

    const matches = this.habits.filter(h => h.hour === hour);

    if (!matches.length) {
      return { network: null, confidence: 0 };
    }

    // weighted score = count + recency boost
    const scored = matches.map(h => {
      const recencyBoost =
        1 + (Date.now() - h.lastUsed < 24 * 60 * 60 * 1000 ? 0.3 : 0);

      return {
        ...h,
        score: h.count * recencyBoost
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const top = scored[0];
    const total = scored.reduce((sum, h) => sum + h.score, 0);

    const confidence = total > 0 ? top.score / total : 0;

    if (confidence < CONFIG.MIN_CONFIDENCE) {
      return { network: null, confidence };
    }

    return {
      network: top.network,
      confidence
    };
  }

  // ===============================
  // DECAY OLD HABITS
  // ===============================
  private static applyDecay() {
    this.habits.forEach(h => {
      h.count *= CONFIG.DECAY_FACTOR;
    });
  }

  // ===============================
  // TRIM DATASET
  // ===============================
  private static trim() {
    if (this.habits.length <= CONFIG.MAX_ENTRIES) return;

    this.habits.sort((a, b) => b.count - a.count);
    this.habits = this.habits.slice(0, CONFIG.MAX_ENTRIES);
  }

  // ===============================
  // RESET (DEV TOOL)
  // ===============================
  static reset() {
    this.habits = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}