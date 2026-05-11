// src/components/DestinationSearch.tsx

import {
  Search,
  MapPin,
  Navigation,
  Loader2
} from "lucide-react";

interface DestinationSearchProps {

  destination: string;

  setDestination: (
    value: string
  ) => void;

  onSearch: () => void;

  loading?: boolean;

}

export const DestinationSearch = ({
  destination,
  setDestination,
  onSearch,
  loading = false
}: DestinationSearchProps) => {

  // ======================================================
  // MOCK SMART SUGGESTIONS
  // ======================================================
  const suggestions = [

    "Sandton City",
    "Rosebank",
    "Braamfontein",
    "Hatfield",
    "Pretoria CBD",
    "Midrand",
    "Soweto",
    "Park Station",
    "Menlyn Mall",
    "Mall of Africa",
    "Randburg",
    "Fourways",
    "Tembisa",
    "Alexandra",
    "OR Tambo International Airport"

  ].filter((item) =>
    item
      .toLowerCase()
      .includes(
        destination.toLowerCase()
      )
  );

  return (

    <div className="space-y-6">

      {/* ====================================================== */}
      {/* HERO */}
      {/* ====================================================== */}
      <div className="space-y-3 text-center pt-6">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">

          <Navigation
            size={14}
            className="text-cyan-400"
          />

          <span className="text-xs text-white/60 tracking-wide">
            PULSE MOBILITY AI
          </span>

        </div>

        <div>

          <h1 className="text-4xl font-black tracking-tight">
            Welcome to Pulse
          </h1>

          <p className="text-white/50 mt-2 text-sm">
            Intelligent public transport for South Africa
          </p>

        </div>

      </div>

      {/* ====================================================== */}
      {/* LIVE LOCATION */}
      {/* ====================================================== */}
      <div className="glass rounded-3xl p-4">

        <div className="flex items-start gap-3">

          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center">

            <MapPin
              size={18}
              className="text-emerald-400"
            />

          </div>

          <div>

            <p className="text-xs text-white/40">
              Current Location
            </p>

            <p className="font-semibold">
              Live GPS Connected
            </p>

            <p className="text-xs text-white/40 mt-1">
              Pulse is analysing nearby routes
            </p>

          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* SEARCH */}
      {/* ====================================================== */}
      <div className="glass rounded-3xl p-5 space-y-5">

        <div>

          <p className="text-sm text-white/50 mb-3">
            Where are you going?
          </p>

          <div className="relative">

            <Search
              size={18}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-white/30
              "
            />

            <input
              value={destination}
              onChange={(e) =>
                setDestination(
                  e.target.value
                )
              }
              placeholder="Search destination..."
              className="
                w-full
                h-14
                pl-12
                pr-4
                rounded-2xl
                bg-white/5
                border
                border-white/10
                focus:outline-none
                focus:border-cyan-400/40
                transition-all
              "
            />

          </div>

        </div>

        {/* ====================================================== */}
        {/* SMART SUGGESTIONS */}
        {/* ====================================================== */}
        {destination.length > 1 &&
          suggestions.length > 0 && (

          <div className="space-y-2">

            <p className="text-xs text-white/40 px-1">
              Suggested destinations
            </p>

            {suggestions
              .slice(0, 5)
              .map((item) => (

              <button
                key={item}
                onClick={() =>
                  setDestination(item)
                }
                className="
                  w-full
                  text-left
                  p-4
                  rounded-2xl
                  bg-white/5
                  hover:bg-white/10
                  transition-all
                  border
                  border-white/5
                "
              >

                <div className="flex items-center gap-3">

                  <MapPin
                    size={16}
                    className="text-cyan-400"
                  />

                  <div>

                    <p className="text-sm font-medium">
                      {item}
                    </p>

                    <p className="text-[11px] text-white/40">
                      Suggested by Pulse AI
                    </p>

                  </div>

                </div>

              </button>

            ))}

          </div>

        )}

        {/* ====================================================== */}
        {/* AI INFO */}
        {/* ====================================================== */}
        <div className="grid grid-cols-2 gap-3">

          <div className="glass rounded-2xl p-3">

            <p className="text-[10px] text-white/40">
              LIVE ANALYSIS
            </p>

            <p className="text-sm font-bold mt-1">
              Taxi Routes
            </p>

          </div>

          <div className="glass rounded-2xl p-3">

            <p className="text-[10px] text-white/40">
              NETWORKS
            </p>

            <p className="text-sm font-bold mt-1">
              BRT + Rail
            </p>

          </div>

        </div>

        {/* ====================================================== */}
        {/* CONTINUE */}
        {/* ====================================================== */}
        <button
          onClick={onSearch}
          disabled={
            !destination.trim() ||
            loading
          }
          className="
            btn-primary
            w-full
            h-14
            disabled:opacity-50
            flex
            items-center
            justify-center
            gap-2
            text-base
            font-bold
          "
        >

          {loading ? (
            <>
              <Loader2
                size={18}
                className="animate-spin"
              />

              Finding best routes...
            </>
          ) : (
            <>
              Continue
            </>
          )}

        </button>

      </div>

    </div>

  );

};