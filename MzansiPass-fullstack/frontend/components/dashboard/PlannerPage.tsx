import React, { useState, useCallback } from "react";
import { planTripWithAI } from "../../services/geminiService";
import type { RouteOption, Provider } from "../../types";

import Input from "../ui/Input";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import RouteMap from "../ui/RouteMap";

import { PROVIDER_COLORS } from "../../constants";

// ======================================================
// PROVIDER ICON
// ======================================================

interface ProviderIconProps {
  provider: Provider;
}

const ProviderIcon: React.FC<ProviderIconProps> = ({ provider }) => {
  const iconName =
    provider === "Gautrain" || provider === "PRASA"
      ? "train"
      : "bus";

  const colorClass =
    PROVIDER_COLORS[provider] ?? "bg-gray-500 text-white";

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
    >
      <Icon name={iconName} className="w-6 h-6" />
    </div>
  );
};

// ======================================================
// ROUTE OPTION CARD
// ======================================================

interface RouteOptionCardProps {
  route: RouteOption;
}

const RouteOptionCard: React.FC<RouteOptionCardProps> = ({ route }) => {
  return (
    <div className="bg-rea-gray-dark rounded-lg p-4 space-y-4">
      {/* Header */}
      <header className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">
            {route.title}
          </h3>

          <div className="flex items-center gap-4 text-sm text-rea-gray-light mt-1">
            <span>{route.travelTime}</span>

            <span className="font-bold text-lg text-white">
              R {route.totalFare.toFixed(2)}
            </span>
          </div>
        </div>

        {route.tag && (
          <span
            className={`
              px-3 py-1
              text-xs
              font-bold
              rounded-full
              whitespace-nowrap
              ${
                route.tag === "Recommended"
                  ? "bg-green-500 text-white"
                  : route.tag === "Cheapest"
                    ? "bg-blue-500 text-white"
                    : "bg-yellow-500 text-black"
              }
            `}
          >
            {route.tag}
          </span>
        )}
      </header>

      {/* Route Steps */}
      <div className="space-y-3">
        {route.steps.map((step, index) => (
          <div
            key={`${step.provider}-${step.from}-${step.to}-${index}`}
            className="flex items-start gap-4"
          >
            <ProviderIcon provider={step.provider} />

            <div className="min-w-0">
              <p className="font-semibold text-white">
                {step.provider}: {step.from} to {step.to}
              </p>

              <p className="text-sm text-rea-gray-light mt-1">
                {step.instruction}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Route Map */}
      <RouteMap route={route} />
    </div>
  );
};

// ======================================================
// PLANNER PAGE
// ======================================================

const PlannerPage: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);

  // ======================================================
  // PLAN TRIP
  // ======================================================

  const handlePlanTrip = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Please enter your destination.");
      return;
    }

    setIsLoading(true);
    setError("");
    setRouteOptions([]);

    try {
      const results = await planTripWithAI(trimmedQuery);

      setRouteOptions(results);
    } catch (err) {
      console.error("Trip planning failed:", err);

      setError(
        "Failed to plan trip. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // ======================================================
  // ENTER KEY
  // ======================================================

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !isLoading) {
        event.preventDefault();
        void handlePlanTrip();
      }
    },
    [handlePlanTrip, isLoading]
  );

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Page Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold text-white">
          Trip Planner
        </h1>

        <p className="text-rea-gray-light mt-2">
          Let AI find the best route for you.
        </p>
      </header>

      {/* Search Section */}
      <div className="space-y-4">
        <Input
          label="Where are you going?"
          id="destination"
          placeholder="e.g. Sandton to Soweto Theatre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />

        <Button
          onClick={() => void handlePlanTrip()}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? "Planning..." : "Find Routes"}
        </Button>

        {error && (
          <p className="text-red-500 text-sm text-center">
            {error}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
          <div
            className="
              w-12 h-12
              border-4
              border-rea-gray-dark
              border-t-rea-red
              rounded-full
              animate-spin
            "
          />

          <p className="font-semibold text-rea-gray-light">
            Finding the best routes with Gemini...
          </p>
        </div>
      )}

      {/* Route Results */}
      {!isLoading && routeOptions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            Your Route Options
          </h2>

          {routeOptions.map((route, index) => (
            <RouteOptionCard
              key={`${route.title}-${index}`}
              route={route}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading &&
        routeOptions.length === 0 &&
        !error && (
          <div className="text-center py-10">
            <Icon
              name="planner"
              className="w-16 h-16 text-rea-gray-light mx-auto mb-4"
            />

            <p className="text-rea-gray-light">
              Enter a destination to start planning your trip.
            </p>
          </div>
        )}
    </div>
  );
};

export default PlannerPage;