// src/hooks/useTripTracking.ts
// Pulse Transit - Enterprise Trip Tracking Hook

import { useState, useCallback, useRef, useEffect } from 'react';
import { TripState, type TripData, type Location, type TransitNetwork } from '../types';
import { FareEngine } from '../services/fareService';
import { BackgroundTracker } from '../services/backgroundTracker';

// ======================================================
// TYPES
// ======================================================

export interface TripMetrics {
  distance: number;
  duration: number;
  avgSpeed: number;
  maxSpeed: number;
  stopsCount: number;
  carbonSaved: number;
  caloriesBurned: number;
  efficiency: number;
  predictedETA?: number;
  fareAccuracy?: number;
}

export interface TripPlanningState {
  step: 'destination' | 'transport' | 'fare' | 'active' | 'complete';
  destination: string;
  network: TransitNetwork | null;
  estimatedFare: number | null;
  isPlanning: boolean;
  error: string | null;
  alternativeRoutes?: TripAlternative[];
}

export interface TripAlternative {
  id: string;
  network: TransitNetwork;
  estimatedFare: number;
  estimatedDuration: number;
  reason: string;
  carbonSaved: number;
}

export interface TripTrackingOptions {
  autoSaveInterval?: number;
  enableCarbonTracking?: boolean;
  enableHealthTracking?: boolean;
  enableOfflineSync?: boolean;
  enablePredictiveETA?: boolean;
  enableFareLearning?: boolean;
  debug?: boolean;
}

export interface OfflineTrip {
  trip: Partial<TripData>;
  timestamp: number;
  synced: boolean;
}

// ======================================================
// CONSTANTS
// ======================================================

const DEFAULT_OPTIONS: TripTrackingOptions = {
  autoSaveInterval: 30000,
  enableCarbonTracking: true,
  enableHealthTracking: true,
  enableOfflineSync: true,
  enablePredictiveETA: true,
  enableFareLearning: true,
  debug: false
};

const CARBON_FACTORS: Record<TransitNetwork, number> = {
  Taxi: 0.12,
  Gautrain: 0.05,
  'Rea Vaya': 0.08,
  'A Re Yeng': 0.08,
  'Tshwane Bus Service': 0.08,
  Metrorail: 0.06
};

const CALORIES_PER_KM_WALKING = 50;
const CALORIES_PER_KM_SITTING = 5;
const OFFLINE_STORAGE_KEY = 'pulse_offline_trips';
const FARE_LEARNING_KEY = 'pulse_fare_learning';

// ======================================================
// MAIN HOOK
// ======================================================

export const useTripTracking = (
  currentLocation: Location | null,
  options: TripTrackingOptions = {}
) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // STATE
  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [planning, setPlanning] = useState<TripPlanningState>({
    step: 'destination',
    destination: '',
    network: null,
    estimatedFare: null,
    isPlanning: false,
    error: null,
    alternativeRoutes: []
  });
  
  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({});
  const [metrics, setMetrics] = useState<TripMetrics>({
    distance: 0,
    duration: 0,
    avgSpeed: 0,
    maxSpeed: 0,
    stopsCount: 0,
    carbonSaved: 0,
    caloriesBurned: 0,
    efficiency: 0,
    predictedETA: undefined,
    fareAccuracy: undefined
  });
  
  const [history, setHistory] = useState<TripData[]>([]);
  const [offlineTrips, setOfflineTrips] = useState<OfflineTrip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // REFS
  const startTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const stopDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const etaUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ======================================================
  // PRIVATE HELPERS
  // ======================================================

  const log = useCallback((message: string, data?: any) => {
    if (!mergedOptions.debug) return;
    console.log(`[useTripTracking] ${message}`, data || '');
  }, [mergedOptions.debug]);

  const calculateCarbonSaved = useCallback((distance: number, network: TransitNetwork): number => {
    if (!mergedOptions.enableCarbonTracking) return 0;
    const baselineEmission = 0.21;
    const networkEmission = CARBON_FACTORS[network] || 0.1;
    return distance * (baselineEmission - networkEmission);
  }, [mergedOptions.enableCarbonTracking]);

  const calculateCaloriesBurned = useCallback((distance: number, isWalking: boolean = false): number => {
    if (!mergedOptions.enableHealthTracking) return 0;
    return isWalking 
      ? distance * CALORIES_PER_KM_WALKING
      : distance * CALORIES_PER_KM_SITTING;
  }, [mergedOptions.enableHealthTracking]);

  const calculateEfficiency = useCallback((tripMetrics: TripMetrics): number => {
    let score = 0;
    
    if (tripMetrics.avgSpeed >= 30 && tripMetrics.avgSpeed <= 60) score += 40;
    else if (tripMetrics.avgSpeed >= 20) score += 25;
    else if (tripMetrics.avgSpeed >= 10) score += 15;
    else score += 5;
    
    const stopsPerKm = tripMetrics.stopsCount / Math.max(tripMetrics.distance, 1);
    if (stopsPerKm < 0.5) score += 30;
    else if (stopsPerKm < 1) score += 20;
    else if (stopsPerKm < 2) score += 10;
    else score += 5;
    
    if (tripMetrics.carbonSaved > 0) score += 30;
    else if (tripMetrics.carbonSaved > -1) score += 15;
    else score += 5;
    
    return Math.min(100, score);
  }, []);

  const detectStops = useCallback((speeds: number[]): number => {
    let stops = 0;
    let wasStopped = false;
    
    for (const speed of speeds) {
      const isStopped = speed < 0.5;
      if (isStopped && !wasStopped) {
        stops++;
        wasStopped = true;
      } else if (!isStopped) {
        wasStopped = false;
      }
    }
    
    return stops;
  }, []);

  const predictETA = useCallback((distance: number, avgSpeed: number, remainingDistance?: number): number | undefined => {
    if (!mergedOptions.enablePredictiveETA) return undefined;
    if (avgSpeed <= 0) return undefined;
    
    const remaining = remainingDistance !== undefined ? remainingDistance : distance;
    const hoursRemaining = remaining / avgSpeed;
    const minutesRemaining = Math.round(hoursRemaining * 60);
    
    return Math.max(1, minutesRemaining);
  }, [mergedOptions.enablePredictiveETA]);

  // ======================================================
  // RESET TRIP SESSION - DEFINED FIRST
  // ======================================================

  const resetPlanning = useCallback(() => {
    setPlanning({
      step: 'destination',
      destination: '',
      network: null,
      estimatedFare: null,
      isPlanning: false,
      error: null,
      alternativeRoutes: []
    });
  }, []);

  const resetTripSession = useCallback(() => {
    setTripState(TripState.IDLE);
    setCurrentTrip({});
    setMetrics({
      distance: 0,
      duration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      stopsCount: 0,
      carbonSaved: 0,
      caloriesBurned: 0,
      efficiency: 0,
      predictedETA: undefined,
      fareAccuracy: undefined
    });
    startTimeRef.current = null;
    speedHistoryRef.current = [];
    resetPlanning();
    
    sessionStorage.removeItem('pulse_auto_save');
    log('Trip session reset');
  }, [resetPlanning, log]);

  // ======================================================
  // OFFLINE SYNC
  // ======================================================

  const saveOfflineTrip = useCallback((trip: Partial<TripData>) => {
    if (!mergedOptions.enableOfflineSync) return;
    
    const offlineTrip: OfflineTrip = {
      trip,
      timestamp: Date.now(),
      synced: false
    };
    
    setOfflineTrips(prev => {
      const updated = [...prev, offlineTrip];
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    
    log('Saved trip offline for later sync');
  }, [mergedOptions.enableOfflineSync, log]);

  const syncOfflineTrips = useCallback(async () => {
    if (!isOnline || !mergedOptions.enableOfflineSync) return;
    
    const unsynced = offlineTrips.filter(t => !t.synced);
    if (unsynced.length === 0) return;
    
    log(`Syncing ${unsynced.length} offline trips`);
    
    for (const offlineTrip of unsynced) {
      try {
        setOfflineTrips(prev =>
          prev.map(t =>
            t.timestamp === offlineTrip.timestamp ? { ...t, synced: true } : t
          )
        );
      } catch (error) {
        console.error('Failed to sync trip:', error);
      }
    }
    
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineTrips));
  }, [isOnline, offlineTrips, mergedOptions.enableOfflineSync, log]);

  // ======================================================
  // FARE LEARNING
  // ======================================================

  const learnFareAccuracy = useCallback((estimated: number, actual: number, network: TransitNetwork, distance: number) => {
    if (!mergedOptions.enableFareLearning) return;
    
    const accuracy = (actual / estimated) * 100;
    const learningData = {
      network,
      distance,
      estimated,
      actual,
      accuracy,
      timestamp: Date.now()
    };
    
    const existing = localStorage.getItem(FARE_LEARNING_KEY);
    const historyData = existing ? JSON.parse(existing) : [];
    historyData.push(learningData);
    
    if (historyData.length > 100) historyData.shift();
    localStorage.setItem(FARE_LEARNING_KEY, JSON.stringify(historyData));
    
    log('Learned fare accuracy', { network, accuracy: accuracy.toFixed(1) + '%' });
  }, [mergedOptions.enableFareLearning, log]);

  // ======================================================
  // ALTERNATIVE ROUTES
  // ======================================================

  const generateAlternatives = useCallback(async (): Promise<TripAlternative[]> => {
    const alternatives: TripAlternative[] = [];
    const networks: TransitNetwork[] = ['Taxi', 'Gautrain', 'Rea Vaya', 'Metrorail'];
    
    for (const network of networks) {
      try {
        const fareResult = await FareEngine.computeFinalFare({
          network,
          distance: 10
        });
        
        alternatives.push({
          id: `alt_${network}`,
          network,
          estimatedFare: fareResult.fare,
          estimatedDuration: network === 'Gautrain' ? 25 : 40,
          reason: network === 'Gautrain' ? 'Fastest option' : 'Most affordable',
          carbonSaved: calculateCarbonSaved(10, network)
        });
      } catch (error) {
        console.error(`Failed to generate alternative for ${network}:`, error);
      }
    }
    
    alternatives.sort((a, b) => {
      const scoreA = a.estimatedFare + a.estimatedDuration;
      const scoreB = b.estimatedFare + b.estimatedDuration;
      return scoreA - scoreB;
    });
    
    return alternatives.slice(0, 3);
  }, [calculateCarbonSaved]);

  // ======================================================
  // DURATION TIMER
  // ======================================================

  useEffect(() => {
    if (tripState === TripState.ACTIVE && startTimeRef.current) {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current && isMountedRef.current) {
          const newDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setMetrics(prev => ({ ...prev, duration: newDuration }));
          setCurrentTrip(prev => ({ ...prev, duration: newDuration }));
        }
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [tripState]);

  // ======================================================
  // ETA PREDICTION UPDATE
  // ======================================================

  useEffect(() => {
    if (tripState === TripState.ACTIVE && metrics.avgSpeed > 0) {
      if (etaUpdateIntervalRef.current) clearInterval(etaUpdateIntervalRef.current);
      
      etaUpdateIntervalRef.current = setInterval(() => {
        const eta = predictETA(metrics.distance, metrics.avgSpeed);
        setMetrics(prev => ({ ...prev, predictedETA: eta }));
      }, 30000);
    }
    
    return () => {
      if (etaUpdateIntervalRef.current) clearInterval(etaUpdateIntervalRef.current);
    };
  }, [tripState, metrics.distance, metrics.avgSpeed, predictETA]);

  // ======================================================
  // AUTO-SAVE SESSION
  // ======================================================

  useEffect(() => {
    if (tripState === TripState.ACTIVE && currentTrip.id) {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      
      autoSaveIntervalRef.current = setInterval(() => {
        if (isMountedRef.current && currentTrip.id) {
          const sessionData = {
            currentTrip,
            tripState,
            planning,
            metrics,
            timestamp: Date.now()
          };
          sessionStorage.setItem('pulse_auto_save', JSON.stringify(sessionData));
          log('Auto-saved trip session');
        }
      }, mergedOptions.autoSaveInterval || 30000);
    }
    
    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [tripState, currentTrip, planning, metrics, log, mergedOptions.autoSaveInterval]);

  // ======================================================
  // STOP DETECTION
  // ======================================================

  useEffect(() => {
    if (tripState !== TripState.ACTIVE) return;
    
    const speed = currentTrip.avgSpeed || 0;
    speedHistoryRef.current.push(speed);
    
    if (speedHistoryRef.current.length > 60) {
      speedHistoryRef.current.shift();
    }
    
    if (stopDetectionTimerRef.current) clearTimeout(stopDetectionTimerRef.current);
    
    if (speed < 0.5) {
      stopDetectionTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && speed < 0.5) {
          setMetrics(prev => ({ ...prev, stopsCount: prev.stopsCount + 1 }));
          log('Stop detected', { totalStops: metrics.stopsCount + 1 });
          
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        }
      }, 10000);
    }
    
    return () => {
      if (stopDetectionTimerRef.current) clearTimeout(stopDetectionTimerRef.current);
    };
  }, [currentTrip.avgSpeed, tripState, metrics.stopsCount, log]);

  // ======================================================
  // PUBLIC METHODS
  // ======================================================

  const setDestination = useCallback((dest: string) => {
    setPlanning(prev => ({ ...prev, destination: dest, error: null }));
  }, []);

  const setNetwork = useCallback((net: TransitNetwork | null) => {
    setPlanning(prev => ({ ...prev, network: net }));
  }, []);

  const setEstimatedFare = useCallback((fare: number | null) => {
    setPlanning(prev => ({ ...prev, estimatedFare: fare }));
  }, []);

  const setPlanningStep = useCallback((step: TripPlanningState['step']) => {
    setPlanning(prev => ({ ...prev, step }));
  }, []);

  const setError = useCallback((errorMsg: string | null) => {
    setPlanning(prev => ({ ...prev, error: errorMsg }));
  }, []);

  const findAlternatives = useCallback(async () => {
    setIsLoading(true);
    try {
      const alternatives = await generateAlternatives();
      setPlanning(prev => ({ ...prev, alternativeRoutes: alternatives }));
    } catch (error) {
      console.error('Failed to find alternatives:', error);
    } finally {
      setIsLoading(false);
    }
  }, [generateAlternatives]);

  const startTrip = useCallback(async () => {
    if (!planning.network || !currentLocation || !planning.destination) {
      setError('Missing required trip information');
      return false;
    }

    setIsLoading(true);
    
    try {
      const startTime = Date.now();
      startTimeRef.current = startTime;
      
      setTripState(TripState.ACTIVE);
      await BackgroundTracker.start();
      
      setCurrentTrip({
        id: startTime.toString(),
        network: planning.network,
        destination: planning.destination,
        startTime,
        distance: 0,
        avgSpeed: 0,
        startLocation: currentLocation,
        lastTrackedLocation: currentLocation,
        estimatedFare: planning.estimatedFare || undefined
      });
      
      setMetrics({
        distance: 0,
        duration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        stopsCount: 0,
        carbonSaved: 0,
        caloriesBurned: 0,
        efficiency: 0,
        predictedETA: undefined,
        fareAccuracy: undefined
      });
      
      setPlanning(prev => ({ ...prev, step: 'active', error: null }));
      log('Trip started', { network: planning.network, destination: planning.destination });
      
      return true;
      
    } catch (error) {
      console.error('Failed to start trip:', error);
      setError('Failed to start trip. Please try again.');
      return false;
      
    } finally {
      setIsLoading(false);
    }
  }, [planning.network, planning.destination, planning.estimatedFare, currentLocation, log]);

  const updateTripProgress = useCallback((distance: number, speed: number) => {
    if (tripState !== TripState.ACTIVE) return;
    
    setCurrentTrip(prev => ({
      ...prev,
      distance,
      avgSpeed: speed
    }));
    
    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        distance,
        avgSpeed: speed,
        maxSpeed: Math.max(prev.maxSpeed, speed),
        carbonSaved: calculateCarbonSaved(distance, planning.network || 'Taxi'),
        caloriesBurned: calculateCaloriesBurned(distance, speed < 5)
      };
      
      const efficiency = calculateEfficiency(newMetrics);
      const predictedETA = predictETA(distance, speed);
      
      return {
        ...newMetrics,
        efficiency,
        predictedETA
      };
    });
  }, [tripState, planning.network, calculateCarbonSaved, calculateCaloriesBurned, calculateEfficiency, predictETA]);

  const endTrip = useCallback(async (): Promise<TripData | null> => {
    if (!planning.network || !currentTrip.startTime) {
      setError('Cannot end trip: Missing data');
      return null;
    }

    setIsLoading(true);
    
    try {
      await BackgroundTracker.stop();
      
      const distance = currentTrip.distance || 0;
      const fareResult = await FareEngine.computeFinalFare({ 
        network: planning.network, 
        distance 
      });
      
      const finalMetrics = {
        ...metrics,
        stopsCount: detectStops(speedHistoryRef.current),
        efficiency: calculateEfficiency(metrics)
      };
      
      const completedTrip: TripData = {
        id: currentTrip.id || Date.now().toString(),
        network: planning.network,
        destination: planning.destination,
        startTime: currentTrip.startTime || Date.now(),
        endTime: Date.now(),
        duration: finalMetrics.duration,
        distance,
        fare: fareResult.fare,
        estimatedFare: currentTrip.estimatedFare,
        avgSpeed: finalMetrics.avgSpeed,
        maxSpeed: finalMetrics.maxSpeed,
        startLocation: currentTrip.startLocation,
        endLocation: currentLocation || undefined,
        lastTrackedLocation: currentTrip.lastTrackedLocation,
        stopsDetected: finalMetrics.stopsCount,
        isVerified: false,
        efficiency: finalMetrics.efficiency
      };
      
      setTripState(TripState.COMPLETED);
      
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      if (etaUpdateIntervalRef.current) clearInterval(etaUpdateIntervalRef.current);
      
      if (!isOnline) {
        saveOfflineTrip(completedTrip);
      }
      
      log('Trip ended', { distance: distance.toFixed(2), fare: fareResult.fare });
      
      return completedTrip;
      
    } catch (error) {
      console.error('Failed to end trip:', error);
      setError('Failed to end trip. Please try again.');
      return null;
      
    } finally {
      setIsLoading(false);
    }
  }, [planning.network, planning.destination, currentTrip, metrics, currentLocation, isOnline, log, detectStops, calculateEfficiency, saveOfflineTrip, setError]);

  const confirmTrip = useCallback((trip: TripData, actualFare?: string): TripData => {
    let finalFare = trip.fare;
    
    if (actualFare && actualFare.trim()) {
      const parsedFare = parseFloat(actualFare);
      if (!isNaN(parsedFare) && parsedFare > 0 && parsedFare <= 1000) {
        finalFare = parsedFare;
      }
    }
    
    const fareAccuracy = (finalFare / (trip.estimatedFare || trip.fare)) * 100;
    const accuracy = finalFare === trip.fare ? 100 : fareAccuracy;
    
    learnFareAccuracy(trip.estimatedFare || trip.fare, finalFare, trip.network, trip.distance);
    
    const verifiedTrip: TripData = {
      ...trip,
      fare: finalFare,
      isVerified: true,
      fareAccuracy: accuracy
    };
    
    setHistory(prev => [verifiedTrip, ...prev]);
    resetTripSession();
    
    log('Trip confirmed and saved', { fare: finalFare, accuracy: accuracy.toFixed(1) + '%' });
    
    return verifiedTrip;
  }, [learnFareAccuracy, log, resetTripSession]);

  const restoreAutoSave = useCallback(() => {
    const saved = sessionStorage.getItem('pulse_auto_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.currentTrip && data.tripState === TripState.ACTIVE) {
          setCurrentTrip(data.currentTrip);
          setPlanning(data.planning);
          setMetrics(data.metrics);
          setTripState(TripState.ACTIVE);
          startTimeRef.current = data.currentTrip.startTime;
          log('Restored auto-saved trip');
        }
      } catch (error) {
        console.error('Failed to restore auto-save:', error);
      }
    }
  }, [log]);

  // ======================================================
  // ONLINE/OFFLINE HANDLING
  // ======================================================

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineTrips();
      log('App back online, syncing trips');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      log('App offline, saving trips locally');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineTrips, log]);

  // ======================================================
  // CLEANUP
  // ======================================================

  useEffect(() => {
    isMountedRef.current = true;
    restoreAutoSave();
    syncOfflineTrips();
    
    return () => {
      isMountedRef.current = false;
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      if (stopDetectionTimerRef.current) clearTimeout(stopDetectionTimerRef.current);
      if (etaUpdateIntervalRef.current) clearInterval(etaUpdateIntervalRef.current);
    };
  }, [restoreAutoSave, syncOfflineTrips]);

  // ======================================================
  // RETURN API
  // ======================================================

  return {
    tripState,
    planning: {
      step: planning.step,
      destination: planning.destination,
      network: planning.network,
      estimatedFare: planning.estimatedFare,
      isPlanning: planning.isPlanning || isLoading,
      error: planning.error,
      alternativeRoutes: planning.alternativeRoutes
    },
    currentTrip,
    metrics,
    history,
    setHistory,
    offlineTrips,
    isOnline,
    
    setDestination,
    setNetwork,
    setEstimatedFare,
    setPlanningStep,
    setError,
    resetPlanning,
    findAlternatives,
    startTrip,
    updateTripProgress,
    endTrip,
    confirmTrip,
    resetTripSession,
    syncOfflineTrips,
    
    isLoading,
    isActive: tripState === TripState.ACTIVE,
    isCompleted: tripState === TripState.COMPLETED,
    canStart: !!(planning.network && currentLocation && planning.destination && !isLoading),
    
    getAverageSpeed: () => metrics.avgSpeed,
    getMaxSpeed: () => metrics.maxSpeed,
    getTotalDistance: () => metrics.distance,
    getDuration: () => metrics.duration,
    getCarbonSaved: () => metrics.carbonSaved,
    getCaloriesBurned: () => metrics.caloriesBurned,
    getStopsCount: () => metrics.stopsCount,
    getEfficiency: () => metrics.efficiency,
    getPredictedETA: () => metrics.predictedETA,
    getFareAccuracy: () => metrics.fareAccuracy,
    
    hasAlternatives: (planning.alternativeRoutes?.length || 0) > 0,
    bestAlternative: planning.alternativeRoutes?.[0],
    needsSync: offlineTrips.filter(t => !t.synced).length > 0
  };
};

