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

import {
  TripState,
  type Location,
  type TabType,
  type TransitNetwork,
  type TransportRecommendation as RecommendationType,
  type TripData,
  type TrackedJourneyLeg,
} from "../types";

import { DestinationEngine } from "../services/destinationEngine";
import { FareEngine, getTaxiFareGuide } from "../services/fareService";
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
import { AuthApi, type PassengerAccount } from "../services/authApi";

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
  fareGuideIsApplicable: boolean,
): RecommendationType | null => {
  if (
    routePlan.distanceKm === null ||
    !Number.isFinite(routePlan.distanceKm) ||
    routePlan.distanceKm <= 0
  ) {
    return null;
  }

  // Early fare guide from broad, locally configured bands, NOT a quote.
  const taxiGuide =
    routePlan.source === "mapbox-road" && fareGuideIsApplicable
      ? getTaxiFareGuide(routePlan.distanceKm)
      : null;

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
    estimatedFare: taxiGuide?.midpoint ?? null,
    fareEstimateRange: taxiGuide
      ? { minimum: taxiGuide.minimum, maximum: taxiGuide.maximum, basis: "provisional-taxi" }
      : undefined,
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
      "This is an indicative minibus-taxi cost band based on provisional distance groups, not an association's published fare. A mapped road is not proof of a direct taxi route. Confirm the actual route, taxi changes and fare at the rank.",
    badges: [
      "ROAD_ROUTE",
      "FARE_VERIFY",
    ],
    color: "#F59E0B",
    confidence: 0.55,
    dataQuality: "limited",
    direct: true,
    fareStatus: taxiGuide ? "estimated" : "unverified",
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
        fare: taxiGuide?.midpoint ?? null,
        fareStatus:
          taxiGuide ? "estimated" : "unverified",
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

  const [user, setUser] = useState<PassengerAccount | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
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
  const [legChangeFare, setLegChangeFare] = useState("");
  const [showLegChangeForm, setShowLegChangeForm] = useState(false);
  const [remindAfterDistanceKm, setRemindAfterDistanceKm] = useState(0);

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

  const trackedJourneyLegs = currentTrip.legs ?? [];
  const activeJourneyLegIndex = trackedJourneyLegs.findIndex(
    (leg) => leg.endedAt === undefined,
  );
  const activeJourneyLeg =
    activeJourneyLegIndex >= 0
      ? trackedJourneyLegs[activeJourneyLegIndex]
      : null;
  const nextJourneyLeg =
    activeJourneyLegIndex >= 0
      ? trackedJourneyLegs[activeJourneyLegIndex + 1] ?? null
      : null;
  const activeLegDistanceKm = activeJourneyLeg
    ? Math.max(0, (currentTrip.distance ?? 0) - activeJourneyLeg.startDistanceKm)
    : 0;
  const nearSuggestedTransfer =
    nextJourneyLeg !== null &&
    activeJourneyLeg !== null &&
    typeof activeJourneyLeg.plannedDistanceKm === "number" &&
    activeJourneyLeg.plannedDistanceKm > 0 &&
    activeLegDistanceKm >= activeJourneyLeg.plannedDistanceKm * 0.9 &&
    (currentTrip.distance ?? 0) >= remindAfterDistanceKm;

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
    setRoutePlan(EMPTY_ROUTE_PLAN);
    setPlanningStep("destination");
    setError(null);
    setIsPlanning(false);
  }, []);

  const resetAllTripState = useCallback(() => {
    setVerifyTrip(null);
    setActualFare("");
    setLegChangeFare("");
    setShowLegChangeForm(false);
    setRemindAfterDistanceKm(0);
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
                  fallbackPlace.formattedAddress,
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
              "Taxi" &&
              recommendation.selectable !== false,
          ) ||
          discoveryRecommendations.some(
            (recommendation) =>
              recommendation.mode === "Taxi" &&
              recommendation.selectable !== false,
          );

        const roadFallback =
          hasTaxiRecommendation
            ? null
            : buildRoadFallbackRecommendation(
                nextRoutePlan,
                // Current seed taxi bands are a GAUTENG pilot guide; do not
                // pretend we have local price data across all nine provinces.
                Boolean(
                  destinationLocation &&
                  [origin, destinationLocation].every((point) =>
                    point.lat >= -26.95 && point.lat <= -24.95 &&
                    point.lng >= 27.1 && point.lng <= 29.5,
                  ),
                ),
              );

        const rankedRecommendations = [
          ...baseRecommendations,
          ...discoveryRecommendations.filter(
            (recommendation) => !recommendationIds.has(recommendation.id),
          ),
          ...(roadFallback ? [roadFallback] : []),
        ].sort((a, b) => b.score - a.score);

        const combinedRecommendations = rankedRecommendations.slice(0, 10);
        // The taxi road possibility is useful even without an indexed route:
        // retain it instead of losing it to many GIS-only candidates.
        if (roadFallback && !combinedRecommendations.some((rec) => rec.id === roadFallback.id)) {
          combinedRecommendations[combinedRecommendations.length - 1] = roadFallback;
        }

        // Fare pricing is per option, NEVER a shared operator-wide cache:
        // two taxi or bus candidates may have different distances.
        const enrichedRecommendations = await Promise.all(
          combinedRecommendations.map(async (rec): Promise<RecommendationType> => {
            const hasMultipleLegs = (rec.journeyLegs?.length ?? 0) > 1;
            if (hasMultipleLegs) return rec;

            // No current stop/timetable evidence: do not synthesize a fare.
            if (rec.mode !== "Taxi" && rec.fareStatus === "unverified") {
              return rec;
            }
            if (rec.fareStatus === "verified" && rec.estimatedFare !== null) {
              return rec;
            }
            const serviceKm = rec.serviceDistanceKm;
            if (serviceKm === undefined || !Number.isFinite(serviceKm) || serviceKm <= 0) {
              return rec;
            }

            // A coordinate-only baseline does not prove taxi road length.
            if (rec.mode === "Taxi" && rec.id === "road-fallback:taxi" &&
                nextRoutePlan.source !== "mapbox-road") {
              return rec;
            }

            try {
              const fareResult = await FareEngine.computeFinalFare({
                network: rec.mode,
                distance: serviceKm,
              });

              const observedGuide =
                rec.mode === "Taxi" && fareResult.source === "learned"
                  ? {
                      minimum: Math.max(5, Math.round(fareResult.fare * 0.85)),
                      maximum: Math.ceil(fareResult.fare * 1.15),
                      basis: "observed" as const,
                    }
                  : null;

              return {
                ...rec,
                estimatedFare: fareResult.fare,
                fareStatus: "estimated",
                ...(observedGuide ? { fareEstimateRange: observedGuide } : {}),
                journeyLegs: rec.journeyLegs?.map((leg) =>
                  leg.mode === "taxi"
                    ? { ...leg, fare: fareResult.fare, fareStatus: "estimated" as const }
                    : leg,
                ),
              };
            } catch {
              return rec;
            }
          }),
        );

        if (cancelled) return;

        setRecommendations(enrichedRecommendations);

        if (enrichedRecommendations.length === 0) {
          setError(
            "Pulse found the destination, but supported operator data is not yet available for enough of this trip to build a reliable public-transport journey.",
          );
        }
      } catch (planningError) {
        console.error("Journey planning failed:", planningError);

        if (!cancelled) {
          setRecommendations([]);
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
  async (rec: RecommendationType) => {
    if (rec.selectable === false) {
      setError("This route needs more timetable or stop information before tracking can start.");
      return;
    }

    const selectedNetwork = rec.mode as TransitNetwork;
    const originalLegs = rec.journeyLegs ?? [];

    const enrichedLegs = await Promise.all(
      originalLegs.map(async (leg, index) => {
        let pricedLeg = leg;

        // Only estimate a road distance when the stop has coordinates.
        // Never treat the straight-line gap as the road journey.
        if (leg.mode === "taxi" && MAPBOX_TOKEN) {
          const originPoint = leg.fromLocation ??
            (index === 0 ? plannerOrigin : null);
          const endpoint = leg.toLocation;

          if (originPoint && endpoint) {
            try {
              const road = await getMapboxRoadBaseline(originPoint, {
                id: `transfer:${leg.id}`,
                name: leg.to ?? "Transfer point",
                label: leg.to ?? "Transfer point",
                lat: endpoint.lat,
                lng: endpoint.lng,
                source: "pulse",
              });

              if (road?.distanceKm !== null &&
                  road?.distanceKm !== undefined &&
                  road.distanceKm > 0) {
                pricedLeg = {
                  ...leg,
                  distanceKm: road.distanceKm,
                  distanceSource: "road",
                };
              }
            } catch {
              // Preserve the tentative route fit if road routing is offline.
            }
          }
        }

        if (pricedLeg.mode === "walk" ||
            pricedLeg.fare !== null && pricedLeg.fare !== undefined) {
          return pricedLeg;
        }

        // No verified access road = no defensible taxi distance fare.
        if (pricedLeg.mode === "taxi" && pricedLeg.distanceSource !== "road") {
          return pricedLeg;
        }

        const legNetwork: TransitNetwork | null =
          pricedLeg.mode === "taxi" ? "Taxi" : pricedLeg.operator ?? null;

        if (
          !legNetwork ||
          pricedLeg.distanceKm === null ||
          pricedLeg.distanceKm === undefined ||
          !Number.isFinite(pricedLeg.distanceKm) ||
          pricedLeg.distanceKm <= 0
        ) {
          return pricedLeg;
        }

        try {
          const estimate = await FareEngine.computeFinalFare({
            network: legNetwork,
            distance: pricedLeg.distanceKm,
          });
          return {
            ...pricedLeg,
            fare: estimate.fare,
            fareStatus: "estimated" as const,
          };
        } catch {
          return pricedLeg;
        }
      }),
    );

    const hasMultimodalLegs = enrichedLegs.length > 1;
    const allPaidLegsEstimated = enrichedLegs.every(
      (leg) =>
        leg.mode === "walk" ||
        leg.fare !== null && leg.fare !== undefined,
    );

    const totalEstimatedFare = hasMultimodalLegs
      ? allPaidLegsEstimated
        ? enrichedLegs.reduce((sum, leg) => sum + (leg.fare ?? 0), 0)
        : null
      : rec.estimatedFare;

    setSelectedRecommendation({
      ...rec,
      journeyLegs: enrichedLegs.length ? enrichedLegs : rec.journeyLegs,
      estimatedFare: totalEstimatedFare,
      fareStatus:
        totalEstimatedFare !== null && hasMultimodalLegs
          ? "estimated"
          : rec.fareStatus,
    });
    setNetwork(selectedNetwork);
    setEstimatedFare(
      totalEstimatedFare !== null && Number.isFinite(totalEstimatedFare)
        ? totalEstimatedFare
        : null,
    );
    setPlanningStep("fare");
    setError(null);
  },
  [plannerOrigin],
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

  const confirmLegChange = useCallback(() => {
    if (!nextJourneyLeg || !activeJourneyLeg) return;

    const entered =
      legChangeFare.trim() === ""
        ? null
        : Number(legChangeFare);

    if (
      entered !== null &&
      (!Number.isFinite(entered) || entered < 0 || entered > 1000)
    ) {
      setError("Enter a valid fare between R0 and R1 000, or leave it blank.");
      return;
    }

    const completedAt = Date.now();
    const distanceAtSwitch = Math.max(0, currentTrip.distance ?? 0);

    setCurrentTrip((previous) => ({
      ...previous,
      legs: (previous.legs ?? []).map((leg, index) => {
        if (index === activeJourneyLegIndex) {
          return {
            ...leg,
            endDistanceKm: distanceAtSwitch,
            endedAt: completedAt,
            ...(entered !== null ? { actualFare: entered } : {}),
          };
        }

        if (index === activeJourneyLegIndex + 1) {
          return {
            ...leg,
            startedAt: completedAt,
            startDistanceKm: distanceAtSwitch,
          };
        }

        return leg;
      }),
    }));
    setLegChangeFare("");
    setShowLegChangeForm(false);
    setRemindAfterDistanceKm(0);
    setError(null);
  }, [
    nextJourneyLeg,
    activeJourneyLeg,
    activeJourneyLegIndex,
    legChangeFare,
    currentTrip.distance,
  ]);

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
      const candidateOrigin = plannerOrigin;

      const candidateAgeMs =
        candidateOrigin?.timestamp
          ? Math.max(
              0,
              Date.now() - candidateOrigin.timestamp,
            )
          : Number.POSITIVE_INFINITY;

      const candidateAccuracy =
        candidateOrigin?.accuracy ??
        Number.POSITIVE_INFINITY;

      const canUsePlannerOrigin =
        candidateOrigin !== null &&
        candidateOrigin !== undefined &&
        Number.isFinite(candidateOrigin.lat) &&
        Number.isFinite(candidateOrigin.lng) &&
        candidateAgeMs <= 2 * 60 * 1000 &&
        candidateAccuracy <= 1500;

      const freshOrigin =
        canUsePlannerOrigin && candidateOrigin
          ? candidateOrigin
          : await location.requestCurrentLocation();

      const trackerSeed: TrackerLocation = {
        lat: freshOrigin.lat,
        lng: freshOrigin.lng,
        accuracy: freshOrigin.accuracy ?? 999,
        speed: freshOrigin.speed ?? 0,
        heading: freshOrigin.heading ?? 0,
        altitude: freshOrigin.altitude ?? 0,
        timestamp: freshOrigin.timestamp ?? Date.now(),
      };

      await BackgroundTracker.startWithSeed(
        trackerSeed,
      );

      const trackerTrip = BackgroundTracker.getTrip();
      const trackerLocation = BackgroundTracker.getLastKnownLocation();
      const startedAt = trackerTrip?.startedAt ?? Date.now();

      const plannedLegs = selectedRecommendation?.journeyLegs?.length
        ? selectedRecommendation.journeyLegs
        : [
            {
              id: "single-mode",
              mode: network === "Taxi" ? "taxi" as const : "bus" as const,
              label: network,
              operator: network,
              from: "Origin",
              to: destination.trim(),
              distanceKm: routePlan.distanceKm,
              fare: estimatedFare,
            },
          ];

      // Existing published fares take priority; otherwise estimates use the
      // local observed-fare cache, then configured provisional bands.
      const initialLegs: TrackedJourneyLeg[] = await Promise.all(
        plannedLegs.map(async (leg, index) => {
          const modeNetwork: TransitNetwork | null =
            leg.mode === "taxi"
              ? "Taxi"
              : leg.operator ?? null;

          let legEstimate =
            leg.fare !== null && leg.fare !== undefined
              ? leg.fare
              : null;
          let estimateSource: TrackedJourneyLeg["fareEstimateSource"] =
            legEstimate !== null ? "published" : "unknown";

          if (
            legEstimate === null &&
            modeNetwork &&
            leg.distanceKm !== null &&
            leg.distanceKm !== undefined &&
            Number.isFinite(leg.distanceKm) &&
            leg.distanceKm > 0
          ) {
            try {
              const estimate = await FareEngine.computeFinalFare({
                network: modeNetwork,
                distance: leg.distanceKm,
              });
              legEstimate = estimate.fare;
              estimateSource = estimate.source;
            } catch {
              // We do not invent a fare without enough data.
            }
          }

          return {
            id: leg.id,
            label: leg.label,
            mode: leg.mode,
            ...(leg.operator ? { operator: leg.operator } : {}),
            ...(leg.from ? { from: leg.from } : {}),
            ...(leg.to ? { to: leg.to } : {}),
            plannedDistanceKm: leg.distanceKm ?? null,
            distanceSource: leg.distanceSource ??
              (leg.mode === "taxi" ? "straight" : "unknown"),
            startDistanceKm: 0,
            startedAt: index === 0 ? startedAt : 0,
            estimatedFare: legEstimate,
            fareEstimateSource: estimateSource,
          };
        }),
      );

      setLegChangeFare("");
      setShowLegChangeForm(false);
      setRemindAfterDistanceKm(0);

      setCurrentTrip({
        id: startedAt.toString(),
        network,
        legs: initialLegs,
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
    plannerOrigin,
    selectedRecommendation,
    routePlan.distanceKm,
    estimatedFare,
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

    const totalDistanceKm = stats?.distance ?? currentTrip.distance ?? 0;
    const finishedAt = Date.now();
    const completedLegs = (currentTrip.legs ?? []).map((leg) =>
      leg.endedAt === undefined && leg.startedAt > 0
        ? { ...leg, endDistanceKm: totalDistanceKm, endedAt: finishedAt }
        : leg,
    );
    const recordedLegFares = completedLegs
      .map((leg) => leg.actualFare)
      .filter((fare): fare is number => typeof fare === "number");
    const fare = recordedLegFares.length
      ? recordedLegFares.reduce((sum, amount) => sum + amount, 0)
      : estimatedFare ?? 0;

    const completedTrip: TripData = {
      ...(currentTrip as TripData),
      legs: completedLegs,
      endTime: finishedAt,
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

    // An unconfirmed estimate must not become recorded spending.
    let finalFare = verifyTrip.legs && verifyTrip.legs.length > 1
      ? verifyTrip.fare
      : 0;

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

    const knownLegFares = (verifyTrip.legs ?? [])
      .map((leg) => leg.actualFare)
      .filter((fare): fare is number => typeof fare === "number");

    if (verifyTrip.legs?.length) {
      if (knownLegFares.length) {
        finalFare = knownLegFares.reduce((sum, fare) => sum + fare, 0);
      } else if (verifyTrip.legs.length > 1) {
        // No confirmed modal fares: never silently save a whole-journey
        // estimate as actual spending.
        finalFare = 0;
      }
    }

    const isMultiModal = (verifyTrip.legs?.length ?? 0) > 1;
    const hasConfirmedSingleFare =
      !isMultiModal &&
      actualFare.trim() !== "" &&
      finalFare > 0;

    const finalTrip: TripData = {
      ...verifyTrip,
      fare: finalFare,
      legs:
        hasConfirmedSingleFare && verifyTrip.legs?.length === 1
          ? [
              {
                ...verifyTrip.legs[0],
                actualFare: finalFare,
              },
            ]
          : verifyTrip.legs,
    };

    // Train habits only after user confirmation. For multimodal trips,
    // training on the whole amount as a single operator would corrupt fares.
    if (
      hasConfirmedSingleFare &&
      finalTrip.startLocation &&
      finalTrip.endLocation
    ) {
      HabitEngine.learn(
        finalTrip.network,
        finalTrip.startLocation,
        finalTrip.endLocation,
        finalFare,
        finalTrip.duration,
      );
    }

    for (const leg of finalTrip.legs ?? []) {
      const observedDistance =
        leg.endDistanceKm !== undefined
          ? leg.endDistanceKm - leg.startDistanceKm
          : 0;
      const networkForLearning = leg.operator ??
        (leg.mode === "taxi" ? "Taxi" : null);

      if (
        networkForLearning &&
        leg.actualFare !== null &&
        leg.actualFare !== undefined &&
        leg.actualFare > 0 &&
        observedDistance > 0.05
      ) {
        FareEngine.learnFare(
          leg.estimatedFare ?? 0,
          leg.actualFare,
          networkForLearning,
          observedDistance,
        );
      }
    }

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

  // ====================================================
  // LOAD USER / HISTORY
  // ====================================================

  useEffect(() => {
    let active = true;
    // Old demo login records are intentionally invalid. Only a verified
    // backend refresh cookie can restore the commuter session.
    Session.clear("user");
    void AuthApi.restore()
      .then((account) => {
        if (active) setUser(account);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    setHistory(Storage.load<TripData[]>(user.email, "history") ?? []);
  }, [user]);

  const signOut = useCallback(async () => {
    if (tripState === TripState.ACTIVE || verifyTrip) {
      setAccountError("Finish and save your journey before signing out.");
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      await AuthApi.signOut();
      setUser(null);
      resetAllTripState();
      setActiveTab("home");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setAccountBusy(false);
    }
  }, [tripState, verifyTrip, resetAllTripState]);

  const deleteMyAccount = useCallback(async () => {
    if (!user || accountBusy || tripState === TripState.ACTIVE || verifyTrip) return;
    const password = window.prompt(
      "To permanently delete your Pulse account, enter your password:",
    );
    if (password === null || !password) return;
    if (!window.confirm("Delete this account and its local journey history? This cannot be undone.")) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      await AuthApi.deleteAccount(password);
      Storage.clear(user.email, "history");
      Session.clearAll();
      setHistory([]);
      resetAllTripState();
      setUser(null);
      setActiveTab("home");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not delete account.");
    } finally {
      setAccountBusy(false);
    }
  }, [user, accountBusy, tripState, verifyTrip, resetAllTripState]);

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

  if (authChecking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#040917] text-sm font-semibold text-cyan-200" role="status">
        Restoring your secure Pulse session…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={(account) => {
      setUser(account);
      Session.clear("user");
    }} />;
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <>
      <Layout
        activeTab={activeTab}
        onNavClick={(tab) => {
          setActiveTab(tab);
          // Logo/Home always returns to destination search unless a trip is
          // running or awaiting the user's fare confirmation.
          if (tab === "home" && tripState !== TripState.ACTIVE && !verifyTrip) {
            setPlanningStep("destination");
          }
        }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div
            className="relative z-10 min-h-[100dvh] space-y-8 pb-36 pt-2"
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
                  <div className="pt-6 sm:pt-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.045] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                          The rhythm of movement
                        </div>

                        <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
                          Where to?
                        </h1>

                        <p className="mt-3 max-w-xl text-sm leading-6 text-white/45 sm:text-[15px]">
                          Built for South Africa. Pulse brings supported taxi, rail and bus connections into one journey.
                        </p>
                      </div>

                      <div
                        className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold ${plannerGpsHealthy
                          ? "bg-emerald-400/[0.08] text-emerald-200/80"
                          : location.error
                            ? "bg-amber-400/[0.08] text-amber-100/80"
                            : "bg-white/[0.04] text-white/45"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${plannerGpsHealthy
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
                      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-amber-100/90">
                            Location needed
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-100/55">
                            {location.error}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void retryPlannerLocation()}
                          disabled={location.isLocating}
                          className="min-h-10 shrink-0 rounded-xl bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-50"
                        >
                          {location.isLocating ? "Finding GPS..." : "Try again"}
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

                    {activeJourneyLeg && (
                      <div className="premium-glass compact-card p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/70">
                              Current transport · {activeJourneyLegIndex + 1} of {trackedJourneyLegs.length}
                            </p>
                            <h3 className="mt-1 text-xl font-black text-white">
                              {activeJourneyLeg.label}
                            </h3>
                            <p className="mt-1 text-xs text-white/45">
                              {activeJourneyLeg.from ?? "Start"} → {activeJourneyLeg.to ?? destination}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/75">
                            {activeJourneyLeg.estimatedFare !== null && activeJourneyLeg.estimatedFare !== undefined
                              ? `About R${activeJourneyLeg.estimatedFare.toFixed(2)}`
                              : "Fare to confirm"}
                          </span>
                        </div>

                        {nextJourneyLeg && (
                          <div className="mt-4 border-t border-white/10 pt-4">
                            <p className="text-sm font-semibold text-white/80">
                              Next: {nextJourneyLeg.label}
                            </p>
                            {activeJourneyLeg.plannedDistanceKm !== null &&
                              activeJourneyLeg.plannedDistanceKm !== undefined && (
                                <p className="mt-1 text-xs leading-5 text-white/45">
                                  {activeJourneyLeg.distanceSource === "road"
                                    ? "Approximate road distance to change: "
                                    : "Approximate straight-line distance to next stop: "}
                                  {activeJourneyLeg.plannedDistanceKm.toFixed(1)} km.
                                  {" "}GPS-tracked on this mode: {activeLegDistanceKm.toFixed(1)} km.
                                </p>
                              )}

                            {nearSuggestedTransfer && !showLegChangeForm && (
                              <p className="mt-3 rounded-xl bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                                Still on {activeJourneyLeg.label}, or have you changed to {nextJourneyLeg.label}?
                              </p>
                            )}

                            {!showLegChangeForm ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowLegChangeForm(true);
                                    setLegChangeFare("");
                                  }}
                                  className="min-h-11 flex-1 rounded-xl bg-cyan-300 px-4 text-sm font-black text-slate-950"
                                >
                                  I've changed transport
                                </button>
                                {nearSuggestedTransfer && (
                                  <button
                                    type="button"
                                    onClick={() => setRemindAfterDistanceKm(
                                      (currentTrip.distance ?? 0) +
                                      Math.max(3, (activeJourneyLeg.plannedDistanceKm ?? 0) * 0.25),
                                    )}
                                    className="min-h-11 rounded-xl bg-white/10 px-3 text-xs font-bold text-white"
                                  >
                                    Still on this mode
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3 rounded-2xl bg-white/[0.045] p-3">
                                <p className="text-sm font-bold text-white">
                                  Confirm change to {nextJourneyLeg.label}
                                </p>
                                <label className="block text-xs text-white/55">
                                  What did {activeJourneyLeg.label} cost? (optional)
                                  <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    step="0.5"
                                    inputMode="decimal"
                                    value={legChangeFare}
                                    onChange={(event) => setLegChangeFare(event.target.value)}
                                    placeholder="e.g. 20"
                                    className="mt-1 block h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white"
                                  />
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={confirmLegChange}
                                    className="min-h-11 flex-1 rounded-xl bg-emerald-300 px-3 text-sm font-black text-slate-950"
                                  >
                                    Confirm switch
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowLegChangeForm(false)}
                                    className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                            <p className="mt-3 text-[10px] text-white/35">
                              This is a reminder, not automatic mode detection. Confirm when safe, not while driving.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <TripTracker
                      network={activeJourneyLeg?.operator ??
                        (activeJourneyLeg?.mode === "taxi" ? "Taxi" : network)}
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
                      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
                        <aside className="xl:col-span-1">
                          <div className="rounded-[28px] border border-white/[0.07] bg-[#09101d]/80 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.20)] backdrop-blur-xl xl:sticky xl:top-20">
                            <button
                              type="button"
                              onClick={() => {
                                setPlanningStep("destination");
                                setError(null);
                              }}
                              className="text-xs font-bold text-cyan-200/75 transition hover:text-cyan-100"
                            >
                              ← Change destination
                            </button>

                            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                              Your trip
                            </p>

                            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                              {destination}
                            </h2>

                            {resolvedDestination?.label &&
                              resolvedDestination.label !== destination && (
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">
                                  {resolvedDestination.label}
                                </p>
                              )}

                            <div className="mt-7 divide-y divide-white/[0.055]">
                              <div className="flex items-end justify-between gap-4 py-4 first:pt-0">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/30">
                                    {routePlan.source === "mapbox-road"
                                      ? "Road distance"
                                      : routePlan.source === "coordinate-estimate"
                                        ? "Approx. distance"
                                        : "Distance"}
                                  </p>
                                </div>
                                <p className="text-xl font-black text-white">
                                  {isPlanning
                                    ? "…"
                                    : formatDistance(routePlan.distanceKm)}
                                </p>
                              </div>

                              <div className="flex items-end justify-between gap-4 py-4">
                                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/30">
                                  Journeys
                                </p>
                                <p className="text-xl font-black text-cyan-200">
                                  {isPlanning ? "…" : recommendations.length}
                                </p>
                              </div>

                              <div className="py-4 last:pb-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/30">
                                  Starting from
                                </p>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className={`h-2 w-2 shrink-0 rounded-full ${plannerOrigin
                                        ? plannerOriginIsTest
                                          ? "bg-violet-300"
                                          : "bg-emerald-400"
                                        : "bg-amber-400"
                                      }`}
                                    />
                                    <p className="truncate text-xs font-bold text-white/60">
                                      {plannerGpsLabel}
                                    </p>
                                  </div>

                                  {!plannerOrigin && (
                                    <button
                                      type="button"
                                      onClick={() => void retryPlannerLocation()}
                                      className="rounded-lg bg-white/[0.055] px-2.5 py-1.5 text-[10px] font-bold text-white/60"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {routePlan.source === "coordinate-estimate" && (
                              <p className="mt-5 rounded-2xl bg-amber-400/[0.055] px-3 py-2.5 text-[10px] leading-5 text-amber-100/55">
                                Distance is approximate until a road route is available.
                              </p>
                            )}
                          </div>
                        </aside>

                        <div className="min-w-0 xl:col-span-1">
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
                                            ? leg.fareStatus === "estimated"
                                              ? `About R${leg.fare.toFixed(2)}`
                                              : `R${leg.fare.toFixed(2)}`
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

                        <div className="rounded-[28px] border border-white/[0.07] bg-[#09101d]/80 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/60">
                                Ready to go
                              </p>
                              <h3 className="mt-1 text-xl font-black tracking-[-0.025em] text-white">
                                {destination}
                              </h3>
                            </div>

                            <span className="w-fit rounded-full bg-white/[0.055] px-3 py-1.5 text-[10px] font-bold text-white/55">
                              {network}
                            </span>
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                                Distance
                              </p>
                              <p className="mt-1.5 text-lg font-black text-white">
                                {formatDistance(routePlan.distanceKm)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                                Time
                              </p>
                              <p className="mt-1.5 text-lg font-black text-white">
                                {plannedDurationSeconds > 0
                                  ? formatDuration(plannedDurationSeconds)
                                  : "Not verified"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                                Fare
                              </p>
                              <p className={`mt-1.5 text-lg font-black ${estimatedFare !== null ? "text-emerald-300" : "text-amber-200"}`}>
                                {estimatedFare !== null
                                  ? selectedRecommendation?.fareStatus === "estimated"
                                    ? `About R${estimatedFare.toFixed(2)}`
                                    : `R${estimatedFare.toFixed(2)}`
                                  : "Confirm"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                                Legs
                              </p>
                              <p className="mt-1.5 text-lg font-black text-white">
                                {selectedRecommendation.journeyLegs?.length ?? 1}
                              </p>
                            </div>
                          </div>

                          {(estimatedFare === null || plannedDurationSeconds === 0) && (
                            <p className="mt-5 border-t border-white/[0.055] pt-4 text-[10px] leading-5 text-white/30">
                              Pulse will track the journey now. Unverified fare or timing can be confirmed as the network data improves.
                            </p>
                          )}
                        </div>

                        <div className="sticky bottom-4 z-40 pt-3">
                          <button
                            type="button"
                            onClick={() => void startTrip()}
                            disabled={isStartingTrip}
                            className="flex h-16 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-cyan-400 via-cyan-400 to-emerald-400 text-base font-black text-[#031019] shadow-[0_16px_45px_rgba(34,211,238,0.20)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
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
                            {verifyTrip.legs?.some((leg) => leg.actualFare !== null && leg.actualFare !== undefined)
                              ? "Fares recorded"
                              : "Estimated fare"}
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

                      {verifyTrip.legs && verifyTrip.legs.length > 1 && (
                        <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                          <h3 className="text-sm font-black text-white">What each ride cost</h3>
                          <p className="text-xs leading-5 text-white/45">
                            Confirm fares for each part of the journey. Leave one blank if you don't remember.
                          </p>
                          {verifyTrip.legs.map((leg, index) => {
                            const measuredKm =
                              leg.endDistanceKm === undefined
                                ? null
                                : Math.max(0, leg.endDistanceKm - leg.startDistanceKm);
                            return (
                              <div key={`${leg.id}-${index}`} className="rounded-xl bg-white/[0.04] p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-white">{leg.label}</p>
                                    <p className="mt-1 text-xs text-white/45">
                                      {leg.startedAt === 0
                                      ? "Not boarded / not confirmed"
                                      : measuredKm !== null
                                        ? `${measuredKm.toFixed(2)} km tracked`
                                        : "Distance not recorded"}
                                      {leg.estimatedFare !== null && leg.estimatedFare !== undefined
                                        ? ` · About R${leg.estimatedFare.toFixed(2)} estimated`
                                        : ""}
                                    </p>
                                  </div>
                                  <div className="w-[118px] shrink-0">
                                    <label className="text-[10px] text-white/45" htmlFor={`leg-fare-${index}`}>
                                      Paid (R)
                                    </label>
                                    <input
                                      id={`leg-fare-${index}`}
                                      type="number"
                                      min="0"
                                      max="1000"
                                      step="0.5"
                                      inputMode="decimal"
                                      value={leg.actualFare ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        const number = value === "" ? null : Number(value);
                                        if (number !== null && (!Number.isFinite(number) || number < 0 || number > 1000)) return;
                                        setVerifyTrip((previous) => {
                                          if (!previous?.legs) return previous;
                                          const legs = previous.legs.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, actualFare: number } : entry,
                                          );
                                          const knownFares = legs
                                            .map((entry) => entry.actualFare)
                                            .filter((fare): fare is number => typeof fare === "number");
                                          return {
                                            ...previous,
                                            legs,
                                            fare: knownFares.reduce((sum, fare) => sum + fare, 0),
                                          };
                                        });
                                      }}
                                      placeholder="--"
                                      className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-right text-sm font-black text-emerald-200">
                            Recorded fares: R{verifyTrip.legs
                              .reduce((sum, leg) => sum + (leg.actualFare ?? 0), 0)
                              .toFixed(2)}
                          </p>
                        </div>
                      )}

                      {(!verifyTrip.legs || verifyTrip.legs.length <= 1) && (
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
                      )}

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
                <div className="premium-glass-soft rounded-2xl p-4">
                  <p className="text-sm font-bold text-white">{user.email}</p>
                  <p className="mt-1 text-xs text-white/45">
                    Account verified by Pulse. Journey history is still stored on this device during the technical pilot.
                  </p>
                  {accountError && <p role="alert" className="mt-2 text-xs text-red-200">{accountError}</p>}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" disabled={accountBusy || tripState === TripState.ACTIVE || Boolean(verifyTrip)}
                      onClick={() => void signOut()} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                      Sign out
                    </button>
                    <button type="button" disabled={accountBusy || tripState === TripState.ACTIVE || Boolean(verifyTrip)}
                      onClick={() => void deleteMyAccount()} className="rounded-xl bg-red-300/10 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-40">
                      Delete my account
                    </button>
                  </div>
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
                          Recorded spend
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
                                  {trip.destination}
                                </p>
                              )}
                            </div>

                            <p className="text-lg font-black text-emerald-300">
                              R{(trip.fare || 0).toFixed(2)}
                            </p>
                          </div>

                          {trip.legs && trip.legs.length > 1 && (
                            <div className="mt-3 space-y-1.5 rounded-2xl bg-white/[0.035] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                                {trip.legs.length} transport legs · total journey
                              </p>
                              {trip.legs.map((leg, index) => (
                                <div key={`${leg.id}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate text-white/65">
                                    {leg.label} · {Math.max(0, (leg.endDistanceKm ?? leg.startDistanceKm) - leg.startDistanceKm).toFixed(1)} km
                                  </span>
                                  <span className="shrink-0 font-bold text-white/85">
                                    {leg.actualFare === undefined || leg.actualFare === null
                                      ? (leg.startedAt === 0 ? "Not boarded" : "Not recorded")
                                      : `R${leg.actualFare.toFixed(2)}`}
                                  </span>
                                </div>
                              ))}
                              {trip.legs.some((leg) => leg.actualFare === null || leg.actualFare === undefined) && (
                                <p className="pt-1 text-[10px] text-amber-200/60">
                                  Total includes recorded fares only; some legs are unconfirmed.
                                </p>
                              )}
                            </div>
                          )}
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
