// services/habitEngine.ts

import type { TransitNetwork, Location } from "../types";

// ===============================
// TYPES
// ===============================
type Habit = {
  hour: number;

  startCluster: string;   // 🔥 location grouping
  endCluster: string;

  network: TransitNetwork;

  count: number;
  lastUsed: number;
};

type Prediction = {
  network: TransitNetwork | null;
  startCluster?: string;
  endCluster?: string;
  confidence: number;
};

// ===============================
// CONFIG
// ===============================
const STORAGE_KEY = "mzansi_habits_v3";

const CONFIG = {
  MAX_ENTRIES: 150,
  DECAY_FACTOR: 0.97,
  MIN_CONFIDENCE: 0.55,
  CLUSTER_PRECISION: 0.01 // ~1km grid
};

// ===============================
// ENGINE
// ===============================
export class HabitEngine {
  private static habits: Habit[] = [];
  private static loaded = false;

  // ===============================
  // INIT
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
  // SAVE
  // ===============================
  private static persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.habits));
    } catch {}
  }

  // ===============================
  // 🔥 LEARN (UPGRADED)
  // ===============================
  static learn(
    network: TransitNetwork,
    start: Location,
    end: Location
  ) {
    this.ensureLoaded();

    const now = Date.now();
    const hour = new Date().getHours();

    const startCluster = this.cluster(start);
    const endCluster = this.cluster(end);

    this.applyDecay();

    const existing = this.habits.find(
      h =>
        h.hour === hour &&
        h.network === network &&
        h.startCluster === startCluster &&
        h.endCluster === endCluster
    );

    if (existing) {
      existing.count += 1;
      existing.lastUsed = now;
    } else {
      this.habits.push({
        hour,
        network,
        startCluster,
        endCluster,
        count: 1,
        lastUsed: now
      });
    }

    this.trim();
    this.persist();
  }

  // ===============================
  // 🔮 PREDICT (NEXT LEVEL)
  // ===============================
  static predict(currentLocation?: Location): Prediction {
    this.ensureLoaded();

    const hour = new Date().getHours();

    let candidates = this.habits.filter(h => h.hour === hour);

    if (!candidates.length) {
      return { network: null, confidence: 0 };
    }

    // 🔥 If we know current location → filter by proximity
    if (currentLocation) {
      const currentCluster = this.cluster(currentLocation);

      const nearby = candidates.filter(
        h => h.startCluster === currentCluster
      );

      if (nearby.length) {
        candidates = nearby;
      }
    }

    const scored = candidates.map(h => {
      const recencyBoost =
        Date.now() - h.lastUsed < 24 * 60 * 60 * 1000
          ? 1.3
          : 1;

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
      startCluster: top.startCluster,
      endCluster: top.endCluster,
      confidence
    };
  }

  // ===============================
  // 🔥 CLUSTERING (CRITICAL)
  // ===============================
  private static cluster(loc: Location): string {
    const lat = Math.round(loc.lat / CONFIG.CLUSTER_PRECISION) * CONFIG.CLUSTER_PRECISION;
    const lng = Math.round(loc.lng / CONFIG.CLUSTER_PRECISION) * CONFIG.CLUSTER_PRECISION;

    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }

  // ===============================
  // DECAY
  // ===============================
  private static applyDecay() {
    this.habits.forEach(h => {
      h.count *= CONFIG.DECAY_FACTOR;
    });
  }

  // ===============================
  // TRIM
  // ===============================
  private static trim() {
    if (this.habits.length <= CONFIG.MAX_ENTRIES) return;

    this.habits.sort((a, b) => b.count - a.count);
    this.habits = this.habits.slice(0, CONFIG.MAX_ENTRIES);
  }

  // ===============================
  // RESET
  // ===============================
  static reset() {
    this.habits = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}