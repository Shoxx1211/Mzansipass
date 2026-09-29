// src/app/App.tsx
// Pulse Transit - Smart Commuter Intelligence Platform
// Production-oriented planner + live trip orchestration

import { useCallback, useEffect, useMemo, useState } from "react";

import AuthScreen from "../features/auth/AuthScreen";
import { Layout } from "./Layout";

import { GeminiNavigator } from "../features/navigation/GeminiNavigator";
import {
  DestinationSearch,
  type DestinationPlace,
} from "../features/planner/DestinationSearch";
import { TransportRecommendation } from "../features/planner/TransportRecommendations";
import {
  DevJourneyTestLab,
  type DevJourneyTestRequest,
} from "../features/planner/DevJourneyTestLab";
import { TripTracker } from "../features/trip/TripTracker";
import { VirtualCard } from "../features/wallet/VirtualCard";

import {
  TripState,
  type Location,
  type TabType,
  type TransitNetwork,
  type TransportRecommendation as RecommendationType,
  type TripData,
} from "../types";

import { DestinationEngine } from "../services/destinationEngine";
import { FareEngine } from "../services/fareService";
import { HabitEngine } from "../services/habitEngine";
import { RecommendationEngine } from "../services/recommendationEngine";
import { JourneyDiscoveryEngine } from "../services/journeyDiscoveryEngine";
import { UnifiedCoverageEngine, type UnifiedCoverageReport } from "../services/unifiedCoverage";
import { UnifiedCoveragePanel } from "../features/planner/UnifiedCoveragePanel";

import { useGeminiNavigation } from "../hooks/useGeminiNavigation";
import { useLocation } from "../hooks/useLocation";

import {
  BackgroundTracker,
  BackgroundTrackerError,
  type ActiveTripSession,
  type TrackerLocation,
} from "../services/backgroundTracker";

import Session from "../utils/session";
import Storage from "../utils/storage";

// ======================================================
// TYPES
// ======================================================

type PlanningStep = "destination" | "transport" | "fare";

type RouteSource =
  | "mapbox-road"
  | "destination-engine"
  | "coordinate-estimate"
  | null;

interface RoutePlanSummary {
  distanceKm: number | null;
  roadDurationSeconds: number | null;
  source: RouteSource;
}

interface MapboxDirectionsResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
}

interface SavedActiveTrip {
  currentTrip: Partial<TripData>;
  tripState: TripState;
  network: TransitNetwork | null;
  duration: number;
  destination: string;
}

// ======================================================
// CONSTANTS
// ======================================================

const EMPTY_ROUTE_PLAN: RoutePlanSummary = {
  distanceKm: null,
  roadDurationSeconds: null,
  source: null,
};

const MAPBOX_TOKEN = import.meta.env["VITE_MAPBOX_TOKEN"]?.trim() ?? "";

const TRIP_GPS_STALE_MS = 20_000;
// Hidden developer testing only: the commuter never sees GIS diagnostics.
const SHOW_NETWORK_LAB = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("networkLab") === "1";

// ======================================================
// HELPERS
// ======================================================

const toLocation = (point: TrackerLocation): Location => ({
  lat: point.lat,
  lng: point.lng,
  accuracy: point.accuracy,
  speed: point.speed,
  heading: point.heading,
  altitude: point.altitude,
  timestamp: point.timestamp,
});

const destinationToLocation = (
  place: DestinationPlace | null,
): Location | null => {
  if (
    !place ||
    place.lat === undefined ||
    place.lng === undefined
  ) {
    return null;
  }

  return {
    lat: place.lat,
    lng: place.lng,
    timestamp: Date.now(),
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof BackgroundTrackerError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${safeSeconds}s`;
};

const formatDistance = (distanceKm: number | null): string => {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return "—";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
};

const straightLineDistanceKm = (
  origin: Location,
  destination: Location,
): number => {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const dLat = toRadians(
    destination.lat - origin.lat,
  );
  const dLng = toRadians(
    destination.lng - origin.lng,
  );
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
};

const buildRoadFallbackRecommendation = (
  routePlan: RoutePlanSummary,
): RecommendationType | null => {
  if (
    routePlan.distanceKm === null ||
    !Number.isFinite(routePlan.distanceKm) ||
    routePlan.distanceKm <= 0
  ) {
    return null;
  }

  const estimatedTime =
    routePlan.roadDurationSeconds !== null &&
    Number.isFinite(
      routePlan.roadDurationSeconds,
    ) &&
    routePlan.roadDurationSeconds > 0
      ? Math.max(
          1,
          Math.round(
            routePlan.roadDurationSeconds /
              60,
          ),
        )
      : null;

  return {
    id: "road-fallback:taxi",
    mode: "Taxi",
    score: 45,
    estimatedFare: null,
    estimatedTime,
    estimatedTravelTime:
      estimatedTime,
    walkingDistance: 0,
    serviceDistanceKm:
      routePlan.distanceKm,
    routeName:
      "Road-based public transport option",
    subtitle:
      "Taxi / road connection available",
    reason:
      "Pulse can confirm a road connection to this destination. The exact minibus-taxi rank, vehicle change, route code and fare are not verified yet, so confirm those details locally before boarding.",
    badges: [
      "ROAD_ROUTE",
      "FARE_VERIFY",
    ],
    color: "#F59E0B",
    confidence: 0.55,
    dataQuality: "limited",
    direct: true,
    fareStatus: "unverified",
    timeStatus:
      estimatedTime === null
        ? "unverified"
        : "estimated",
    evidenceStatus:
      "road-baseline",
    journeyLegs: [
      {
        id: "taxi-road",
        mode: "taxi",
        label:
          "Minibus taxi / road journey",
        from: "Origin",
        to: "Destination",
        distanceKm:
          routePlan.distanceKm,
        fare: null,
        fareStatus:
          "unverified",
        evidence:
          "estimated",
      },
    ],
    selectable: true,
  };
};

const getMapboxRoadBaseline = async (
  origin: Location,
  destination: DestinationPlace,
): Promise<RoutePlanSummary | null> => {
  if (
    !MAPBOX_TOKEN ||
    destination.lat === undefined ||
    destination.lng === undefined
  ) {
    return null;
  }

  const coordinates = [
    `${origin.lng},${origin.lat}`,
    `${destination.lng},${destination.lat}`,
  ].join(";");

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    alternatives: "false",
    geometries: "geojson",
    overview: "false",
    steps: "false",
  });

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Route service returned ${response.status}`);
  }

  const data = (await response.json()) as MapboxDirectionsResponse;
  const route = data.routes?.[0];

  if (
    route?.distance === undefined ||
    !Number.isFinite(route.distance)
  ) {
    return null;
  }

  const routeDistanceKm =
    route.distance / 1000;

  const directDistanceKm =
    straightLineDistanceKm(
      origin,
      {
        lat: destination.lat,
        lng: destination.lng,
      },
    );

  const maximumPlausibleRoadKm =
    Math.max(
      directDistanceKm * 4,
      directDistanceKm + 20,
    );

  if (
    Number.isFinite(directDistanceKm) &&
    directDistanceKm > 0 &&
    routeDistanceKm >
      maximumPlausibleRoadKm
  ) {
    console.warn(
      "Rejected implausible Mapbox road baseline:",
      {
        routeDistanceKm,
        directDistanceKm,
      },
    );

    return null;
  }

  return {
    distanceKm: routeDistanceKm,
    roadDurationSeconds:
      route.duration !== undefined && Number.isFinite(route.duration)
        ? route.duration
        : null,
    source: "mapbox-road",
  };
};

// ======================================================
// APP
// ======================================================

const App = () => {
  // ====================================================
  // AUTH / NAVIGATION
  // ====================================================

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // ====================================================
  // TRIP PLANNING
  // ====================================================

  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [planningStep, setPlanningStep] =
    useState<PlanningStep>("destination");

  const [destination, setDestination] = useState("");
  const [resolvedDestination, setResolvedDestination] =
    useState<DestinationPlace | null>(null);

  // Development-only deterministic planner origin.
  // Active-trip tracking always continues to use the real GPS services.
  const [developmentOriginOverride, setDevelopmentOriginOverride] =
    useState<Location | null>(null);

  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);

  const [recommendations, setRecommendations] = useState<
    RecommendationType[]
  >([]);

  const [unifiedCoverage, setUnifiedCoverage] = useState<UnifiedCoverageReport | null>(null);

  const [selectedRecommendation, setSelectedRecommendation] =
    useState<RecommendationType | null>(null);

  const [networkEstimates, setNetworkEstimates] = useState<
    Partial<Record<TransitNetwork, number>>
  >({});

  const [routePlan, setRoutePlan] =
    useState<RoutePlanSummary>(EMPTY_ROUTE_PLAN);

  // ====================================================
  // ACTIVE TRIP
  // ====================================================

  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({});
  const [duration, setDuration] = useState(0);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [liveMaxSpeed, setLiveMaxSpeed] = useState(0);
  const [history, setHistory] = useState<TripData[]>([]);
  const [verifyTrip, setVerifyTrip] = useState<TripData | null>(null);
  const [actualFare, setActualFare] = useState("");

  const [lastTripGpsUpdate, setLastTripGpsUpdate] = useState<number | null>(
    null,
  );
  const [gpsClock, setGpsClock] = useState(Date.now());

  // ====================================================
  // UI STATE
  // ====================================================

  const [error, setError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isRetryingGps, setIsRetryingGps] = useState(false);

  // ====================================================
  // HOOKS
  // ====================================================

  const gemini = useGeminiNavigation();

  const location = useLocation({
    debug: false,
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 5_000,
    batteryOptimized: false,
    autoStart: false,

    // Do not ask for location on the login screen.
    // Once the user is authenticated, acquire ONE accurate origin fix.
    autoLocate: Boolean(user),
  });

  // Tune active-trip tracking for a more responsive live speed display.
  // The background tracker still applies its own GPS validation and drift filters.
  useEffect(() => {
    BackgroundTracker.setConfig({
      highAccuracy: true,
      updateInterval: 1500,
      distanceFilter: 5,
      batteryOptimized: false,
    });
  }, []);

  // ====================================================
  // DERIVED VALUES
  // ====================================================

  const plannerOrigin =
    import.meta.env.DEV && developmentOriginOverride
      ? developmentOriginOverride
      : location.location;

  const plannerOriginIsTest =
    import.meta.env.DEV && developmentOriginOverride !== null;

  const plannedDurationSeconds = useMemo(() => {
  if (
    selectedRecommendation?.estimatedTime !== null &&
    selectedRecommendation?.estimatedTime !== undefined &&
    Number.isFinite(selectedRecommendation.estimatedTime)
  ) {
    return Math.max(
      0,
      Math.round(selectedRecommendation.estimatedTime * 60),
    );
  }

  // Mapbox's duration is currently a driving baseline.
  // It is only safe to use as the planned trip duration for Taxi.
  if (
    network === "Taxi" &&
    routePlan.source === "mapbox-road" &&
    routePlan.roadDurationSeconds !== null &&
    routePlan.roadDurationSeconds > 0
  ) {
    return routePlan.roadDurationSeconds;
  }

  return 0;
}, [
  network,
  routePlan.roadDurationSeconds,
  routePlan.source,
  selectedRecommendation,
]);

  const trustedLiveDistanceKm = useMemo(() => {
    // Mapbox currently gives Pulse a road-driving baseline, not transit geometry.
    // Use it for live completion progress only for the road-based Taxi mode.
    if (
      network !== "Taxi" ||
      routePlan.source !== "mapbox-road" ||
      routePlan.distanceKm === null ||
      !Number.isFinite(routePlan.distanceKm) ||
      routePlan.distanceKm <= 0
    ) {
      return undefined;
    }

    return routePlan.distanceKm;
  }, [network, routePlan.distanceKm, routePlan.source]);

  const trustedLiveDurationSeconds = useMemo(() => {
    if (
      network !== "Taxi" ||
      routePlan.source !== "mapbox-road" ||
      routePlan.roadDurationSeconds === null ||
      routePlan.roadDurationSeconds <= 0
    ) {
      return undefined;
    }

    return routePlan.roadDurationSeconds;
  }, [network, routePlan.roadDurationSeconds, routePlan.source]);

  const gpsSignalLost = useMemo(() => {
    if (tripState !== TripState.ACTIVE || !lastTripGpsUpdate) {
      return false;
    }

    return gpsClock - lastTripGpsUpdate > TRIP_GPS_STALE_MS;
  }, [gpsClock, lastTripGpsUpdate, tripState]);

  const plannerGpsLabel = useMemo(() => {
    if (plannerOriginIsTest && plannerOrigin) {
      return `Test origin · ${plannerOrigin.lat.toFixed(5)}, ${plannerOrigin.lng.toFixed(5)}`;
    }

    if (location.isLocating) {
      return "Finding GPS";
    }

    if (location.location) {
      if (location.accuracy > 0) {
        return `GPS ready · ±${Math.round(location.accuracy)} m`;
      }

      return "GPS ready";
    }

    switch (location.status) {
      case "denied":
        return "Location blocked";
      case "unavailable":
        return "GPS unavailable";
      case "timeout":
        return "GPS timed out";
      case "unsupported":
        return "GPS unsupported";
      default:
        return "Waiting for GPS";
    }
  }, [
    location.accuracy,
    location.isLocating,
    location.location,
    location.status,
    plannerOrigin,
    plannerOriginIsTest,
  ]);

  const plannerGpsHealthy = Boolean(plannerOrigin);

  // ====================================================
  // RESET HELPERS
  // ====================================================

  const resetTripPlanner = useCallback(() => {
    setDestination("");
    setResolvedDestination(null);
    setDevelopmentOriginOverride(null);
    setEstimatedFare(null);
    setNetwork(null);
    setSelectedRecommendation(null);
    setRecommendations([]);
    setNetworkEstimates({});
    setRoutePlan(EMPTY_ROUTE_PLAN);
    setPlanningStep("destination");
    setError(null);
    setIsPlanning(false);
  }, []);

  const resetAllTripState = useCallback(() => {
    setVerifyTrip(null);
    setActualFare("");
    setCurrentTrip({});
    setDuration(0);
    setLiveSpeed(0);
    setLiveMaxSpeed(0);
    setTripState(TripState.IDLE);
    setLastTripGpsUpdate(null);

    resetTripPlanner();
    Session.clear("active_trip");
  }, [resetTripPlanner]);

  // ====================================================
  // DESTINATION HANDLERS
  // ====================================================

  const handleDestinationChange = useCallback(
    (value: string) => {
      setDestination(value);
      setDevelopmentOriginOverride(null);

      // If the commuter edits the text after choosing a geocoded place,
      // the old coordinates must not be reused for the new text.
      setResolvedDestination(null);
      setRecommendations([]);
      setNetworkEstimates({});
      setRoutePlan(EMPTY_ROUTE_PLAN);
      setSelectedRecommendation(null);
      setNetwork(null);
      setEstimatedFare(null);

      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const handleDestinationResolved = useCallback(
    (place: DestinationPlace) => {
      setDevelopmentOriginOverride(null);
      setResolvedDestination(place);
      setError(null);
    },
    [],
  );

  const handleDestinationSelect = useCallback((dest: string) => {
    // Gemini can set a destination by text. DestinationEngine remains
    // available as a fallback until that text is geocoded.
    setDevelopmentOriginOverride(null);
    setDestination(dest);
    setResolvedDestination(null);
    setSelectedRecommendation(null);
    setNetwork(null);
    setEstimatedFare(null);
    setRoutePlan(EMPTY_ROUTE_PLAN);
    setPlanningStep("transport");
    setActiveTab("home");
  }, []);

 const handleDevelopmentJourneyTest = useCallback(
  async (request: DevJourneyTestRequest) => {
    if (!import.meta.env.DEV) {
      return;
    }

    const testOrigin: Location = {
      ...request.origin,
      accuracy: request.origin.accuracy ?? 1,
      timestamp: Date.now(),
    };

    const testDestination: DestinationPlace = {
      ...request.destination,
      source: "manual",
    };

    setDevelopmentOriginOverride(testOrigin);
    setDestination(testDestination.name);
    setResolvedDestination(testDestination);
    setEstimatedFare(null);
    setNetwork(null);
    setSelectedRecommendation(null);
    setRecommendations([]);
    setNetworkEstimates({});
    setRoutePlan(EMPTY_ROUTE_PLAN);
    setError(null);
    setPlanningStep("transport");
    setActiveTab("home");

    // --------------------------------------------------
    // PHASE 2E DETERMINISTIC ASSERTION
    // --------------------------------------------------

    if (!request.expectedCandidate) {
      console.info(
        `[Journey Test] ${request.name}: no machine-readable expectation configured.`,
      );
      return;
    }

    const destinationLocation =
      destinationToLocation(testDestination);

    if (!destinationLocation) {
      console.error(
        `[Journey Test] ${request.name}: destination coordinates unavailable.`,
      );
      return;
    }

    try {
      const report =
        await UnifiedCoverageEngine.screen(
          testOrigin,
          destinationLocation,
          800,
        );

      setUnifiedCoverage(report);

      const expected =
        request.expectedCandidate;

      const matchingCandidate =
        report.journeyCandidates.find(
          (candidate) => {
            if (
              candidate.operatorId !==
                expected.operatorId ||
              candidate.status !==
                expected.status ||
              candidate.evidenceKind !==
                expected.evidenceKind
            ) {
              return false;
            }

            const routesMatch =
              !expected.routeCodes?.length ||
              expected.routeCodes.every(
                (routeCode) =>
                  candidate.routeCodes.includes(
                    routeCode,
                  ),
              );

            const transferStopsMatch =
              !expected.transferStopIncludes?.length ||
              expected.transferStopIncludes.every(
                (expectedStop) =>
                  candidate.transferStops.some(
                    (actualStop) =>
                      actualStop
                        .toLowerCase()
                        .includes(
                          expectedStop.toLowerCase(),
                        ),
                  ),
              );

            return (
              routesMatch &&
              transferStopsMatch
            );
          },
        );

      if (matchingCandidate) {
        console.log(
          `✅ PASS — ${request.name}`,
          {
            expected:
              request.expected,
            candidate:
              matchingCandidate,
          },
        );
      } else {
        console.error(
          `❌ FAIL — ${request.name}`,
          {
            expected:
              request.expectedCandidate,
            candidates:
              report.journeyCandidates,
          },
        );
      }
    } catch (testError) {
      console.error(
        `❌ ERROR — ${request.name}`,
        testError,
      );
    }
  },
  [],
);

  const handleSearch = useCallback(async () => {
    const cleanDestination = destination.trim();

    if (!cleanDestination) {
      setError("Please enter a destination.");
      return;
    }

    if (cleanDestination.length < 3) {
      setError("Destination must be at least 3 characters.");
      return;
    }

    setError(null);

    try {
      // A commuter route without an origin is not useful.
      // In development, Journey Test Lab may provide a deterministic origin.
      if (!plannerOrigin) {
        await location.requestCurrentLocation();
      }

      setPlanningStep("transport");
    } catch (locationError) {
      setError(
        getErrorMessage(locationError) ||
          "Pulse needs your location before it can compare public transport routes.",
      );
    }
  }, [destination, location, plannerOrigin]);

  const retryPlannerLocation = useCallback(async () => {
    setError(null);

    try {
      await location.retryLocation();
    } catch (locationError) {
      setError(getErrorMessage(locationError));
    }
  }, [location]);

  // ====================================================
  // JOURNEY PLANNING
  // ====================================================

  useEffect(() => {
    if (
      planningStep !== "transport" ||
      !destination.trim() ||
      !plannerOrigin
    ) {
      return;
    }

    let cancelled = false;

    const planJourney = async () => {
      setIsPlanning(true);
      setError(null);

      try {
        const origin = plannerOrigin;

        let effectiveDestination =
          resolvedDestination;

        if (
          !destinationToLocation(
            effectiveDestination,
          )
        ) {
          try {
            const fallbackPlace =
              await DestinationEngine.geocode(
                destination.trim(),
              );

            if (fallbackPlace) {
              effectiveDestination = {
                id:
                  `pulse-fallback:${fallbackPlace.placeId ?? destination.trim().toLowerCase()}`,
                name:
                  resolvedDestination?.name ??
                  fallbackPlace.formattedAddress,
                label:
                  resolvedDestination?.label ??
                  `${fallbackPlace.formattedAddress}, Gauteng, South Africa`,
                lat:
                  fallbackPlace.location.lat,
                lng:
                  fallbackPlace.location.lng,
                category:
                  resolvedDestination?.category,
                source: "pulse",
              };
            }
          } catch (fallbackGeocodeError) {
            console.warn(
              "Pulse fallback geocoder unavailable:",
              fallbackGeocodeError,
            );
          }
        }

        let nextRoutePlan: RoutePlanSummary = EMPTY_ROUTE_PLAN;

        // 1) Best case: resolved destination + Mapbox road geometry.
        if (effectiveDestination) {
          try {
            const mapboxPlan = await getMapboxRoadBaseline(
              origin,
              effectiveDestination,
            );

            if (mapboxPlan) {
              nextRoutePlan = mapboxPlan;
            }
          } catch (mapboxError) {
            console.warn("Mapbox route baseline unavailable:", mapboxError);
          }
        }

        // 2) Existing Pulse DestinationEngine fallback.
        // Deterministic development tests skip text fallback so the exact
        // coordinates selected in Journey Test Lab remain the source of truth.
        if (nextRoutePlan.distanceKm === null && !plannerOriginIsTest) {
          try {
            const result = await DestinationEngine.plan({
              origin,
              destination: destination.trim().toLowerCase(),
            });

            if (Number.isFinite(result.distance) && result.distance > 0) {
              nextRoutePlan = {
                distanceKm: result.distance,
                roadDurationSeconds: null,
                source: "destination-engine",
              };
            }
          } catch (destinationEngineError) {
            console.warn(
              "DestinationEngine route planning unavailable:",
              destinationEngineError,
            );
          }
        }

        // 3) Last-resort coordinate estimate. It is deliberately labelled
        // approximate in the UI and should not be mistaken for road geometry.
        if (
          nextRoutePlan.distanceKm === null &&
          effectiveDestination?.lat !== undefined &&
          effectiveDestination.lng !== undefined
        ) {
          const destinationLocation = destinationToLocation(effectiveDestination);

          if (destinationLocation) {
            nextRoutePlan = {
              distanceKm: location.calculateDistance(
                origin,
                destinationLocation,
              ),
              roadDurationSeconds: null,
              source: "coordinate-estimate",
            };
          }
        }

        if (cancelled) return;

        setRoutePlan(nextRoutePlan);

        const destinationLocation = destinationToLocation(effectiveDestination);

        // A recommendation now has to fit BOTH ends of the journey. Merely
        // finding a network near the user's origin is no longer enough.
        // Unified private coverage audit uses exactly the GPS origin and the selected destination.
        if (SHOW_NETWORK_LAB && destinationLocation) {
          try {
            const report = await UnifiedCoverageEngine.screen(origin, destinationLocation, 800);
            if (!cancelled) setUnifiedCoverage(report);
          } catch (coverageError) {
            console.warn("Private network coverage unavailable:", coverageError);
            if (!cancelled) setUnifiedCoverage(null);
          }
        } else if (!cancelled) {
          setUnifiedCoverage(null);
        }

        const baseRecommendations = RecommendationEngine.getRecommendations(
          origin,
          {
            destination,
            destinationLocation,
            routeDistanceKm: nextRoutePlan.distanceKm,
            roadDurationSeconds: nextRoutePlan.roadDurationSeconds,
            userPreferences: {
              preferFastest: false,
              preferCheapest: false,
            },
          },
        );

        let discoveryRecommendations: RecommendationType[] = [];

        if (destinationLocation) {
          try {
            discoveryRecommendations = await JourneyDiscoveryEngine.discover(
              origin,
              destinationLocation,
            );
          } catch (discoveryError) {
            console.warn(
              "Public transport discovery unavailable:",
              discoveryError,
            );
          }
        }

        const recommendationIds = new Set(
          baseRecommendations.map((recommendation) => recommendation.id),
        );

        const hasTaxiRecommendation =
          baseRecommendations.some(
            (recommendation) =>
              recommendation.mode ===
              "Taxi",
          ) ||
          discoveryRecommendations.some(
            (recommendation) =>
              recommendation.mode ===
              "Taxi",
          );

        const roadFallback =
          hasTaxiRecommendation
            ? null
            : buildRoadFallbackRecommendation(
                nextRoutePlan,
              );

        const combinedRecommendations = [
          ...baseRecommendations,
          ...discoveryRecommendations.filter(
            (recommendation) => !recommendationIds.has(recommendation.id),
          ),
          ...(roadFallback
            ? [roadFallback]
            : []),
        ]
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        const estimates: Partial<Record<TransitNetwork, number>> = {};

        // Fare calculations are now limited to route-fit recommendations, and
        // use the network leg distance rather than blindly applying the whole
        // Mapbox road distance to every transport system.
        const farePairs = await Promise.all(
          combinedRecommendations.map(async (recommendation) => {
            const networkName = recommendation.mode as TransitNetwork;

            // Evidence-only recommendations must never be priced
            // using Mapbox's road-driving distance.
            if (
              recommendation.fareStatus ===
                "unverified" ||
              (
                recommendation.fareStatus ===
                  "verified" &&
                recommendation.estimatedFare !==
                  null
              )
            ) {
              return [
                networkName,
                null,
              ] as const;
            }
            const fareDistance =
              recommendation.serviceDistanceKm ?? nextRoutePlan.distanceKm;

            if (!fareDistance || fareDistance <= 0) {
              return [networkName, null] as const;
            }

            try {
              const fareResult = await FareEngine.computeFinalFare({
                network: networkName,
                distance: fareDistance,
              });

              return [networkName, fareResult.fare] as const;
            } catch (fareError) {
              console.warn(
                `Fare estimate failed for ${networkName}:`,
                fareError,
              );

              return [networkName, null] as const;
            }
          }),
        );

        for (const [networkName, fare] of farePairs) {
          if (fare !== null && Number.isFinite(fare)) {
            estimates[networkName] = fare;
          }
        }

        if (cancelled) return;

        setNetworkEstimates(estimates);

        // Prefer the distance-derived FareEngine amount when it exists,
        // but keep the recommendation engine's own estimate as fallback.
        const enrichedRecommendations = combinedRecommendations.map((rec) => {
          const calculatedFare = estimates[rec.mode as TransitNetwork];

          if (calculatedFare === undefined) {
            return rec;
          }

          return {
            ...rec,
            estimatedFare: calculatedFare,
          };
        });

        setRecommendations(enrichedRecommendations);

        if (enrichedRecommendations.length === 0) {
          setError(
            "Pulse found the destination, but no supported public-transport route or connection is available in the current Gauteng dataset for both ends of this journey.",
          );
        }
      } catch (planningError) {
        console.error("Journey planning failed:", planningError);

        if (!cancelled) {
          setRecommendations([]);
          setNetworkEstimates({});
          setError(
            "Pulse could not build this journey right now. Check your connection and try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPlanning(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void planJourney();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    destination,
    location.calculateDistance,
    plannerOrigin,
    plannerOriginIsTest,
    planningStep,
    resolvedDestination,
  ]);

  // ====================================================
  // SELECT TRANSPORT
  // ====================================================

 const handleSelectRecommendation = useCallback(
  (rec: RecommendationType) => {
    if (rec.selectable === false) {
      setError(
        "Pulse found useful public-transport evidence for this option, but the journey still needs enough fare, timing or transfer evidence before it can be started as a tracked trip.",
      );

      return;
    }

    const selectedNetwork =
      rec.mode as TransitNetwork;

    const recalculatedFare =
      networkEstimates[selectedNetwork];

    const finalFare =
      recalculatedFare ??
      rec.estimatedFare;

    setSelectedRecommendation(rec);
    setNetwork(selectedNetwork);
    setEstimatedFare(
      finalFare !== null &&
      Number.isFinite(finalFare)
        ? finalFare
        : null,
    );
    setPlanningStep("fare");
    setError(null);
  },
  [networkEstimates],
);

  // ====================================================
  // LIVE BACKGROUND TRACKER SUBSCRIPTION
  // ====================================================

  useEffect(() => {
    const unsubscribe = BackgroundTracker.subscribe(
      (trackerLocation, trackerTrip) => {
        setLastTripGpsUpdate(Date.now());

        setLiveSpeed(Math.max(0, trackerTrip.currentSpeed));
        setLiveMaxSpeed(Math.max(0, trackerTrip.maxSpeed));

        setCurrentTrip((previous) => ({
          ...previous,
          distance: trackerTrip.totalDistance / 1000,
          avgSpeed: trackerTrip.averageSpeed,
          lastTrackedLocation: toLocation(trackerLocation),
        }));
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (tripState !== TripState.ACTIVE) {
      return;
    }

    const unsubscribe = BackgroundTracker.subscribeToTrip(
      (trackerTrip: ActiveTripSession) => {
        setDuration(Math.max(0, Math.floor(trackerTrip.duration / 1000)));
        setLiveSpeed(Math.max(0, trackerTrip.currentSpeed));
        setLiveMaxSpeed(Math.max(0, trackerTrip.maxSpeed));

        setCurrentTrip((previous) => ({
          ...previous,
          distance: trackerTrip.totalDistance / 1000,
          avgSpeed: trackerTrip.averageSpeed,
        }));
      },
    );

    return unsubscribe;
  }, [tripState]);

  // Keep a small UI clock so GPS staleness can be surfaced even when
  // no new position callback arrives.
  useEffect(() => {
    if (tripState !== TripState.ACTIVE) {
      return;
    }

    const interval = window.setInterval(() => {
      setGpsClock(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [tripState]);

  // ====================================================
  // START TRIP
  // ====================================================

  const startTrip = useCallback(async () => {
    if (!network) {
      setError("Choose a transport option before starting your journey.");
      return;
    }

    if (!destination.trim()) {
      setError("Choose a destination before starting your journey.");
      return;
    }

    if (isStartingTrip) {
      return;
    }

    setIsStartingTrip(true);
    setError(null);

    try {
      // Refresh origin at the exact moment the commuter starts travelling.
      // This avoids starting a trip with an old planning position.
      const freshOrigin = await location.requestCurrentLocation();

      // BackgroundTracker has its own validated high-accuracy trip watcher.
      // ACTIVE is set only AFTER this succeeds.
      await BackgroundTracker.start();

      const trackerTrip = BackgroundTracker.getTrip();
      const trackerLocation = BackgroundTracker.getLastKnownLocation();
      const startedAt = trackerTrip?.startedAt ?? Date.now();

      setCurrentTrip({
        id: startedAt.toString(),
        network,
        destination: destination.trim(),
        startTime: startedAt,
        distance: trackerTrip ? trackerTrip.totalDistance / 1000 : 0,
        avgSpeed: trackerTrip?.averageSpeed ?? 0,
        startLocation: freshOrigin,
        lastTrackedLocation: trackerLocation
          ? toLocation(trackerLocation)
          : freshOrigin,
      });

      setDuration(0);
      setLiveSpeed(Math.max(0, trackerTrip?.currentSpeed ?? 0));
      setLiveMaxSpeed(Math.max(0, trackerTrip?.maxSpeed ?? 0));
      setLastTripGpsUpdate(Date.now());
      setGpsClock(Date.now());
      setTripState(TripState.ACTIVE);
      setError(null);
    } catch (startError) {
      console.error("Could not start trip:", startError);

      setTripState(TripState.IDLE);
      setError(getErrorMessage(startError));
    } finally {
      setIsStartingTrip(false);
    }
  }, [
    destination,
    isStartingTrip,
    location,
    network,
  ]);

  // ====================================================
  // RETRY LIVE GPS
  // ====================================================

  const retryTripGps = useCallback(async () => {
    if (isRetryingGps) return;

    setIsRetryingGps(true);
    setError(null);

    try {
      await BackgroundTracker.restart();
      setLastTripGpsUpdate(Date.now());
      setGpsClock(Date.now());
    } catch (retryError) {
      setError(getErrorMessage(retryError));
    } finally {
      setIsRetryingGps(false);
    }
  }, [isRetryingGps]);

  // ====================================================
  // END TRIP
  // ====================================================

  const endTrip = useCallback(async () => {
    if (!currentTrip.startTime || !network) {
      return;
    }

    setError(null);

    try {
      await BackgroundTracker.stop();
    } catch (stopError) {
      // We still complete the local trip even if watcher cleanup reports
      // an error, because losing the user's completed trip is worse.
      console.warn("Tracker stop reported an error:", stopError);
    }

    const stats = BackgroundTracker.getTripStats();
    const finalTrackerLocation = BackgroundTracker.getLastKnownLocation();
    const endLocation = finalTrackerLocation
      ? toLocation(finalTrackerLocation)
      : location.location ?? currentTrip.lastTrackedLocation;

    const fare = estimatedFare ?? 0;

    const completedTrip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      duration: stats?.duration ?? duration,
      distance: stats?.distance ?? currentTrip.distance ?? 0,
      avgSpeed: stats?.avgSpeed ?? currentTrip.avgSpeed ?? 0,
      fare,
      destination: destination.trim(),
      network,
      ...(endLocation ? { endLocation } : {}),
    };

    setCurrentTrip(completedTrip);
    setVerifyTrip(completedTrip);
    setTripState(TripState.COMPLETED);
    setLiveSpeed(0);
    setLiveMaxSpeed(0);
    setLastTripGpsUpdate(null);
    Session.clear("active_trip");
  }, [
    currentTrip,
    destination,
    duration,
    estimatedFare,
    location.location,
    network,
  ]);

  // ====================================================
  // CONFIRM COMPLETED TRIP
  // ====================================================

  const confirmTrip = useCallback(() => {
    if (!verifyTrip) {
      return;
    }

    let finalFare = verifyTrip.fare;

    if (actualFare.trim()) {
      const parsedFare = Number.parseFloat(actualFare);

      if (
        Number.isFinite(parsedFare) &&
        parsedFare > 0 &&
        parsedFare <= 1000
      ) {
        finalFare = parsedFare;
      }
    }

    const finalTrip: TripData = {
      ...verifyTrip,
      fare: finalFare,
    };

    setHistory((previous) => {
      const updated = [finalTrip, ...previous];

      if (user?.email) {
        Storage.save(user.email, "history", updated);
      }

      return updated;
    });

    resetAllTripState();
  }, [actualFare, resetAllTripState, user, verifyTrip]);

  // ====================================================
  // FALLBACK DURATION TIMER
  // ====================================================

  useEffect(() => {
    if (
      tripState !== TripState.ACTIVE ||
      !currentTrip.startTime
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!currentTrip.startTime) return;

      setDuration(
        Math.floor((Date.now() - currentTrip.startTime) / 1000),
      );
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentTrip.startTime, tripState]);

  // ====================================================
  // HABIT LEARNING
  // ====================================================

  useEffect(() => {
    if (
      verifyTrip?.network &&
      verifyTrip.startLocation &&
      verifyTrip.endLocation
    ) {
      HabitEngine.learn(
        verifyTrip.network,
        verifyTrip.startLocation,
        verifyTrip.endLocation,
        verifyTrip.fare,
        verifyTrip.duration,
      );
    }
  }, [verifyTrip]);

  // ====================================================
  // LOAD USER / HISTORY
  // ====================================================

  useEffect(() => {
    const savedUser = Session.load("user");

    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    Session.save("user", user);

    if (user.email) {
      const savedHistory = Storage.load<TripData[]>(
        user.email,
        "history",
      );

      if (savedHistory) {
        setHistory(savedHistory);
      }
    }
  }, [user]);

  // ====================================================
  // SAVE ACTIVE TRIP
  // ====================================================

  useEffect(() => {
    if (
      tripState !== TripState.ACTIVE ||
      !currentTrip.id
    ) {
      return;
    }

    const session: SavedActiveTrip = {
      currentTrip,
      tripState,
      network,
      duration,
      destination,
    };

    Session.save("active_trip", session);
  }, [currentTrip, destination, duration, network, tripState]);

  // ====================================================
  // GEMINI NAVIGATOR TAB
  // ====================================================

  useEffect(() => {
    if (activeTab === "navigate") {
      gemini.openNavigator();
    } else {
      gemini.closeNavigator();
    }
  }, [activeTab, gemini.closeNavigator, gemini.openNavigator]);

  // ====================================================
  // AUTH SCREEN
  // ====================================================

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <>
      <Layout activeTab={activeTab} onNavClick={setActiveTab}>
        <div className="mx-auto w-full max-w-7xl">
          <div
            className="relative z-10 min-h-[100dvh] space-y-6 px-4 pb-40 md:px-8 lg:px-12"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
            }}
          >
            {/* ==================================================
                HOME TAB
            ================================================== */}

            {activeTab === "home" && (
              <>
                {/* HERO */}

                {tripState !== TripState.ACTIVE && !verifyTrip && (
                  <div className="space-y-3 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-white/40">
                          Smart commuter intelligence
                        </p>

                        <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                          Where are you going?
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                          Compare public transport by cost and travel time,
                          then track your real journey with live GPS.
                        </p>
                      </div>

                      <div
                        className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur-xl ${
                          plannerGpsHealthy
                            ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
                            : location.error
                              ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-100"
                              : "border-white/10 bg-white/[0.04] text-white/55"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            plannerGpsHealthy
                              ? "bg-emerald-400"
                              : location.isLocating
                                ? "animate-pulse bg-cyan-400"
                                : "bg-amber-400"
                          }`}
                        />

                        <span>{plannerGpsLabel}</span>
                      </div>
                    </div>

                    {location.error && !plannerOrigin && (
                      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-amber-100/90">
                            We need your location to plan from where you are
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-100/55">
                            {location.error}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void retryPlannerLocation()}
                          disabled={location.isLocating}
                          className="min-h-10 shrink-0 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-50"
                        >
                          {location.isLocating ? "Finding GPS..." : "Try GPS again"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIVE TRIP */}

                {tripState === TripState.ACTIVE && (
                  <div className="space-y-4 pt-4">
                    {gpsSignalLost && (
                      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-amber-100">
                            GPS signal lost
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-100/55">
                            Your trip is still active. Make sure Location/GPS is
                            turned on, then retry.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void retryTripGps()}
                          disabled={isRetryingGps}
                          className="min-h-10 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-50"
                        >
                          {isRetryingGps ? "Reconnecting..." : "Retry GPS"}
                        </button>
                      </div>
                    )}

                    <TripTracker
                      network={network}
                      destination={destination}
                      distance={currentTrip.distance || 0}
                      duration={duration}
                      speed={liveSpeed}
                      avgSpeed={currentTrip.avgSpeed || 0}
                      maxSpeed={liveMaxSpeed}
                      startTime={currentTrip.startTime}
                      expectedDistance={trustedLiveDistanceKm}
                      expectedDurationSeconds={trustedLiveDurationSeconds}
                      gpsStatus={gpsSignalLost ? "stale" : "active"}
                      onEndTrip={endTrip}
                    />
                  </div>
                )}

                {/* PLANNING */}

                {tripState !== TripState.ACTIVE && !verifyTrip && (
                  <>
                    {error && (
                      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4">
                        <p className="text-sm leading-6 text-red-200">
                          {error}
                        </p>
                      </div>
                    )}

                    {/* STEP 1: DESTINATION */}

                    {planningStep === "destination" && (
                      <div className="space-y-4">
                        <DestinationSearch
                          destination={destination}
                          setDestination={handleDestinationChange}
                          onSearch={() => void handleSearch()}
                          loading={location.isLocating && !plannerOriginIsTest}
                          enableVoiceSearch={true}
                          showRecentSearches={true}
                          showFavorites={true}
                          userHome={user?.homeArea}
                          userWork={user?.workArea}
                          currentLocation={plannerOrigin}
                          onDestinationResolved={handleDestinationResolved}
                        />

                        {SHOW_NETWORK_LAB && <DevJourneyTestLab onRun={handleDevelopmentJourneyTest} />}
                      </div>
                    )}

                    {/* STEP 2: TRANSPORT */}

                    {planningStep === "transport" && (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-1">
                          <div className="glass rounded-3xl p-5 lg:sticky lg:top-24 lg:p-6">
                            <button
                              type="button"
                              onClick={() => {
                                setPlanningStep("destination");
                                setError(null);
                              }}
                              className="mb-5 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                            >
                              ← Change destination
                            </button>

                            <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                              Journey
                            </p>

                            <h2 className="mt-2 text-2xl font-black text-white">
                              {destination}
                            </h2>

                            {resolvedDestination?.label &&
                              resolvedDestination.label !== destination && (
                                <p className="mt-2 text-xs leading-5 text-white/40">
                                  {resolvedDestination.label}
                                </p>
                              )}

                            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-1">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                <p className="text-[10px] uppercase tracking-wider text-white/35">
                                  {routePlan.source === "mapbox-road"
  ? "Road baseline"
  : routePlan.source === "coordinate-estimate"
    ? "Straight-line estimate"
    : "Planning distance"}
                                </p>
                                <p className="mt-1 text-2xl font-black text-white">
                                  {isPlanning
                                    ? "…"
                                    : formatDistance(routePlan.distanceKm)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                <p className="text-[10px] uppercase tracking-wider text-white/35">
                                  Options found
                                </p>
                                <p className="mt-1 text-2xl font-black text-cyan-300">
                                  {isPlanning ? "…" : recommendations.length}
                                </p>
                              </div>

                              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                                      GPS origin
                                    </p>
                                    <p
                                      className={`mt-1 text-sm font-bold ${
                                        plannerOrigin
                                          ? plannerOriginIsTest
                                            ? "text-violet-200"
                                            : "text-emerald-300"
                                          : "text-amber-200"
                                      }`}
                                    >
                                      {plannerGpsLabel}
                                    </p>
                                  </div>

                                  {!plannerOrigin && (
                                    <button
                                      type="button"
                                      onClick={() => void retryPlannerLocation()}
                                      className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/70"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {routePlan.source === "coordinate-estimate" && (
                              <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-xs leading-5 text-amber-100/60">
                                Distance is provisional until live Mapbox routing
                                is enabled.
                              </p>
                            )}

                            {routePlan.source === "mapbox-road" && (
                              <p className="mt-4 text-xs leading-5 text-white/35">
                                {plannerOriginIsTest
                                  ? "Road baseline resolved from deterministic development coordinates. Public-transport evidence remains independent of that driving baseline."
                                  : "Route geometry resolved from your GPS origin to the selected destination. Public-transport ETAs are shown separately on each option."}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="max-w-4xl lg:col-span-2">
                          {SHOW_NETWORK_LAB && <UnifiedCoveragePanel report={unifiedCoverage} />}

                          <TransportRecommendation
                            recommendations={recommendations}
                            selected={selectedRecommendation}
                            onSelect={handleSelectRecommendation}
                            isLoading={isPlanning}
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 3: FARE / START */}

                    {planningStep === "fare" && selectedRecommendation && (
                      <div className="space-y-5 pb-32">
                        <button
                          type="button"
                          onClick={() => {
                            setPlanningStep("transport");
                            setError(null);
                          }}
                          className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                        >
                          ← Compare other options
                        </button>

                        {selectedRecommendation.journeyLegs?.length ? (
                          <div className="glass rounded-3xl p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                                  Journey plan
                                </p>
                                <h3 className="mt-1 break-words text-lg font-black text-white">
                                  {selectedRecommendation.routeName ?? destination}
                                </h3>
                              </div>

                              {selectedRecommendation.direct === false && (
                                <span className="shrink-0 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                                  Multi-modal
                                </span>
                              )}
                            </div>

                            <div className="mt-5">
                              {selectedRecommendation.journeyLegs.map((leg, index) => {
                                const isLast =
                                  index ===
                                  selectedRecommendation.journeyLegs!.length - 1;

                                return (
                                  <div
                                    key={leg.id}
                                    className="relative flex gap-4"
                                  >
                                    <div className="flex w-8 shrink-0 flex-col items-center">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                        {index + 1}
                                      </div>

                                      {!isLast && (
                                        <div className="min-h-8 w-px flex-1 bg-gradient-to-b from-cyan-400/35 to-violet-400/20" />
                                      )}
                                    </div>

                                    <div className={isLast ? "pb-1" : "pb-5"}>
                                      <p className="text-sm font-bold text-white">
                                        {leg.label}
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-white/40">
                                        {leg.from ?? "Origin"}
                                        {" -> "}
                                        {leg.to ?? "Destination"}
                                      </p>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {leg.distanceKm !== undefined &&
                                          leg.distanceKm !== null && (
                                            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-white/45">
                                              {formatDistance(leg.distanceKm)}
                                            </span>
                                          )}

                                        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-white/45">
                                          {leg.fare !== undefined &&
                                          leg.fare !== null
                                            ? `R${leg.fare.toFixed(2)}`
                                            : "Fare to confirm"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
                          <VirtualCard
                            state={tripState}
                            network={network}
                            destination={destination}
                            distance={routePlan.distanceKm ?? 0}
                            duration={plannedDurationSeconds}
                            estimatedFare={estimatedFare ?? undefined}
                            variant="compact"
                            showTilt={false}
                          />

                          <div className="glass rounded-3xl p-5">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                              Before you go
                            </p>

                            <div className="mt-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-sm text-white/45">
                                  Primary network
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {network}
                                </span>
                              </div>

                              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-sm text-white/45">
                                  Distance
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {formatDistance(routePlan.distanceKm)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-sm text-white/45">
                                  Est. time
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {plannedDurationSeconds > 0
                                    ? formatDuration(plannedDurationSeconds)
                                    : "Not verified"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white/45">
                                  Est. fare
                                </span>
                                <span
                                  className={
                                    estimatedFare !== null
                                      ? "text-lg font-black text-emerald-300"
                                      : "text-sm font-bold text-amber-200"
                                  }
                                >
                                  {estimatedFare !== null
                                    ? `R${estimatedFare.toFixed(2)}`
                                    : "Not verified"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="sticky bottom-4 z-40 pt-3">
                          <button
                            type="button"
                            onClick={() => void startTrip()}
                            disabled={isStartingTrip}
                            className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-lg font-black text-white shadow-xl shadow-emerald-500/20 transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                          >
                            {isStartingTrip ? (
                              <>
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                Starting GPS tracker...
                              </>
                            ) : (
                              <>Start journey</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* VERIFY COMPLETED TRIP */}

                {verifyTrip && (
                  <div className="space-y-5 pb-32 pt-4">
                    <div className="glass rounded-3xl p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-300">
                            Journey complete
                          </p>

                          <h2 className="mt-1 text-3xl font-black text-white">
                            {verifyTrip.destination}
                          </h2>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs uppercase tracking-wider text-white/35">
                            Estimated fare
                          </p>
                          <p className="mt-1 text-4xl font-black text-white">
                            {verifyTrip.fare > 0
                              ? `R${verifyTrip.fare.toFixed(2)}`
                              : "Not entered"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
                          <p className="text-[10px] uppercase text-white/30">
                            Distance
                          </p>
                          <p className="mt-1 font-bold text-white">
                            {(verifyTrip.distance || 0).toFixed(2)} km
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
                          <p className="text-[10px] uppercase text-white/30">
                            Time
                          </p>
                          <p className="mt-1 font-bold text-white">
                            {formatDuration(verifyTrip.duration || 0)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
                          <p className="text-[10px] uppercase text-white/30">
                            Avg speed
                          </p>
                          <p className="mt-1 font-bold text-white">
                            {(verifyTrip.avgSpeed || 0).toFixed(1)} km/h
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40">
                          Actual fare paid (optional)
                        </label>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={actualFare}
                          onChange={(event) => {
                            const value = event.target.value;

                            if (value === "" || /^\d*\.?\d*$/.test(value)) {
                              setActualFare(value);
                            }
                          }}
                          placeholder="Enter actual fare"
                          className="h-14 w-full rounded-2xl border-2 border-white/15 bg-white/[0.06] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400"
                        />

                        <p className="text-[10px] text-white/30">
                          If Pulse did not have a verified fare, enter what you actually paid.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={confirmTrip}
                        className="mt-5 h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-black text-white transition hover:scale-[1.01] active:scale-[0.99]"
                      >
                        Save trip
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ==================================================
                STATS TAB
            ================================================== */}

            {activeTab === "stats" && (
              <div className="space-y-4 pb-8 pt-4">
                <div>
                  <p className="text-sm text-white/40">Your commuting</p>
                  <h1 className="mt-1 text-3xl font-black text-white">
                    Travel stats
                  </h1>
                </div>

                {history.length === 0 ? (
                  <div className="glass rounded-3xl p-8 text-center">
                    <p className="text-lg font-bold text-white/70">
                      No trips yet
                    </p>
                    <p className="mt-2 text-sm text-white/35">
                      Complete your first journey and Pulse will start building
                      your commuter intelligence.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="glass rounded-3xl bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          Total spend
                        </p>
                        <p className="mt-1 text-3xl font-black text-white">
                          R
                          {history
                            .reduce((sum, trip) => sum + (trip.fare || 0), 0)
                            .toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-white/30">
                          Across {history.length} completed trip
                          {history.length === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="glass rounded-3xl p-4">
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          Distance logged
                        </p>
                        <p className="mt-1 text-3xl font-black text-white">
                          {history
                            .reduce(
                              (sum, trip) => sum + (trip.distance || 0),
                              0,
                            )
                            .toFixed(1)}
                          <span className="ml-1 text-sm text-white/35">km</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {history.map((trip) => (
                        <div
                          key={trip.id}
                          className="glass rounded-3xl p-4 transition hover:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-bold text-white">
                                {trip.network}
                              </p>

                              {trip.destination && (
                                <p className="mt-0.5 text-xs text-white/40">
                                  ðŸ“ {trip.destination}
                                </p>
                              )}
                            </div>

                            <p className="text-lg font-black text-emerald-300">
                              R{(trip.fare || 0).toFixed(2)}
                            </p>
                          </div>

                          <p className="mt-2 text-xs text-white/35">
                            {new Date(trip.startTime).toLocaleString()}
                          </p>

                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <p className="text-white/30">Distance</p>
                              <p className="mt-1 font-bold text-white/75">
                                {(trip.distance || 0).toFixed(2)} km
                              </p>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <p className="text-white/30">Time</p>
                              <p className="mt-1 font-bold text-white/75">
                                {formatDuration(trip.duration || 0)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <p className="text-white/30">Avg speed</p>
                              <p className="mt-1 font-bold text-white/75">
                                {(trip.avgSpeed || 0).toFixed(1)} km/h
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout>

      {/* ====================================================
          GEMINI NAVIGATOR
      ==================================================== */}

      <GeminiNavigator
        isOpen={gemini.isOpen}
        onClose={gemini.closeNavigator}
        query={gemini.query}
        setQuery={gemini.setQuery}
        response={gemini.response}
        isLoading={gemini.isLoading}
        error={gemini.error}
        onAsk={gemini.askGemini}
        currentLocation={location.location}
        destination={destination}
        onSetDestination={handleDestinationSelect}
      />
    </>
  );
};

export default App;
