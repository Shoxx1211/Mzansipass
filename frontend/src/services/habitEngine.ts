// src/services/habitEngine.ts
// Pulse Transit - Premium Habit Learning Engine
// Features: Time-based patterns, confidence scoring, route suggestions, anomaly detection

import type { TransitNetwork, Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface Habit {
  hour: number;
  dayOfWeek: number; // NEW: Day-specific patterns
  startCluster: string;
  endCluster: string;
  network: TransitNetwork;
  count: number;
  lastUsed: number;
  averageFare?: number; // NEW: Track fare patterns
  typicalDuration?: number; // NEW: Track duration patterns
}

export interface Prediction {
  network: TransitNetwork | null;
  startCluster?: string;
  endCluster?: string;
  confidence: number;
  alternativeNetworks?: Array<{ network: TransitNetwork; confidence: number }>;
  estimatedDeparture?: string;
  estimatedArrival?: string;
}

export interface HabitPattern {
  timeWindow: string;
  frequency: number;
  confidence: number;
  suggestion: string;
}

export interface RouteSuggestion {
  from: string;
  to: string;
  network: TransitNetwork;
  frequency: number;
  typicalTime: string;
  typicalFare: number;
}

// ======================================================
// CONSTANTS
// ======================================================

const STORAGE_KEY = "pulse_habits_v4";

const CONFIG = {
  MAX_ENTRIES: 500,
  DECAY_FACTOR: 0.98,
  MIN_CONFIDENCE: 0.55,
  HIGH_CONFIDENCE: 0.75,
  CLUSTER_PRECISION: 0.01, // ~1km grid
  WEEK_DECAY: 0.95, // Weekend patterns decay slower
  RECENCY_BOOST_DAYS: 7,
  ANOMALY_THRESHOLD: 2.5 // Standard deviations for anomaly detection
};

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_WINDOWS = [
  { name: "Early Morning", start: 4, end: 6 },
  { name: "Morning Peak", start: 6, end: 9 },
  { name: "Mid Morning", start: 9, end: 11 },
  { name: "Lunch", start: 11, end: 13 },
  { name: "Early Afternoon", start: 13, end: 15 },
  { name: "Afternoon Peak", start: 15, end: 19 },
  { name: "Evening", start: 19, end: 22 },
  { name: "Late Night", start: 22, end: 4 }
];

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const getDayOfWeek = (): number => new Date().getDay();
const getHour = (): number => new Date().getHours();

const getTimeWindow = (hour: number): string => {
  for (const window of TIME_WINDOWS) {
    if (window.start <= window.end) {
      if (hour >= window.start && hour < window.end) return window.name;
    } else {
      // Handle overnight windows (e.g., 22-4)
      if (hour >= window.start || hour < window.end) return window.name;
    }
  }
  return "Other";
};

const isWeekend = (day: number): boolean => day === 0 || day === 6;

const getRecencyBoost = (lastUsed: number): number => {
  const daysSince = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24);
  if (daysSince < 1) return 1.5;
  if (daysSince < CONFIG.RECENCY_BOOST_DAYS) return 1.2;
  if (daysSince < 14) return 1.0;
  return 0.8;
};

// ======================================================
// MAIN ENGINE
// ======================================================

export class HabitEngine {
  private static habits: Habit[] = [];
  private static loaded = false;

  // ======================================================
  // INITIALIZATION
  // ======================================================
  
  private static ensureLoaded() {
    if (this.loaded) return;
    
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.habits = parsed;
          // Clean old entries
          const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          this.habits = this.habits.filter(h => h.lastUsed > oneMonthAgo);
        }
      }
    } catch {
      this.habits = [];
    }
    
    this.loaded = true;
  }
  
  private static persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.habits));
    } catch {}
  }
  
  // ======================================================
  // LEARN FROM TRIP
  // ======================================================
  
  static learn(
    network: TransitNetwork,
    start: Location,
    end: Location,
    fare?: number,
    duration?: number
  ) {
    this.ensureLoaded();
    
    const now = Date.now();
    const hour = getHour();
    const dayOfWeek = getDayOfWeek();
    const startCluster = this.cluster(start);
    const endCluster = this.cluster(end);
    
    this.applyDecay();
    
    const existing = this.habits.find(
      h =>
        h.hour === hour &&
        h.dayOfWeek === dayOfWeek &&
        h.network === network &&
        h.startCluster === startCluster &&
        h.endCluster === endCluster
    );
    
    if (existing) {
      existing.count += 1;
      existing.lastUsed = now;
      if (fare) existing.averageFare = (existing.averageFare || fare) * 0.7 + fare * 0.3;
      if (duration) existing.typicalDuration = (existing.typicalDuration || duration) * 0.7 + duration * 0.3;
    } else {
      this.habits.push({
        hour,
        dayOfWeek,
        network,
        startCluster,
        endCluster,
        count: 1,
        lastUsed: now,
        averageFare: fare,
        typicalDuration: duration
      });
    }
    
    this.trim();
    this.persist();
    
    console.log(`🧠 Learned habit: ${network} at ${hour}:00 on ${DAYS_OF_WEEK[dayOfWeek]}`);
  }
  
  // ======================================================
  // PREDICT NEXT TRIP
  // ======================================================
  
  static predict(currentLocation?: Location, currentTime?: Date): Prediction {
    this.ensureLoaded();
    
    const now = currentTime || new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    let candidates = this.habits.filter(h => 
      h.hour === hour && 
      (h.dayOfWeek === dayOfWeek || (isWeekend(dayOfWeek) && isWeekend(h.dayOfWeek)))
    );
    
    if (!candidates.length) {
      // Try nearby hours (±1 hour)
      candidates = this.habits.filter(h => 
        Math.abs(h.hour - hour) <= 1 &&
        (h.dayOfWeek === dayOfWeek || (isWeekend(dayOfWeek) && isWeekend(h.dayOfWeek)))
      );
    }
    
    if (!candidates.length) {
      return { network: null, confidence: 0 };
    }
    
    // Filter by current location if available
    if (currentLocation) {
      const currentCluster = this.cluster(currentLocation);
      const nearby = candidates.filter(h => h.startCluster === currentCluster);
      if (nearby.length) candidates = nearby;
    }
    
    // Score candidates
    const scored = candidates.map(h => {
      const recencyBoost = getRecencyBoost(h.lastUsed);
      const dayBoost = h.dayOfWeek === dayOfWeek ? 1.2 : 1.0;
      const score = h.count * recencyBoost * dayBoost;
      return { ...h, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    const top = scored[0];
    const total = scored.reduce((sum, h) => sum + h.score, 0);
    const confidence = total > 0 ? top.score / total : 0;
    
    // Get alternative networks
    const alternatives = scored.slice(1, 4).map(h => ({
      network: h.network,
      confidence: h.score / total
    }));
    
    // Estimate departure/arrival times
    const estimatedDeparture = this.estimateDepartureTime(hour, dayOfWeek, top.network);
    
    if (confidence < CONFIG.MIN_CONFIDENCE) {
      return { 
        network: null, 
        confidence,
        alternativeNetworks: alternatives 
      };
    }
    
    return {
      network: top.network,
      startCluster: top.startCluster,
      endCluster: top.endCluster,
      confidence,
      alternativeNetworks: alternatives,
      estimatedDeparture: estimatedDeparture?.time,
      estimatedArrival: estimatedDeparture?.arrival
    };
  }
  
  // ======================================================
  // GET HABIT PATTERNS
  // ======================================================
  
  static getHabitPatterns(): HabitPattern[] {
    this.ensureLoaded();
    
    const patterns: HabitPattern[] = [];
    const hourCounts = new Map<number, number>();
    
    for (const habit of this.habits) {
      const hour = habit.hour;
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + habit.count);
    }
    
    for (const [hour, count] of hourCounts) {
      const total = this.habits.reduce((sum, h) => sum + h.count, 0);
      const frequency = count / total;
      const confidence = Math.min(0.95, frequency);
      
      if (frequency > 0.1) {
        patterns.push({
          timeWindow: getTimeWindow(hour),
          frequency,
          confidence,
          suggestion: this.getSuggestionForTimeWindow(hour)
        });
      }
    }
    
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }
  
  // ======================================================
  // GET ROUTE SUGGESTIONS
  // ======================================================
  
  static getRouteSuggestions(limit: number = 5): RouteSuggestion[] {
    this.ensureLoaded();
    
    const routeMap = new Map<string, { habit: Habit; totalCount: number }>();
    
    for (const habit of this.habits) {
      const key = `${habit.startCluster}|${habit.endCluster}`;
      const existing = routeMap.get(key);
      
      if (existing) {
        existing.totalCount += habit.count;
      } else {
        routeMap.set(key, { habit, totalCount: habit.count });
      }
    }
    
    return Array.from(routeMap.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, limit)
      .map(({ habit, totalCount }) => ({
        from: habit.startCluster,
        to: habit.endCluster,
        network: habit.network,
        frequency: totalCount,
        typicalTime: habit.typicalDuration ? `${Math.round(habit.typicalDuration)} min` : "Unknown",
        typicalFare: habit.averageFare || 0
      }));
  }
  
  // ======================================================
  // DETECT ANOMALIES
  // ======================================================
  
  static detectAnomaly(network: TransitNetwork, start: Location, end: Location): boolean {
    this.ensureLoaded();
    
    const hour = getHour();
    const dayOfWeek = getDayOfWeek();
    const startCluster = this.cluster(start);
    const endCluster = this.cluster(end);
    
    const similarHabits = this.habits.filter(h =>
      h.network === network &&
      h.startCluster === startCluster &&
      h.endCluster === endCluster
    );
    
    if (similarHabits.length === 0) return false;
    
    const avgCount = similarHabits.reduce((sum, h) => sum + h.count, 0) / similarHabits.length;
    const stdDev = Math.sqrt(
      similarHabits.reduce((sum, h) => sum + Math.pow(h.count - avgCount, 2), 0) / similarHabits.length
    );
    
    const currentHourHabits = similarHabits.filter(h => h.hour === hour && h.dayOfWeek === dayOfWeek);
    const currentCount = currentHourHabits.reduce((sum, h) => sum + h.count, 0);
    
    return currentCount < avgCount - CONFIG.ANOMALY_THRESHOLD * stdDev;
  }
  
  // ======================================================
  // GET STATISTICS
  // ======================================================
  
  static getStats() {
    this.ensureLoaded();
    
    const totalTrips = this.habits.reduce((sum, h) => sum + h.count, 0);
    const uniqueRoutes = new Set(this.habits.map(h => `${h.startCluster}|${h.endCluster}`)).size;
    const topNetwork = this.getTopNetwork();
    
    return {
      totalTripsLearned: totalTrips,
      uniqueRoutes,
      totalHabits: this.habits.length,
      topNetwork,
      averageConfidence: this.getAverageConfidence(),
      mostActiveHour: this.getMostActiveHour()
    };
  }
  
  private static getTopNetwork(): string {
    const networkCounts = new Map<string, number>();
    for (const habit of this.habits) {
      networkCounts.set(habit.network, (networkCounts.get(habit.network) || 0) + habit.count);
    }
    
    let topNetwork = "";
    let topCount = 0;
    for (const [network, count] of networkCounts) {
      if (count > topCount) {
        topCount = count;
        topNetwork = network;
      }
    }
    return topNetwork;
  }
  
  private static getAverageConfidence(): number {
    const predictions = Array.from({ length: 24 }, (_, hour) => {
      const habitsAtHour = this.habits.filter(h => h.hour === hour);
      if (habitsAtHour.length === 0) return 0;
      const total = habitsAtHour.reduce((sum, h) => sum + h.count, 0);
      const max = Math.max(...habitsAtHour.map(h => h.count));
      return max / total;
    });
    
    return predictions.reduce((a, b) => a + b, 0) / predictions.length;
  }
  
  private static getMostActiveHour(): number {
    const hourCounts = new Map<number, number>();
    for (const habit of this.habits) {
      hourCounts.set(habit.hour, (hourCounts.get(habit.hour) || 0) + habit.count);
    }
    
    let mostActive = 0;
    let maxCount = 0;
    for (const [hour, count] of hourCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostActive = hour;
      }
    }
    return mostActive;
  }
  
  private static estimateDepartureTime(hour: number, dayOfWeek: number, _network: TransitNetwork): { time: string; arrival: string } | null {
    const isWeekendDay = isWeekend(dayOfWeek);
    let departureHour = hour;
    
    // Adjust for typical patterns
    if (hour >= 6 && hour <= 9 && !isWeekendDay) {
      departureHour = hour + 0.15; // Slight delay for peak
    }
    
    const timeStr = `${Math.floor(departureHour)}:${Math.round((departureHour % 1) * 60)}`;
    return { time: timeStr, arrival: timeStr };
  }
  
  private static getSuggestionForTimeWindow(hour: number): string {
    const window = getTimeWindow(hour);
    switch (window) {
      case "Morning Peak": return "Consider leaving 10 min earlier to avoid rush";
      case "Afternoon Peak": return "Heavy traffic expected, plan accordingly";
      case "Late Night": return "Limited transport options after 10 PM";
      default: return "Stick to your regular schedule";
    }
  }
  
  // ======================================================
  // CORE ALGORITHMS
  // ======================================================
  
  private static cluster(loc: Location): string {
    const lat = Math.round(loc.lat / CONFIG.CLUSTER_PRECISION) * CONFIG.CLUSTER_PRECISION;
    const lng = Math.round(loc.lng / CONFIG.CLUSTER_PRECISION) * CONFIG.CLUSTER_PRECISION;
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
  }
  
  private static applyDecay() {
    const now = Date.now();
    this.habits.forEach(h => {
      const daysSince = (now - h.lastUsed) / (1000 * 60 * 60 * 24);
      const decayRate = isWeekend(h.dayOfWeek) ? CONFIG.WEEK_DECAY : CONFIG.DECAY_FACTOR;
      const multiplier = Math.pow(decayRate, daysSince / 7);
      h.count = Math.max(0.5, h.count * multiplier);
    });
  }
  
  private static trim() {
    if (this.habits.length <= CONFIG.MAX_ENTRIES) return;
    
    this.habits.sort((a, b) => b.count - a.count);
    this.habits = this.habits.slice(0, CONFIG.MAX_ENTRIES);
  }
  
  // ======================================================
  // RESET
  // ======================================================
  
  static reset() {
    this.habits = [];
    localStorage.removeItem(STORAGE_KEY);
    console.log("🧠 Habit engine reset");
  }
  
  // ======================================================
  // EXPORT/IMPORT
  // ======================================================
  
  static exportHabits(): string {
    this.ensureLoaded();
    return JSON.stringify(this.habits, null, 2);
  }
  
  static importHabits(json: string) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        this.habits = parsed;
        this.persist();
        console.log("🧠 Habits imported successfully");
      }
    } catch (error) {
      console.error("Failed to import habits:", error);
    }
  }
}

// ======================================================
// EXPORT UTILITIES
// ======================================================

export { getTimeWindow, isWeekend, DAYS_OF_WEEK, TIME_WINDOWS };