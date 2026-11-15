"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================
// TYPES
// ============================================================

type Recommendation = {
  crop: string;
  probability: number;
  percentage: number;
};

type RecommendationResponse = {
  success: boolean;
  prediction_enabled: boolean;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  soil?: Record<string, unknown>;
  weather?: Record<string, unknown>;
  recommendations?: Recommendation[];
  warning?: string;
};

type ForecastResponse = {
  source?: string;
  timezone?: string;
  current?: Record<string, unknown>;
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

// ============================================================
// LANDING PAGE DATA
// ============================================================

const features = [
  {
    number: "01",
    icon: "⌖",
    title: "Location intelligence",
    description:
      "Identify your farm through browser GPS and retrieve environmental information based on its location.",
  },
  {
    number: "02",
    icon: "◈",
    title: "Soil insights",
    description:
      "Understand soil conditions through available nutrient and soil-property information.",
  },
  {
    number: "03",
    icon: "☼",
    title: "Weather intelligence",
    description:
      "Explore historical weather and climate information relevant to your farm.",
  },
  {
    number: "04",
    icon: "✳",
    title: "AI crop recommendations",
    description:
      "Discover suitable crop options using soil and weather information with machine learning.",
  },
];

const steps = [
  {
    number: "01",
    title: "Locate your farm",
    description:
      "Share your browser location or provide your farm coordinates to begin.",
  },
  {
    number: "02",
    title: "Analyze farm conditions",
    description:
      "Collect available soil and historical weather information for your location.",
  },
  {
    number: "03",
    title: "Discover crop options",
    description:
      "Explore crop suggestions generated from the available environmental data.",
  },
];

const crops = [
  {
    name: "Teff",
    description: "An important Ethiopian staple grain.",
    image:
      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=85",
    number: "01",
  },
  {
    name: "Maize",
    description: "A widely cultivated food crop.",
    image:
      "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=85",
    number: "02",
  },
  {
    name: "Wheat",
    description: "A major crop for food production.",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=85",
    number: "03",
  },
  {
    name: "Sorghum",
    description: "A crop grown in diverse conditions.",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=85",
    number: "04",
  },
];

// ============================================================
// HELPERS
// ============================================================

function Arrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
    >
      <path
        d="M4 10h12m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M5 15 15 5M6 5h9v9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================
// FIELDWISE LOGO
// ============================================================

function Logo({
  light = false,
  onClick,
}: {
  light?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-3 text-left"
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#174c38] text-2xl text-[#d8e8b9] shadow-lg shadow-black/10 transition duration-300 group-hover:rotate-[-8deg]">
        ❧
      </span>

      <span
        className={`text-xl font-extrabold tracking-[-0.05em] ${
          light ? "text-white" : "text-[#183b2e]"
        }`}
      >
        Field<span className="text-[#9eb879]">Wise</span>
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#87985f]">
      <span className="h-px w-7 bg-[#9aaa75]" />
      {children}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function DataCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8dfcf] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#788856]">{label}</span>
        <span className="text-xl text-[#879b63]">{icon}</span>
      </div>

      <p className="mt-4 text-2xl font-bold text-[#183b2e]">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-[#788856]">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d2dec3] bg-[#fbfaf5] px-6 py-12 text-center">
      <span className="text-3xl text-[#879b63]">◈</span>
      <h3 className="mt-4 text-lg font-bold text-[#183b2e]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#788477]">
        {description}
      </p>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Landing() {
  const [showDashboard, setShowDashboard] = useState(false);

  // Location
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Dashboard navigation
  const [activeTab, setActiveTab] = useState("Overview");

  // Loading states
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Backend data
  const [recommendation, setRecommendation] =
    useState<RecommendationResponse | null>(null);

  const [forecast, setForecast] =
    useState<ForecastResponse | null>(null);

  // Errors
  const [recommendationError, setRecommendationError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [locationError, setLocationError] = useState("");

  const planBuilt = recommendation !== null;

  const openDashboard = () => {
    setShowDashboard(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ============================================================
  // MANUAL COORDINATE INPUTS
  // ============================================================

  const handleLatitudeChange = (value: string) => {
    if (value.trim() === "") {
      setLat(null);
      setLocationError("");
      return;
    }

    const number = Number(value);

    if (Number.isFinite(number) && number >= -90 && number <= 90) {
      setLat(number);
      setLocationError("");
    } else {
      setLocationError("Latitude must be between -90 and 90.");
    }
  };

  const handleLongitudeChange = (value: string) => {
    if (value.trim() === "") {
      setLon(null);
      setLocationError("");
      return;
    }

    const number = Number(value);

    if (Number.isFinite(number) && number >= -180 && number <= 180) {
      setLon(number);
      setLocationError("");
    } else {
      setLocationError("Longitude must be between -180 and 180.");
    }
  };

  // ============================================================
  // GPS LOCATION
  // ============================================================

  const handleUseDeviceLocation = () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
        setLocationError("");
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(
            "Location permission was denied. You can enter coordinates manually."
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("Your location is currently unavailable.");
        } else {
          setLocationError(
            "Location request timed out. Please try again."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  // ============================================================
  // BACKEND REQUESTS
  // ============================================================

  const buildFieldPlan = async () => {
    setRecommendationError("");
    setWeatherError("");

    if (lat === null || lon === null) {
      setLocationError(
        "Please enter your latitude and longitude or use GPS."
      );
      setActiveTab("Farm Location");
      return;
    }

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setLocationError("Please enter valid coordinates.");
      return;
    }

    setLocationError("");
    setRecommendation(null);
    setForecast(null);

    setLoading(true);
    setWeatherLoading(true);

    const recommendationRequest = fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        accuracy,
      }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || data.message || "Could not analyze your farm."
          );
        }

        setRecommendation(data);
      })
      .catch((error) => {
        setRecommendationError(
          error instanceof Error
            ? error.message
            : "Recommendation request failed."
        );
      })
      .finally(() => {
        setLoading(false);
      });

    const weatherRequest = fetch(
      `${API_URL}/api/weather/forecast?latitude=${encodeURIComponent(
        lat
      )}&longitude=${encodeURIComponent(lon)}`
    )
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              data.message ||
              "Could not retrieve the weather forecast."
          );
        }

        setForecast(data);
      })
      .catch((error) => {
        setWeatherError(
          error instanceof Error
            ? error.message
            : "Weather request failed."
        );
      })
      .finally(() => {
        setWeatherLoading(false);
      });

    await Promise.allSettled([
      recommendationRequest,
      weatherRequest,
    ]);
  };

  // ============================================================
  // DASHBOARD PAGES
  // ============================================================

  const dashboardTabs = [
    { name: "Overview", icon: "⌂" },
    { name: "Weather", icon: "☼" },
    { name: "Soil Analysis", icon: "◈" },
    { name: "Crop Recommendations", icon: "✳" },
    { name: "Farm Location", icon: "⌖" },
  ];

  const currentWeather = forecast?.current;

  const currentTemperature = currentWeather?.temperature_2m;
  const currentHumidity = currentWeather?.relative_humidity_2m;
  const currentRain = currentWeather?.precipitation;
  const currentWind = currentWeather?.wind_speed_10m;

  // ============================================================
  // DASHBOARD
  // ============================================================

  if (showDashboard) {
    return (
      <div className="min-h-screen bg-[#fbfaf5] text-[#183b2e]">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-[#e5eddb] bg-[#fbfaf5]/90 px-5 py-4 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo onClick={() => setShowDashboard(false)} />

              <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#788856] md:flex">
                <span>Fieldwise Africa</span>
                <span>•</span>
                <span>Climate-smart farm planning</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDashboard(false)}
              className="rounded-xl border border-[#d2dec3] bg-white px-4 py-2 text-xs font-bold text-[#183b2e] shadow-sm transition hover:bg-[#f2f6ee]"
            >
              ← Back to Home
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          {/* DASHBOARD HEADING */}
          <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#87985f]">
                FIELDWISE DASHBOARD
              </p>

              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#183b2e] sm:text-5xl lg:text-6xl">
                Make every season count.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6e61]">
                Explore your farm location, local weather, soil information,
                and crop recommendations in one place.
              </p>
            </div>

            <div className="self-start rounded-full border border-[#d2dec3] bg-white px-5 py-2.5 text-xs font-bold text-[#174c38] shadow-sm">
              NASA POWER • CROP INSIGHTS
            </div>
          </div>

          {/* DASHBOARD LAYOUT */}
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            {/* SIDEBAR */}
            <aside className="h-fit rounded-2xl border border-[#d8dfcf] bg-white p-5 shadow-sm">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#87985f]">
                Workspace
              </p>

              <nav className="mt-4 space-y-2">
                {dashboardTabs.map((tab) => (
                  <button
                    key={tab.name}
                    type="button"
                    onClick={() => setActiveTab(tab.name)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-bold transition ${
                      activeTab === tab.name
                        ? "bg-[#174c38] text-white shadow-sm"
                        : "text-[#5c6e61] hover:bg-[#f2f6ee] hover:text-[#174c38]"
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    {tab.name}
                  </button>
                ))}
              </nav>

              <div className="mt-6 border-t border-[#f0f4ec] pt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                  Farm coordinates
                </p>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#5c6e61]">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={lat ?? ""}
                      onChange={(e) => handleLatitudeChange(e.target.value)}
                      placeholder="e.g. 9.03"
                      className="mt-1 w-full rounded-xl border border-[#dfe5d8] bg-[#fbfaf5] px-3 py-2.5 text-xs text-[#183b2e] outline-none focus:border-[#879b63]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#5c6e61]">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={lon ?? ""}
                      onChange={(e) => handleLongitudeChange(e.target.value)}
                      placeholder="e.g. 38.74"
                      className="mt-1 w-full rounded-xl border border-[#dfe5d8] bg-[#fbfaf5] px-3 py-2.5 text-xs text-[#183b2e] outline-none focus:border-[#879b63]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUseDeviceLocation}
                    disabled={locating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d2dec3] bg-[#f2f6ee] py-2.5 text-xs font-bold text-[#174c38] transition hover:bg-[#e5eddb] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ⌖ {locating ? "Locating..." : "Use device GPS"}
                  </button>

                  {accuracy !== null && (
                    <p className="text-[10px] text-[#788856]">
                      GPS accuracy: approximately {Math.round(accuracy)} m
                    </p>
                  )}

                  {locationError && (
                    <p className="text-xs leading-5 text-red-600">
                      {locationError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={buildFieldPlan}
                    disabled={loading || lat === null || lon === null}
                    className="w-full rounded-xl bg-[#174c38] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#103828] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Analyzing..." : "Analyze my farm →"}
                  </button>
                </div>
              </div>

              {recommendationError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                  {recommendationError}
                </div>
              )}
            </aside>

            {/* MAIN PAGE CONTENT */}
            <section className="min-w-0 space-y-6">
              {/* ================================================= */}
              {/* OVERVIEW */}
              {/* ================================================= */}

              {activeTab === "Overview" && (
                <>
                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                          <span>Farm overview</span>
                          <span>•</span>
                          <span>Climate intelligence</span>
                        </div>

                        <h2 className="mt-2 text-2xl font-semibold text-[#183b2e]">
                          Your farm at a glance
                        </h2>

                        <p className="mt-2 text-xs leading-6 text-[#5c6e61]">
                          A summary of the information retrieved for your
                          selected farm location.
                        </p>
                      </div>

                      <span className="rounded-full border border-[#d2dec3] bg-[#f2f6ee] px-4 py-1.5 text-xs font-bold text-[#174c38]">
                        {planBuilt ? "Analysis complete" : "Awaiting analysis"}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#fbfaf5] p-5">
                        <p className="text-xs font-semibold text-[#788856]">
                          Farm latitude
                        </p>
                        <p className="mt-2 text-xl font-bold text-[#183b2e]">
                          {lat !== null ? lat.toFixed(6) : "Not provided"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#fbfaf5] p-5">
                        <p className="text-xs font-semibold text-[#788856]">
                          Farm longitude
                        </p>
                        <p className="mt-2 text-xl font-bold text-[#183b2e]">
                          {lon !== null ? lon.toFixed(6) : "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#788856]">
                      Environmental snapshot
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                      Current farm conditions
                    </h3>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <DataCard
                        label="Temperature"
                        value={
                          currentTemperature !== undefined
                            ? formatValue(currentTemperature)
                            : "—"
                        }
                        unit="°C"
                        icon="☼"
                      />

                      <DataCard
                        label="Humidity"
                        value={
                          currentHumidity !== undefined
                            ? formatValue(currentHumidity)
                            : "—"
                        }
                        unit="%"
                        icon="◌"
                      />

                      <DataCard
                        label="Rainfall"
                        value={
                          currentRain !== undefined
                            ? formatValue(currentRain)
                            : "—"
                        }
                        unit="mm"
                        icon="☂"
                      />

                      <DataCard
                        label="Wind speed"
                        value={
                          currentWind !== undefined
                            ? formatValue(currentWind)
                            : "—"
                        }
                        unit="km/h"
                        icon="≋"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                          Crop planning
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                          Recommendation status
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("Crop Recommendations")}
                        className="text-xs font-bold text-[#174c38] hover:underline"
                      >
                        View recommendations →
                      </button>
                    </div>

                    {recommendation ? (
                      <div className="mt-5 rounded-xl bg-[#f2f6ee] p-5">
                        <p className="text-sm leading-6 text-[#183b2e]">
                          {recommendation.message}
                        </p>

                        <p className="mt-3 text-xs text-[#788856]">
                          {recommendation.prediction_enabled
                            ? `${recommendation.recommendations?.length ?? 0} crop recommendations returned.`
                            : "Predictions are currently disabled until model compatibility is validated."}
                        </p>
                      </div>
                    ) : (
                      <EmptyState
                        title="No farm analysis yet"
                        description="Enter your coordinates in the sidebar and select Analyze my farm to retrieve your farm information."
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                      Your FieldWise workspace
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                      Explore your farm data
                    </h3>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {dashboardTabs.slice(1).map((tab) => (
                        <button
                          key={tab.name}
                          type="button"
                          onClick={() => setActiveTab(tab.name)}
                          className="flex items-center gap-4 rounded-xl border border-[#e5eddb] bg-[#fbfaf5] p-4 text-left transition hover:border-[#9aaa75] hover:bg-[#f2f6ee]"
                        >
                          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8efdf] text-2xl text-[#315c40]">
                            {tab.icon}
                          </span>

                          <span>
                            <span className="block text-sm font-bold text-[#183b2e]">
                              {tab.name}
                            </span>
                            <span className="mt-1 block text-xs text-[#788477]">
                              Open {tab.name.toLowerCase()} information
                            </span>
                          </span>

                          <span className="ml-auto text-[#879b63]">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ================================================= */}
              {/* WEATHER PAGE */}
              {/* ================================================= */}

              {activeTab === "Weather" && (
                <>
                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                          Climate intelligence
                        </p>

                        <h2 className="mt-2 text-3xl font-semibold text-[#183b2e]">
                          Weather conditions
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#5c6e61]">
                          Current weather and forecast for your farm
                          coordinates.
                        </p>
                      </div>

                      <span className="rounded-full border border-[#d2dec3] bg-[#f2f6ee] px-4 py-2 text-xs font-bold text-[#174c38]">
                        {forecast?.source || "Weather data"}
                      </span>
                    </div>
                  </div>

                  {weatherLoading && (
                    <div className="rounded-2xl border border-[#d8dfcf] bg-white p-8 text-center text-sm text-[#5c6e61]">
                      Loading weather data...
                    </div>
                  )}

                  {weatherError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {weatherError}
                    </div>
                  )}

                  {!forecast && !weatherLoading && (
                    <EmptyState
                      title="Weather data not loaded"
                      description="Enter your farm coordinates and select Analyze my farm to retrieve current conditions and the forecast."
                    />
                  )}

                  {forecast && (
                    <>
                      <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                              Live weather
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                              Current conditions
                            </h3>
                          </div>

                          <span className="text-xs text-[#788856]">
                            {forecast.timezone || "Local timezone"}
                          </span>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <DataCard
                            label="Temperature"
                            value={formatValue(currentTemperature)}
                            unit="°C"
                            icon="☼"
                          />

                          <DataCard
                            label="Humidity"
                            value={formatValue(currentHumidity)}
                            unit="%"
                            icon="◌"
                          />

                          <DataCard
                            label="Precipitation"
                            value={formatValue(currentRain)}
                            unit="mm"
                            icon="☂"
                          />

                          <DataCard
                            label="Wind speed"
                            value={formatValue(currentWind)}
                            unit="km/h"
                            icon="≋"
                          />
                        </div>
                      </div>

                      {forecast.daily?.time && (
                        <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                              Weather outlook
                            </p>

                            <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                              14-day forecast
                            </h3>

                            <p className="mt-2 text-xs text-[#788477]">
                              Review expected temperature and rainfall for
                              upcoming days.
                            </p>
                          </div>

                          <div className="mt-5 overflow-x-auto">
                            <table className="w-full min-w-[540px] text-left text-xs">
                              <thead>
                                <tr className="border-b border-[#e5eddb] text-[#788856]">
                                  <th className="py-3">Date</th>
                                  <th className="py-3">Max °C</th>
                                  <th className="py-3">Min °C</th>
                                  <th className="py-3">Rain mm</th>
                                  <th className="py-3">Rain chance</th>
                                  <th className="py-3">Wind km/h</th>
                                </tr>
                              </thead>

                              <tbody>
                                {forecast.daily.time.map((date, index) => (
                                  <tr
                                    key={date}
                                    className="border-b border-[#f0f4ec] text-[#183b2e]"
                                  >
                                    <td className="py-3 font-semibold">
                                      {formatDate(date)}
                                    </td>

                                    <td className="py-3">
                                      {forecast.daily?.temperature_2m_max?.[index] ?? "—"}
                                    </td>

                                    <td className="py-3">
                                      {forecast.daily?.temperature_2m_min?.[index] ?? "—"}
                                    </td>

                                    <td className="py-3">
                                      {forecast.daily?.precipitation_sum?.[index] ?? "—"}
                                    </td>

                                    <td className="py-3">
                                      {forecast.daily?.precipitation_probability_max?.[index] ?? "—"}%
                                    </td>

                                    <td className="py-3">
                                      {forecast.daily?.wind_speed_10m_max?.[index] ?? "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ================================================= */}
              {/* SOIL ANALYSIS PAGE */}
              {/* ================================================= */}

              {activeTab === "Soil Analysis" && (
                <>
                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                      Environmental information
                    </p>

                    <h2 className="mt-2 text-3xl font-semibold text-[#183b2e]">
                      Soil Analysis
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5c6e61]">
                      Explore soil properties retrieved by the FieldWise
                      backend for your selected coordinates.
                    </p>
                  </div>

                  {!recommendation && (
                    <EmptyState
                      title="No soil information available"
                      description="Analyze your farm location first. Soil information will appear here when the backend returns it."
                    />
                  )}

                  {recommendation && (
                    <>
                      <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                              Retrieved data
                            </p>

                            <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                              Soil properties
                            </h3>
                          </div>

                          <span className="rounded-full bg-[#f2f6ee] px-3 py-1.5 text-xs font-bold text-[#174c38]">
                            Backend data
                          </span>
                        </div>

                        {recommendation?.soil && (
                          <div className="mt-7 border-t border-[#f0f4ec] pt-6">
                            <div>
                              <h4 className="text-lg font-bold text-[#183b2e]">
                                Soil analysis
                              </h4>
                              <p className="mt-1 text-xs text-[#788856]">
                                Nutrient measurements and estimated confidence
                                ranges
                              </p>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                              {Object.entries(recommendation.soil).map(
                                ([key, rawValue]) => {
                                  const item = rawValue as {
                                    value?: number;
                                    unit?: string;
                                    property?: string;
                                    uncertainty?: {
                                      confidence_interval: string;
                                      lower_bound: number;
                                      upper_bound: number;
                                    }[];
                                  };

                                  const name = (item.property || key)
                                    .replaceAll("_", " ")
                                    .replace(/\b\w/g, (letter) =>
                                      letter.toUpperCase()
                                    );

                                  return (
                                    <div
                                      key={key}
                                      className="rounded-2xl border border-[#d8dfcf] bg-[#fbfaf5] p-5"
                                    >
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                                        {name}
                                      </p>

                                      <div className="mt-3 flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-[#174c38]">
                                          {item.value ?? "—"}
                                        </span>
                                        <span className="text-sm text-[#788477]">
                                          {item.unit || ""}
                                        </span>
                                      </div>

                                      <div className="mt-4 border-t border-[#e5eddb] pt-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                                          Estimated range
                                        </p>

                                        {item.uncertainty?.length ? (
                                          <div className="mt-2 space-y-2">
                                            {item.uncertainty.map((range) => (
                                              <div
                                                key={range.confidence_interval}
                                                className="flex items-center justify-between text-xs"
                                              >
                                                <span className="text-[#788477]">
                                                  {range.confidence_interval}{" "}
                                                  confidence
                                                </span>

                                                <span className="font-bold text-[#183b2e]">
                                                  {range.lower_bound} –{" "}
                                                  {range.upper_bound}{" "}
                                                  {item.unit}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-2 text-xs text-[#788477]">
                                            No uncertainty range available.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {recommendation.warning && (
                        <div className="rounded-xl border border-[#e8dfc6] bg-[#fffaf0] p-5 text-sm leading-6 text-[#76571e]">
                          {recommendation.warning}
                        </div>
                      )}

                      <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-[#183b2e]">
                          About this information
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-[#788477]">
                          Soil values shown here come from the backend
                          response. Their availability and accuracy depend
                          on the soil data source and the selected location.
                          They should not be treated as a substitute for a
                          laboratory soil test.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ================================================= */}
              {/* CROP RECOMMENDATIONS PAGE */}
              {/* ================================================= */}

              {activeTab === "Crop Recommendations" && (
                <>
                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                      Machine learning insights
                    </p>

                    <h2 className="mt-2 text-3xl font-semibold text-[#183b2e]">
                      Crop Recommendations
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5c6e61]">
                      Explore crop recommendations returned by your trained
                      model using the environmental information available
                      for your farm.
                    </p>
                  </div>

                  {!recommendation && (
                    <EmptyState
                      title="No recommendations yet"
                      description="Analyze your farm location first to request crop recommendations from the backend."
                    />
                  )}

                  {recommendation && (
                    <>
                      <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                          Analysis result
                        </p>

                        <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                          Model response
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-[#5c6e61]">
                          {recommendation.message}
                        </p>

                        {recommendation.warning && (
                          <p className="mt-4 rounded-xl bg-[#fffaf0] p-4 text-xs leading-6 text-[#76571e]">
                            {recommendation.warning}
                          </p>
                        )}
                      </div>

                      {recommendation.prediction_enabled &&
                      recommendation.recommendations &&
                      recommendation.recommendations.length > 0 ? (
                        <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                            Model predictions
                          </p>

                          <h3 className="mt-2 text-xl font-semibold text-[#183b2e]">
                            Recommended crops
                          </h3>

                          <div className="mt-6 space-y-4">
                            {recommendation.recommendations.map(
                              (item, index) => (
                                <div
                                  key={`${item.crop}-${index}`}
                                  className="rounded-xl border border-[#e5eddb] bg-[#fbfaf5] p-5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8efdf] text-sm font-bold text-[#315c40]">
                                        {String(index + 1).padStart(2, "0")}
                                      </span>

                                      <div>
                                        <h4 className="text-base font-bold text-[#183b2e]">
                                          {item.crop}
                                        </h4>

                                        <p className="mt-1 text-[10px] text-[#788477]">
                                          Model probability
                                        </p>
                                      </div>
                                    </div>

                                    <span className="text-lg font-bold text-[#174c38]">
                                      {item.percentage}%
                                    </span>
                                  </div>

                                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5eddb]">
                                    <div
                                      className="h-full rounded-full bg-[#72935e] transition-all"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.max(0, item.percentage)
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-[#e8dfc6] bg-[#fffaf0] p-6">
                          <h3 className="text-lg font-bold text-[#76571e]">
                            Predictions are not enabled
                          </h3>

                          <p className="mt-3 text-sm leading-7 text-[#76571e]">
                            Your backend returned an analysis response, but
                            crop predictions are disabled until model-input
                            compatibility is validated. No unvalidated crop
                            predictions are displayed.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ================================================= */}
              {/* FARM LOCATION PAGE */}
              {/* ================================================= */}

              {activeTab === "Farm Location" && (
                <>
                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                      Location intelligence
                    </p>

                    <h2 className="mt-2 text-3xl font-semibold text-[#183b2e]">
                      Farm Location
                    </h2>

                    <p className="mt-2 text-sm leading-7 text-[#5c6e61]">
                      Enter the coordinates of your farm manually or use
                      your device GPS.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-[#183b2e]">
                        Location coordinates
                      </h3>

                      <span className="rounded-full bg-[#f2f6ee] px-3 py-1.5 text-[10px] font-bold text-[#174c38]">
                        GPS supported
                      </span>
                    </div>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-[#183b2e]">
                          Latitude
                        </label>

                        <input
                          type="number"
                          step="any"
                          min="-90"
                          max="90"
                          value={lat ?? ""}
                          onChange={(e) =>
                            handleLatitudeChange(e.target.value)
                          }
                          placeholder="Enter latitude"
                          className="mt-2 w-full rounded-xl border border-[#dfe5d8] bg-[#fbfaf5] px-4 py-3 text-sm text-[#183b2e] outline-none focus:border-[#879b63]"
                        />

                        <p className="mt-2 text-[10px] text-[#788477]">
                          Valid range: -90 to 90
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#183b2e]">
                          Longitude
                        </label>

                        <input
                          type="number"
                          step="any"
                          min="-180"
                          max="180"
                          value={lon ?? ""}
                          onChange={(e) =>
                            handleLongitudeChange(e.target.value)
                          }
                          placeholder="Enter longitude"
                          className="mt-2 w-full rounded-xl border border-[#dfe5d8] bg-[#fbfaf5] px-4 py-3 text-sm text-[#183b2e] outline-none focus:border-[#879b63]"
                        />

                        <p className="mt-2 text-[10px] text-[#788477]">
                          Valid range: -180 to 180
                        </p>
                      </div>
                    </div>

                    {locationError && (
                      <p className="mt-4 text-xs text-red-600">
                        {locationError}
                      </p>
                    )}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleUseDeviceLocation}
                        disabled={locating}
                        className="rounded-xl border border-[#d2dec3] bg-[#f2f6ee] px-5 py-3 text-xs font-bold text-[#174c38] transition hover:bg-[#e5eddb] disabled:opacity-60"
                      >
                        ⌖ {locating ? "Detecting location..." : "Use device GPS"}
                      </button>

                      <button
                        type="button"
                        onClick={buildFieldPlan}
                        disabled={loading || lat === null || lon === null}
                        className="rounded-xl bg-[#174c38] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#103828] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Analyzing..." : "Analyze this location →"}
                      </button>
                    </div>
                  </div>

                  {lat !== null && lon !== null && (
                    <div className="rounded-2xl border border-[#d8dfcf] bg-white p-6 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#788856]">
                        Selected location
                      </p>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <DataCard
                          label="Latitude"
                          value={lat.toFixed(6)}
                          icon="↕"
                        />

                        <DataCard
                          label="Longitude"
                          value={lon.toFixed(6)}
                          icon="↔"
                        />
                      </div>

                      {accuracy !== null && (
                        <p className="mt-4 text-xs text-[#788477]">
                          GPS accuracy: approximately {Math.round(accuracy)} m
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // LANDING PAGE
  // ============================================================

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf5] text-[#183b2e]">
      {/* NAVIGATION */}
      <header className="absolute left-0 top-0 z-40 w-full">
        <div className="mx-auto max-w-7xl px-5 pt-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-[#102f25]/35 px-5 py-3 backdrop-blur-xl sm:px-7">
            <Logo light onClick={() => setShowDashboard(false)} />

            <nav className="hidden items-center gap-9 text-sm font-medium text-white/80 md:flex">
              <a href="#home" className="transition hover:text-[#d5e5b2]">
                Home
              </a>
              <a href="#about" className="transition hover:text-[#d5e5b2]">
                About
              </a>
              <a href="#features" className="transition hover:text-[#d5e5b2]">
                Features
              </a>
              <a
                href="#how-it-works"
                className="transition hover:text-[#d5e5b2]"
              >
                How it works
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openDashboard}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#dce9bd] px-5 py-3 text-sm font-bold text-[#173c2c] transition duration-300 hover:bg-white"
              >
                Get started
                <Arrow />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        id="home"
        className="relative isolate flex min-h-[760px] items-center bg-[#102f25] lg:min-h-[850px]"
      >
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2200&q=90')",
            }}
          />
          <div className="absolute inset-0 bg-[#102f25]/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#102f25]/95 via-[#163c2d]/80 to-[#163c2d]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#102f25]/50 via-transparent to-[#102f25]/20" />
        </div>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-40 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:pb-28 lg:pt-44">
          <div className="max-w-3xl text-white">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9dfa3] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c9dfa3]" />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#e3edcf] sm:text-xs">
                Smarter insights for Ethiopian agriculture
              </span>
            </div>

            <h1 className="text-6xl font-semibold leading-[0.99] tracking-[-0.065em] sm:text-7xl lg:text-[88px]">
              Grow with
              <span className="mt-2 block text-[#d5e5b2]">
                better insight.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-8 text-white/75 sm:text-lg sm:leading-9">
              Every farm has a story written in its soil, location and climate.
              FieldWise brings these insights together to help you explore more
              informed crop decisions.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={openDashboard}
                className="group inline-flex items-center justify-center gap-4 rounded-xl bg-[#dce9bd] px-7 py-4 text-sm font-bold text-[#173c2c] shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:bg-white"
              >
                Get your crop recommendation
                <Arrow />
              </button>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/35 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Discover how it works
                <ExternalArrow />
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-xs font-medium text-white/65 sm:text-sm">
              <span className="flex items-center gap-2">
                <span className="text-[#c9dfa3]">✓</span>
                Location-based insights
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[#c9dfa3]">✓</span>
                Soil and weather information
              </span>
            </div>
          </div>

          {/* HERO CARD */}
          <div className="hidden lg:block">
            <div className="ml-auto max-w-[390px] rounded-[2rem] border border-white/60 bg-[#fbfaf5]/95 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#849477]">
                  Your farm, understood
                </p>
                <span className="rounded-full bg-[#e8efdf] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#426344]">
                  FieldWise
                </span>
              </div>

              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-[#183b2e]">
                Start with your location.
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#7c887a]">
                Your farm&apos;s location is the starting point for
                understanding its growing conditions.
              </p>

              <div className="mt-7 rounded-2xl bg-[#e9eee2] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#355744]">
                    Farm location
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#55714d]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#82a66b]" />
                    GPS supported
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#174c38] text-2xl text-white">
                    ⌖
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#183b2e]">
                      Your farm coordinates
                    </p>
                    <p className="mt-1 text-xs text-[#829082]">
                      Shared when you choose to continue
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#e7e8dc] bg-white p-4">
                  <span className="text-2xl text-[#52744f]">◈</span>
                  <p className="mt-3 text-sm font-bold">Soil data</p>
                  <p className="mt-1 text-xs leading-5 text-[#899287]">
                    Understand soil conditions
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e7e8dc] bg-white p-4">
                  <span className="text-2xl text-[#9a9b5a]">☼</span>
                  <p className="mt-3 text-sm font-bold">Weather data</p>
                  <p className="mt-1 text-xs leading-5 text-[#899287]">
                    Explore local climate
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openDashboard}
                className="group mt-5 flex w-full items-center justify-between rounded-xl bg-[#174c38] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#103b2b]"
              >
                Start your analysis
                <Arrow />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:py-32"
      >
        <div className="relative">
          <div
            className="min-h-[430px] rounded-[2rem] bg-cover bg-center shadow-xl sm:min-h-[550px] lg:min-h-[610px]"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=90')",
            }}
          />
        </div>

        <div className="lg:pl-6">
          <SectionLabel>About FieldWise</SectionLabel>

          <h2 className="mt-6 text-4xl font-semibold leading-[1.13] tracking-[-0.055em] sm:text-5xl lg:text-[58px]">
            Every farm is different.
            <span className="block text-[#879b63]">
              Your insights should be too.
            </span>
          </h2>

          <p className="mt-7 text-base leading-8 text-[#748174]">
            Farming decisions are influenced by many environmental factors.
            Understanding those factors can help farmers explore crop options
            that better suit their growing conditions.
          </p>

          <button
            type="button"
            onClick={openDashboard}
            className="group mt-9 inline-flex items-center gap-3 border-b-2 border-[#9aaa75] pb-2 text-sm font-bold text-[#244b39]"
          >
            Discover the platform
            <Arrow />
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-[#eef1e8] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <SectionLabel>What we bring together</SectionLabel>

            <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">
              The information behind a smarter decision.
            </h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group rounded-[1.6rem] border border-[#dfe5d8] bg-[#fbfaf5] p-7 transition duration-300 hover:-translate-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e8efdf] text-3xl text-[#315c40]">
                    {feature.icon}
                  </span>
                  <span className="text-xs font-bold tracking-widest text-[#a3ad96]">
                    {feature.number}
                  </span>
                </div>

                <h3 className="mt-9 text-lg font-bold text-[#244b39]">
                  {feature.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-[#788477]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32"
      >
        <div className="text-center">
          <SectionLabel>A simple process</SectionLabel>

          <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            From your farm to useful insights.
          </h2>
        </div>

        <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <article
              key={step.number}
              className="flex flex-col items-center text-center"
            >
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#dfe7d6] bg-[#eef1e8] text-lg font-bold text-[#315c40]">
                {step.number}
              </div>

              <h3 className="mt-7 text-xl font-bold text-[#244b39]">
                {step.title}
              </h3>

              <p className="mt-4 max-w-xs text-sm leading-7 text-[#788477]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ETHIOPIAN CROPS */}
      <section className="bg-[#173e2e] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Made with local crops in mind.
            </h2>

            <p className="mt-5 text-sm leading-8 text-white/60">
              Explore familiar crops from across Ethiopia.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {crops.map((crop) => (
              <article
                key={crop.name}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/10"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${crop.image}')` }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#102f25]/90 via-transparent to-transparent" />

                <div className="absolute bottom-0 left-0 p-5">
                  <h3 className="text-xl font-bold">{crop.name}</h3>
                  <p className="mt-1 text-xs text-white/70">
                    {crop.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="overflow-hidden bg-[#102f25] text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center">
            <p className="text-xs text-white/35">
              © 2026 FieldWise. All rights reserved.
            </p>

            <p className="text-xs text-white/35">
              Built for smarter agriculture in Ethiopia.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}