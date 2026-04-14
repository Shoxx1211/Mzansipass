import type { Location } from '../types';

// ===============================
// GET CURRENT LOCATION (ROBUST)
// ===============================
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        let message = 'Location error';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'User denied location access';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  });
};

// ===============================
// WATCH LOCATION (REAL-TIME TRACKING)
// ===============================
export const watchLocation = (
  onUpdate: (loc: Location) => void,
  onError?: (err: any) => void
): number => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported');
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      const loc: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };

      onUpdate(loc);
    },
    (error) => {
      if (onError) onError(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 15000
    }
  );
};

// ===============================
// STOP WATCHING LOCATION
// ===============================
export const clearLocationWatch = (watchId: number) => {
  navigator.geolocation.clearWatch(watchId);
};

// ===============================
// DISTANCE CALCULATION (HAVERSINE)
// ===============================
export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371; // Earth radius in km

  const dLat = deg2rad(loc2.lat - loc1.lat);
  const dLon = deg2rad(loc2.lng - loc1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(loc1.lat)) *
      Math.cos(deg2rad(loc2.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// ===============================
// SPEED CALCULATION (km/h)
// ===============================
export const calculateSpeed = (
  loc1: Location,
  loc2: Location
): number => {
  if (!loc1.timestamp || !loc2.timestamp) return 0;

  const distance = calculateDistance(loc1, loc2); // km
  const timeDiff = (loc2.timestamp - loc1.timestamp) / 1000 / 3600; // hours

  if (timeDiff === 0) return 0;

  return distance / timeDiff;
};

// ===============================
// SMART MOVEMENT DETECTION
// ===============================
export const isUserMoving = (
  loc1: Location,
  loc2: Location
): boolean => {
  const speed = calculateSpeed(loc1, loc2);

  // 🚶 walking ≈ 3–6 km/h
  // 🚗 transport > 10 km/h
  return speed > 8;
};

// ===============================
// FILTER GPS NOISE (VERY IMPORTANT)
// ===============================
export const isValidMovement = (
  loc1: Location,
  loc2: Location
): boolean => {
  const distance = calculateDistance(loc1, loc2);

  // Ignore tiny GPS jumps (< 10 meters)
  return distance > 0.01;
};

// ===============================
// HELPER
// ===============================
const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};