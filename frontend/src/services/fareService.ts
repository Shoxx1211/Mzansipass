
import { TransitNetwork } from '../types';

export class FareEngine {
  static calculateBaseFare(network: TransitNetwork, distance: number): number {
    switch (network) {
      case 'Gautrain':
        return 25 + (distance * 4.5);
      case 'Rea Vaya':
      case 'A Re Yeng':
        if (distance <= 5) return 10.50;
        if (distance <= 15) return 17.50;
        return 21.00;
      case 'Tshwane Bus Service':
        return distance <= 8 ? 12.00 : 18.00;
      case 'Metrorail':
        return 9.50;
      default:
        return distance * 2;
    }
  }

  static async computeFinalFare(network: TransitNetwork, distance: number): Promise<number> {
    // Artificial delay for realism & UI thread yielding
    await new Promise(r => setTimeout(r, 200));
    return this.calculateBaseFare(network, distance);
  }
}
