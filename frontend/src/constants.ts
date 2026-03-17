
import type { TransitNetwork, ReportType, TransitRoute } from './types';

export const TRANSIT_NETWORKS: TransitNetwork[] = [
  'Gautrain',
  'Rea Vaya',
  'A Re Yeng',
  'Tshwane Bus Service',
  'Metrorail'
];

export const ROUTE_REGISTRY: TransitRoute[] = [
  // GAUTRAIN
  { id: 'gt-ns', network: 'Gautrain', code: 'NS', name: 'North-South Rail', type: 'Rail', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'Hatfield', endTerminal: 'Park' },
  { id: 'gt-h3', network: 'Gautrain', code: 'H3', name: 'Arcadia Feeder', type: 'Feeder', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'Hatfield Station', endTerminal: 'Arcadia' },
  
  // REA VAYA
  { id: 'rv-t1', network: 'Rea Vaya', code: 'T1', name: 'Soweto Trunk', type: 'Trunk', status: 'Delayed', severity: 'Moderate', lastUpdated: Date.now(), estResolution: '15m', startTerminal: 'Thokoza Park', endTerminal: 'Ellis Park' },
  { id: 'rv-c1', network: 'Rea Vaya', code: 'C1', name: 'Dobsonville Comp', type: 'Complementary', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'Dobsonville', endTerminal: 'CBD' },
  { id: 'rv-f1', network: 'Rea Vaya', code: 'F1', name: 'Naledi Feeder', type: 'Feeder', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'Naledi', endTerminal: 'Thokoza Park' },

  // A RE YENG
  { id: 'ary-t1', network: 'A Re Yeng', code: 'L1', name: 'Pretoria Trunk', type: 'Trunk', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'CBD', endTerminal: 'Hatfield' },
  { id: 'ary-f1', network: 'A Re Yeng', code: 'F1', name: 'Hatfield Loop', type: 'Feeder', status: 'Operational', severity: 'Operational', lastUpdated: Date.now(), startTerminal: 'Hatfield', endTerminal: 'Hatfield' },

  // METRORAIL
  { id: 'mr-sl', network: 'Metrorail', code: 'SOW', name: 'Soweto Rail Line', type: 'Rail', status: 'Disrupted', severity: 'Severe', lastUpdated: Date.now(), startTerminal: 'Naledi', endTerminal: 'JHB Park' }
];

export const NETWORK_RATES: Record<TransitNetwork, number> = {
  'Gautrain': 4.5,
  'Rea Vaya': 2.1,
  'A Re Yeng': 2.2,
  'Tshwane Bus Service': 1.8,
  'Metrorail': 1.2
};
