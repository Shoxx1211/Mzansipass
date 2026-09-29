// src/features/planner/DevJourneyTestLab.tsx
// Pulse Transit - development-only deterministic journey testing
//
// This component is intentionally inert in production. It exists so operator
// datasets and routing evidence can be tested without depending on browser GPS
// overrides or Mapbox place-name lookup.

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  MapPin,
  Play,
  Route,
} from "lucide-react";

import type { Location } from "../../types";
import type { DestinationPlace } from "./DestinationSearch";

export interface DevJourneyExpectedCandidate {
  operatorId: string;

  status:
    | "direct"
    | "transfer"
    | "geographic-evidence"
    | "service-membership";

  evidenceKind:
    | "canonical-route"
    | "published-transfer"
    | "gis-shape"
    | "published-service-membership";

  routeCodes?: string[];
  transferStopIncludes?: string[];
}

export interface DevJourneyTestRequest {
  id: string;
  name: string;
  origin: Location;
  destination: DestinationPlace;
  expected: string;

  expectedCandidate?: DevJourneyExpectedCandidate;
}

interface DevJourneyTestLabProps {
  onRun: (request: DevJourneyTestRequest) => void;
}

interface JourneyPreset {
  id: string;
  name: string;
  description: string;
  expected: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;

  expectedCandidate?: DevJourneyExpectedCandidate;
}

const PRESETS: JourneyPreset[] = [
  {
    id: "reavaya-t2-direct",
    name: "Rea Vaya · T2 direct",
    description:
      "Canonical T2 geometry at both ends. Expected to return a direct evidence-backed T2 route.",
    expected: "Direct route · T2",
    expectedCandidate: {
  operatorId: "reavaya",
  status: "direct",
  evidenceKind: "canonical-route",
  routeCodes: ["T2"],
},
    originLat: -26.264010358192344,
    originLng: 27.88076966271508,
    destinationLat: -26.19175074667631,
    destinationLng: 28.039161966574387,
  },
  {
    id: "reavaya-f6-f7-transfer",
    name: "Rea Vaya · F6 → F7",
    description:
      "Published shared-stop connectivity between F6 and F7. Expected transfer evidence at Bosmont.",
    expected: "F6 → Bosmont → F7",
    expectedCandidate: {
  operatorId: "reavaya",
  status: "transfer",
  evidenceKind: "published-transfer",
  routeCodes: ["F6", "F7"],
  transferStopIncludes: ["Bosmont"],
},
    originLat: -26.18824276998984,
    originLng: 27.9108768490767,
    destinationLat: -26.21636676961667,
    destinationLng: 28.007370574987647,
  },
];

const parseCoordinate = (
  value: string,
  minimum: number,
  maximum: number,
): number | null => {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
};

const coordinateLabel = (
  lat: number,
  lng: number,
): string => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const DevJourneyTestLab = ({
  onRun,
}: DevJourneyTestLabProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const firstPreset = PRESETS[0];

  const [isOpen, setIsOpen] = useState(false);
  const [presetId, setPresetId] = useState(firstPreset.id);
  const [originLat, setOriginLat] = useState(String(firstPreset.originLat));
  const [originLng, setOriginLng] = useState(String(firstPreset.originLng));
  const [destinationLat, setDestinationLat] = useState(
    String(firstPreset.destinationLat),
  );
  const [destinationLng, setDestinationLng] = useState(
    String(firstPreset.destinationLng),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () =>
      PRESETS.find((preset) => preset.id === presetId) ??
      PRESETS[0],
    [presetId],
  );

  const applyPreset = (nextPresetId: string) => {
    const preset =
      PRESETS.find((item) => item.id === nextPresetId) ??
      PRESETS[0];

    setPresetId(preset.id);
    setOriginLat(String(preset.originLat));
    setOriginLng(String(preset.originLng));
    setDestinationLat(String(preset.destinationLat));
    setDestinationLng(String(preset.destinationLng));
    setValidationError(null);
  };

  const runTest = () => {
    const parsedOriginLat = parseCoordinate(
      originLat,
      -90,
      90,
    );
    const parsedOriginLng = parseCoordinate(
      originLng,
      -180,
      180,
    );
    const parsedDestinationLat = parseCoordinate(
      destinationLat,
      -90,
      90,
    );
    const parsedDestinationLng = parseCoordinate(
      destinationLng,
      -180,
      180,
    );

    if (
      parsedOriginLat === null ||
      parsedOriginLng === null ||
      parsedDestinationLat === null ||
      parsedDestinationLng === null
    ) {
      setValidationError(
        "Enter valid latitude/longitude values before running the test.",
      );
      return;
    }

    setValidationError(null);

    onRun({
      id: selectedPreset.id,
      name: selectedPreset.name,
      expected: selectedPreset.expected,
      expectedCandidate: selectedPreset.expectedCandidate,
      origin: {
        lat: parsedOriginLat,
        lng: parsedOriginLng,
        accuracy: 1,
        timestamp: Date.now(),
      },
      destination: {
        id: `dev-${selectedPreset.id}`,
        name: selectedPreset.name,
        label: `Deterministic destination · ${coordinateLabel(
          parsedDestinationLat,
          parsedDestinationLng,
        )}`,
        lat: parsedDestinationLat,
        lng: parsedDestinationLng,
        category: "Development test",
        source: "manual",
      },
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.025] to-cyan-500/[0.05]">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
            <FlaskConical size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-white">
                Journey Test Lab
              </p>

              <span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200">
                Dev only
              </span>
            </div>

            <p className="mt-0.5 text-xs leading-5 text-white/35">
              Deterministic operator and transfer testing without GPS spoofing.
            </p>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp
            size={18}
            className="shrink-0 text-white/45"
          />
        ) : (
          <ChevronDown
            size={18}
            className="shrink-0 text-white/45"
          />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 sm:px-5">
          <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
            <label
              htmlFor="pulse-dev-journey-preset"
              className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35"
            >
              Test scenario
            </label>

            <select
              id="pulse-dev-journey-preset"
              value={presetId}
              onChange={(event) => applyPreset(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm font-bold text-white outline-none focus:border-violet-400/40"
            >
              {PRESETS.map((preset) => (
                <option
                  key={preset.id}
                  value={preset.id}
                >
                  {preset.name}
                </option>
              ))}
            </select>

            <p className="mt-3 text-xs leading-5 text-white/45">
              {selectedPreset.description}
            </p>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-400/10 bg-cyan-500/[0.05] px-3 py-2.5">
              <Route
                size={14}
                className="mt-0.5 shrink-0 text-cyan-300"
              />
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-300/70">
                  Expected evidence
                </p>
                <p className="mt-1 text-xs font-bold text-white/75">
                  {selectedPreset.expected}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <MapPin
                  size={14}
                  className="text-emerald-300"
                />
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
                  Origin
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] uppercase tracking-wide text-white/30">
                    Latitude
                  </span>
                  <input
                    value={originLat}
                    onChange={(event) => setOriginLat(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-xs text-white outline-none focus:border-emerald-400/35"
                  />
                </label>

                <label className="block">
                  <span className="text-[9px] uppercase tracking-wide text-white/30">
                    Longitude
                  </span>
                  <input
                    value={originLng}
                    onChange={(event) => setOriginLng(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-xs text-white outline-none focus:border-emerald-400/35"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <MapPin
                  size={14}
                  className="text-cyan-300"
                />
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
                  Destination
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] uppercase tracking-wide text-white/30">
                    Latitude
                  </span>
                  <input
                    value={destinationLat}
                    onChange={(event) => setDestinationLat(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-xs text-white outline-none focus:border-cyan-400/35"
                  />
                </label>

                <label className="block">
                  <span className="text-[9px] uppercase tracking-wide text-white/30">
                    Longitude
                  </span>
                  <input
                    value={destinationLng}
                    onChange={(event) => setDestinationLng(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-xs text-white outline-none focus:border-cyan-400/35"
                  />
                </label>
              </div>
            </div>
          </div>

          {validationError && (
            <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2">
              <p className="text-xs leading-5 text-red-200/80">
                {validationError}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={runTest}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-black text-white shadow-lg shadow-violet-500/10 transition hover:brightness-110 active:scale-[0.99]"
          >
            <Play size={15} />
            Run deterministic journey
          </button>

          <p className="mt-3 text-center text-[10px] leading-4 text-white/25">
            Development coordinates affect planning only. Live trip tracking
            continues to require real GPS.
          </p>
        </div>
      )}
    </section>
  );
};

export default DevJourneyTestLab;
