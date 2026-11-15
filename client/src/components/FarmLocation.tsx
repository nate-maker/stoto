
"use client";

import Link from "next/link";
import { useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SoilValue {
  value: number;
  unit: string | null;
  property: string;
  uncertainty?: unknown;
}

interface Recommendation {
  crop: string;
  probability: number;
  percentage: number;
}

interface FarmCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface ApiResult {
  success: boolean;
  prediction_enabled: boolean;
  message: string;

  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    method: string;
  };

  soil: Record<string, SoilValue>;
  weather: Record<string, number>;
  recommendations: Recommendation[];
  warning?: string;
}

function formatNumber(value: number, decimals = 3) {
  return Number(value).toFixed(decimals);
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#82935b]">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#183b2e] sm:text-3xl">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-7 text-[#788477]">
        {description}
      </p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
}: {
  title: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e9df] bg-[#fbfaf5] p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-medium text-[#879184]">
        {title}
      </p>

      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-[#244b39]">
        {value}
      </p>

      {unit && (
        <p className="mt-1 text-xs text-[#929b8e]">
          {unit}
        </p>
      )}
    </div>
  );
}

export default function FarmLocation() {
  const [location, setLocation] =
    useState<FarmCoordinates | null>(null);

  const [result, setResult] =
    useState<ApiResult | null>(null);

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [loadingRecommendation, setLoadingRecommendation] =
    useState(false);

  const [error, setError] = useState("");

  // ========================================================
  // BROWSER GPS
  // ========================================================

  function getFarmLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            "Your browser does not support geolocation."
          )
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  }

  // ========================================================
  // GET LOCATION
  // ========================================================

  async function handleGetLocation() {
    setLoadingLocation(true);
    setError("");
    setLocation(null);
    setResult(null);

    try {
      const position = await getFarmLocation();

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (err) {
      if (
        typeof GeolocationPositionError !== "undefined" &&
        err instanceof GeolocationPositionError
      ) {
        switch (err.code) {
          case 1:
            setError(
              "Location permission denied. Allow location access in your browser settings."
            );
            break;

          case 2:
            setError(
              "Your device could not determine its location."
            );
            break;

          case 3:
            setError(
              "Location request timed out. Please try again."
            );
            break;

          default:
            setError("Unable to retrieve your location.");
        }
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to retrieve your location."
        );
      }
    } finally {
      setLoadingLocation(false);
    }
  }

  // ========================================================
  // SEND LOCATION TO FASTAPI
  // ========================================================

  async function handleRecommendation() {
    if (!location) {
      setError("Please detect your farm location first.");
      return;
    }

    setLoadingRecommendation(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Crop recommendation failed."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoadingRecommendation(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf5] text-[#183b2e]">

      {/* ================================================== */}
      {/* NAVIGATION */}
      {/* ================================================== */}

      <header className="sticky top-0 z-30 border-b border-[#e9e9df] bg-[#fbfaf5]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">

          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#174c38] text-xl text-[#d8e8b9]">
              ❧
            </span>

            <span className="text-lg font-bold tracking-tight">
              Farm<span className="text-[#82935b]">wise</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#647568] md:flex">
            <Link href="/" className="transition hover:text-[#174c38]">
              Home
            </Link>

            <Link href="/#about" className="transition hover:text-[#174c38]">
              About
            </Link>

            <Link href="/#features" className="transition hover:text-[#174c38]">
              Features
            </Link>
          </nav>

          <span className="rounded-full bg-[#e9efdf] px-4 py-2 text-xs font-semibold text-[#315c40]">
            Crop recommendation
          </span>
        </div>
      </header>

      {/* ================================================== */}
      {/* HERO */}
      {/* ================================================== */}

      <section className="relative overflow-hidden bg-[#173e2e]">

        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#102f25] via-[#173e2e]/95 to-[#173e2e]/75" />

        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">

          <div className="max-w-3xl">

            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d5e5b2]">
              <span className="h-2 w-2 rounded-full bg-[#c3d69e]" />
              Fieldwise agricultural intelligence
            </div>

            <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">
              Let's understand
              <span className="block text-[#d5e5b2]">
                your farm.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
              Start by detecting your farm's location. Fieldwise
              will use available soil and climate information
              to help identify suitable crop options.
            </p>

            <div className="mt-9 flex flex-wrap gap-3 text-sm text-white/70">
              <span className="rounded-full border border-white/20 px-4 py-2">
                📍 Browser GPS
              </span>

              <span className="rounded-full border border-white/20 px-4 py-2">
                ◈ Soil information
              </span>

              <span className="rounded-full border border-white/20 px-4 py-2">
                ☼ Climate information
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/* MAIN CONTENT */}
      {/* ================================================== */}

      <div className="mx-auto max-w-7xl space-y-10 px-5 py-16 sm:px-8 lg:px-10 lg:py-20">

        {/* LOCATION SECTION */}

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">

          {/* LEFT: LOCATION FORM */}

          <div className="rounded-[2rem] border border-[#e8e9df] bg-white p-6 shadow-sm sm:p-8">

            <SectionTitle
              eyebrow="Step 01 · Your farm"
              title="Detect your location"
              description="Use your device's GPS to identify the coordinates of your farm."
            />

            <div className="mt-8 rounded-2xl bg-[#f0f3e9] p-6">

              <div className="flex items-start gap-4">

                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#174c38] text-xl text-white">
                  📍
                </div>

                <div>
                  <h3 className="font-bold text-[#244b39]">
                    Location detection
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#788477]">
                    Your browser will ask for permission to
                    access your current location. Your
                    coordinates will be used to retrieve
                    agricultural data.
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={
                  loadingLocation ||
                  loadingRecommendation
                }
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-[#174c38] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#103b2b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingLocation ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Detecting your location...
                  </>
                ) : (
                  <>
                    <span>⌖</span>
                    Use my current location
                  </>
                )}
              </button>

            </div>

            {/* LOCATION DETAILS */}

            {location && (
              <div className="mt-6 rounded-2xl border border-[#dce7d1] bg-[#f7faf2] p-6">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <h3 className="font-bold text-[#244b39]">
                    Location detected
                  </h3>

                  <span className="rounded-full bg-[#e0ebd4] px-3 py-1.5 text-xs font-bold text-[#315c40]">
                    ✓ GPS ready
                  </span>

                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">

                  <MetricCard
                    title="Latitude"
                    value={formatNumber(location.latitude, 6)}
                  />

                  <MetricCard
                    title="Longitude"
                    value={formatNumber(location.longitude, 6)}
                  />

                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <p className="text-xs text-[#879184]">
                    Reported GPS accuracy
                  </p>

                  <p className="mt-2 font-bold text-[#244b39]">
                    Approximately{" "}
                    {formatNumber(location.accuracy, 1)} metres
                  </p>
                </div>

                <p className="mt-4 text-xs leading-6 text-[#788477]">
                  Please check that these coordinates represent
                  your farm. GPS accuracy is an estimate and
                  does not guarantee your farm boundary.
                </p>

                <button
                  type="button"
                  onClick={handleRecommendation}
                  disabled={loadingRecommendation}
                  className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#174c38] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#103b2b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingRecommendation
                    ? "Collecting agricultural data..."
                    : "Confirm location & recommend crops"}
                </button>

              </div>
            )}

            {/* ERROR */}

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

          </div>

          {/* RIGHT: EXPLANATION */}

          <div className="flex flex-col gap-5">

            <div className="rounded-[2rem] bg-[#e9efdf] p-7 sm:p-8">

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#82935b]">
                How it works
              </p>

              <h2 className="mt-4 text-2xl font-semibold leading-tight text-[#244b39]">
                Your location is the starting point.
              </h2>

              <p className="mt-4 text-sm leading-7 text-[#718075]">
                Fieldwise connects location information with
                environmental data to create a clearer picture
                of your farm's growing conditions.
              </p>

              <div className="mt-8 space-y-6">

                {[
                  {
                    icon: "⌖",
                    title: "Browser GPS",
                    description: "Identify your farm coordinates.",
                  },
                  {
                    icon: "◈",
                    title: "iSDAsoil",
                    description: "Retrieve available soil measurements.",
                  },
                  {
                    icon: "☼",
                    title: "NASA POWER",
                    description: "Retrieve available climate information.",
                  },
                  {
                    icon: "✳",
                    title: "Machine learning",
                    description: "Generate crop predictions when enabled.",
                  },
                ].map((item, index) => (
                  <div key={item.title} className="flex gap-4">

                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-xl text-[#315c40]">
                      {item.icon}
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#244b39]">
                        {item.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#788477]">
                        {item.description}
                      </p>
                    </div>

                  </div>
                ))}

              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] bg-[#173e2e] p-7 text-white">

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c3d69e]">
                Built for agriculture
              </p>

              <h3 className="mt-4 text-2xl font-semibold">
                Better information.
                <span className="block text-[#c3d69e]">
                  Better decisions.
                </span>
              </h3>

              <p className="mt-4 text-sm leading-7 text-white/60">
                Explore available environmental information
                before making your crop-planning decisions.
              </p>

            </div>

          </div>
        </section>

        {/* ================================================== */}
        {/* LOADING */}
        {/* ================================================== */}

        {loadingRecommendation && (
          <section className="rounded-[2rem] border border-[#dce7d1] bg-white p-8 shadow-sm">

            <div className="flex flex-col items-center py-8 text-center">

              <div className="grid h-16 w-16 place-items-center rounded-full bg-[#e9efdf]">
                <span className="animate-spin text-2xl">⏳</span>
              </div>

              <h2 className="mt-6 text-xl font-bold text-[#244b39]">
                Analyzing your farm
              </h2>

              <p className="mt-3 max-w-md text-sm leading-7 text-[#788477]">
                Collecting soil and climate information from
                the available data sources. This may take
                some time.
              </p>

              <div className="mt-7 h-2 w-full max-w-sm overflow-hidden rounded-full bg-[#e9eee2]">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[#71945a]" />
              </div>

            </div>

          </section>
        )}

        {/* ================================================== */}
        {/* RESULTS */}
        {/* ================================================== */}

        {result && (
          <section className="space-y-8">

            {/* RESULTS HEADER */}

            <div className="rounded-[2rem] bg-[#173e2e] p-7 text-white sm:p-9">

              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c3d69e]">
                    Farm analysis
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold">
                    Your farm data
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
                    {result.message}
                  </p>
                </div>

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                  ✓
                </div>

              </div>

              <div className="mt-7 flex flex-wrap gap-3 text-xs text-white/65">

                <span className="rounded-full border border-white/20 px-4 py-2">
                  Method: {result.location.method}
                </span>

                <span className="rounded-full border border-white/20 px-4 py-2">
                  {formatNumber(result.location.latitude, 4)},{" "}
                  {formatNumber(result.location.longitude, 4)}
                </span>

              </div>

            </div>

            {/* SOIL DATA */}

            <div className="rounded-[2rem] border border-[#e8e9df] bg-white p-6 shadow-sm sm:p-8">

              <SectionTitle
                eyebrow="Environmental data · 01"
                title="Soil analysis"
                description="Soil measurements retrieved from iSDAsoil."
              />

              <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                {Object.entries(result.soil || {}).map(
                  ([feature, item]) => (
                    <MetricCard
                      key={feature}
                      title={item.property || feature}
                      value={formatNumber(item.value)}
                      unit={item.unit || "Unit not supplied"}
                    />
                  )
                )}

              </div>

              {Object.keys(result.soil || {}).length === 0 && (
                <p className="mt-6 rounded-xl bg-[#f0f3e9] p-5 text-sm text-[#788477]">
                  No soil measurements were returned.
                </p>
              )}

            </div>

            {/* WEATHER DATA */}

            <div className="rounded-[2rem] border border-[#e8e9df] bg-white p-6 shadow-sm sm:p-8">

              <SectionTitle
                eyebrow="Environmental data · 02"
                title="Climate analysis"
                description="Climate measurements retrieved from NASA POWER."
              />

              <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                {Object.entries(result.weather || {}).map(
                  ([feature, value]) => (
                    <MetricCard
                      key={feature}
                      title={feature}
                      value={formatNumber(value)}
                    />
                  )
                )}

              </div>

              {Object.keys(result.weather || {}).length === 0 && (
                <p className="mt-6 rounded-xl bg-[#f0f3e9] p-5 text-sm text-[#788477]">
                  No climate measurements were returned.
                </p>
              )}

            </div>

            {/* CROP RECOMMENDATIONS */}

            {result.prediction_enabled && (
              <div className="rounded-[2rem] border border-[#e8e9df] bg-white p-6 shadow-sm sm:p-8">

                <SectionTitle
                  eyebrow="Machine learning · 03"
                  title="Crop recommendations"
                  description="The crop predictions generated by your trained machine learning model."
                />

                {result.recommendations.length > 0 ? (
                  <div className="mt-8 space-y-6">

                    {result.recommendations.map(
                      (item, index) => {
                        const percentage = Math.min(
                          100,
                          Math.max(0, item.percentage)
                        );

                        return (
                          <div key={item.crop}>

                            <div className="flex items-center justify-between gap-4">

                              <div className="flex items-center gap-4">

                                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9efdf] font-bold text-[#315c40]">
                                  {index + 1}
                                </div>

                                <div>
                                  <h3 className="font-bold capitalize text-[#244b39]">
                                    {item.crop}
                                  </h3>

                                  <p className="mt-1 text-xs text-[#879184]">
                                    Model prediction
                                  </p>
                                </div>

                              </div>

                              <p className="text-lg font-bold text-[#244b39]">
                                {item.percentage.toFixed(2)}%
                              </p>

                            </div>

                            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf0e8]">

                              <div
                                className="h-full rounded-full bg-[#71945a] transition-all duration-700"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                ) : (
                  <p className="mt-6 rounded-xl bg-[#f0f3e9] p-5 text-sm text-[#788477]">
                    The model did not return any crop predictions.
                  </p>
                )}

                {result.warning && (
                  <div className="mt-7 rounded-xl border border-[#e8d9a8] bg-[#fff9e9] p-5 text-sm leading-7 text-[#80652b]">
                    {result.warning}
                  </div>
                )}

                <p className="mt-7 text-xs leading-6 text-[#929b8e]">
                  Prediction percentages represent the model's
                  output scores. They should not be interpreted
                  as guaranteed crop success probabilities.
                </p>

              </div>
            )}

            {/* PREDICTIONS DISABLED */}

            {!result.prediction_enabled && (
              <div className="rounded-[2rem] border border-[#e8d9a8] bg-[#fff9e9] p-7 sm:p-8">

                <div className="flex items-start gap-4">

                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f4e9c9] text-xl">
                    !
                  </span>

                  <div>
                    <h2 className="font-bold text-[#80652b]">
                      Crop predictions are currently disabled
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-[#8b7547]">
                      Soil and weather data were collected,
                      but the model input compatibility has
                      not yet been validated.
                    </p>

                    {result.warning && (
                      <p className="mt-3 text-sm leading-7 text-[#8b7547]">
                        {result.warning}
                      </p>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* TRY AGAIN */}

            <div className="flex flex-col items-center justify-between gap-5 rounded-[2rem] bg-[#e9efdf] p-7 sm:flex-row sm:p-8">

              <div>
                <h3 className="text-lg font-bold text-[#244b39]">
                  Want to analyze another location?
                </h3>

                <p className="mt-2 text-sm text-[#788477]">
                  Detect a different farm location and run a new analysis.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={
                  loadingLocation ||
                  loadingRecommendation
                }
                className="w-full rounded-xl bg-[#174c38] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#103b2b] disabled:opacity-50 sm:w-auto"
              >
                Detect another location
              </button>

            </div>

          </section>
        )}

      </div>

      {/* ================================================== */}
      {/* FOOTER */}
      {/* ================================================== */}

      <footer className="bg-[#102f25] text-white">

        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">

          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">

            <div>

              <Link href="/" className="inline-flex items-center gap-3">

                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#174c38] text-xl text-[#d8e8b9]">
                  ❧
                </span>

                <span className="text-xl font-bold">
                  Farm<span className="text-[#c3d69e]">wise</span>
                </span>

              </Link>

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
                Helping farmers make more informed growing
                decisions through location intelligence,
                soil information, weather data and
                machine learning.
              </p>

            </div>

            <div>

              <h3 className="text-sm font-semibold">
                Explore
              </h3>

              <div className="mt-6 flex flex-col gap-4 text-sm text-white/55">
                <Link href="/" className="transition hover:text-[#c3d69e]">
                  Home
                </Link>

                <Link href="/#about" className="transition hover:text-[#c3d69e]">
                  About
                </Link>

                <Link href="/#features" className="transition hover:text-[#c3d69e]">
                  Features
                </Link>
              </div>

            </div>

            <div>

              <h3 className="text-sm font-semibold">
                Get started
              </h3>

              <div className="mt-6 flex flex-col gap-4 text-sm text-white/55">
                <Link
                  href="/farmlocation"
                  className="transition hover:text-[#c3d69e]"
                >
                  Locate your farm
                </Link>

                <Link
                  href="/farmlocation"
                  className="transition hover:text-[#c3d69e]"
                >
                  Crop recommendations
                </Link>
              </div>

            </div>

          </div>

          <div className="mt-16 border-t border-white/10 pt-7">

            <div className="flex flex-col gap-4 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">

              <p>
                © 2026 Fieldwise. All rights reserved.
              </p>

              <p>
                Built for smarter agriculture in Ethiopia.
              </p>

            </div>

            <p className="mt-10 text-center text-sm font-medium tracking-[0.35em] text-gray-500">
              FARM WISE
            </p>

          </div>

        </div>

      </footer>

    </main>
  );
}

