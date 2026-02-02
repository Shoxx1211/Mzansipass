// A list of believable, diverse location names for the simulation.
const MOCK_LOCATIONS = [
  'Sandton Gautrain Station',
  'Nelson Mandela Square',
  'Rosebank Mall',
  'OR Tambo International Airport',
  'Soweto Theatre',
  'Apartheid Museum',
  'Maboneng Precinct',
  'University of Johannesburg',
  'Melville Koppies',
  'Montecasino',
  'Fourways Mall',
  'Menlyn Park',
  'Union Buildings',
  'Voortrekker Monument'
];

// Simple function to get a random item from an array
const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Simulates a reverse geocode lookup
const reverseGeocode = (lat: number, lon: number): string => {
  console.log(`Simulating reverse geocode for ${lat}, ${lon}`);
  // In a real app, this would be an API call.
  // For the demo, we just return a random mock location.
  return getRandomItem(MOCK_LOCATIONS);
};

export const getCurrentLocationName = (): Promise<string> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser. Falling back to mock data.");
      // Fallback to a mock location immediately if geolocation is not available
      setTimeout(() => resolve(getRandomItem(MOCK_LOCATIONS)), 500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Simulate an API call delay for a more realistic feel
        setTimeout(() => {
          resolve(reverseGeocode(latitude, longitude));
        }, 1200);
      },
      (error) => {
        console.warn(`Geolocation error (${error.code}): ${error.message}. Falling back to mock data.`);
        // Fallback to a mock location on error (e.g., permission denied)
        setTimeout(() => {
          resolve(getRandomItem(MOCK_LOCATIONS));
        }, 500);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
};