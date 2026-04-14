import type { TransitNetwork } from "../types";

type Habit = {
  hour: number;
  network: TransitNetwork;
  count: number;
};

export class HabitEngine {
  private static habits: Habit[] = [];

  static learn(network: TransitNetwork) {
    const hour = new Date().getHours();

    const existing = this.habits.find(
      h => h.hour === hour && h.network === network
    );

    if (existing) {
      existing.count++;
    } else {
      this.habits.push({ hour, network, count: 1 });
    }

    localStorage.setItem("mzansi_habits", JSON.stringify(this.habits));
  }

  static load() {
    const raw = localStorage.getItem("mzansi_habits");
    if (raw) this.habits = JSON.parse(raw);
  }

  static predict(): TransitNetwork | null {
    const hour = new Date().getHours();

    const matches = this.habits.filter(h => h.hour === hour);

    if (!matches.length) return null;

    return matches.sort((a, b) => b.count - a.count)[0].network;
  }
}