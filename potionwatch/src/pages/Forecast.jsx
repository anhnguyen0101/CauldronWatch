import React, { useEffect, useState, useRef } from "react";
import PredictedOverflows from "../components/forecast/PredicredOverflows";
import OptimizedRoutes from "../components/forecast/OptimizedRoutes";
import MinimumWitches from "../components/forecast/MinimumWitches";
import DailySchedule from "../components/forecast/DailySchedule";
import {
  requireJson,
  buildPredictions,
  buildRoutes,
} from "../components/forecast/forecastUtils";
import { fetchMinimumWitches, fetchDailySchedule } from "../services/api";
import usePotionStore from "../store/usePotionStore";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(
    /\/$/,
    ""
  );

export default function Forecast() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [nextPickupMins, setNextPickupMins] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [minimumWitches, setMinimumWitches] = useState(null);
  const [dailySchedule, setDailySchedule] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [mode, setMode] = useState("today");
  
  // Listen to real-time cauldron level updates
  const lastUpdate = usePotionStore((state) => state.lastUpdate);
  const cauldrons = usePotionStore((state) => state.cauldrons);
  
  // Debounce ref to avoid too many API calls
  const forecastUpdateTimeoutRef = useRef(null);

  // Function to update forecast data
  const updateForecastData = React.useCallback(async (forceRefresh = false) => {
    // Check store cache first (persists across navigation) - increased cache duration to 1 hour
    if (!forceRefresh) {
      const store = usePotionStore.getState();
      const cached = store.getCachedForecast(60 * 60 * 1000); // 1 hour cache (increased from 3 min)
      if (cached) {
        console.log('[FORECAST] Using cached forecast from store (1 hour cache)');
        setMinimumWitches(cached.minWitches);
        setDailySchedule(cached.schedule);
        setLoadingForecast(false);
        return;
      }
    }
    
    setLoadingForecast(true);
    try {
      console.log('[FORECAST] Fetching fresh forecast data...');
      const [minWitchesData, scheduleData] = await Promise.all([
        fetchMinimumWitches(0.9, 15), // safety_margin=90%, unload_time=15min
        fetchDailySchedule(null),
      ]);
      
      // Cache in store for cross-page navigation (1 hour cache)
      const store = usePotionStore.getState();
      store.setCachedForecast({
        minWitches: minWitchesData,
        schedule: scheduleData
      });
      
      setMinimumWitches(minWitchesData);
      setDailySchedule(scheduleData);
      console.log('[FORECAST] Forecast updated and cached in store (1 hour cache)');
    } catch (err) {
      console.error("[FORECAST] Error loading forecast data:", err);
    } finally {
      setLoadingForecast(false);
    }
  }, []);

  // Initialize forecast data from cache on mount (if available)
  useEffect(() => {
    const store = usePotionStore.getState();
    const cached = store.getCachedForecast(60 * 60 * 1000); // 1 hour cache
    
    if (cached) {
      console.log('[FORECAST] Initializing from cache on mount');
      setMinimumWitches(cached.minWitches);
      setDailySchedule(cached.schedule);
      setLoadingForecast(false);
    }
  }, []); // Run once on mount

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const cauldronsUrl = `${API_BASE}/api/cauldrons`;
        const analysesUrl = `${API_BASE}/api/analysis/cauldrons`;
        const latestUrl = `${API_BASE}/api/data/latest`;
        const couriersUrl = `${API_BASE}/api/couriers`;

        const [caRes, anRes, lvRes, coRes] = await Promise.all([
          fetch(cauldronsUrl),
          fetch(analysesUrl),
          fetch(latestUrl),
          fetch(couriersUrl),
        ]);

        const cauldrons = await requireJson(caRes, "cauldrons");
        const analyses = await requireJson(anRes, "analyses");
        const latest = await requireJson(lvRes, "latest levels");

        let couriers = [];
        if (coRes.ok) {
          const ct = coRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            couriers = await coRes.json();
          } else {
            console.warn(
              "[FORECAST] Couriers not JSON",
              (await coRes.text()).slice(0, 200)
            );
          }
        }

        const { preds, urgent, meta } = buildPredictions({
          cauldrons,
          analyses,
          latest,
        });

        setPredictions(preds);

        const { routes: builtRoutes, nextPickupMins, skipReasons } =
          buildRoutes({ preds, urgent, couriers });

        setRoutes(builtRoutes);
        setNextPickupMins(nextPickupMins);

        setDebugInfo({
          ...meta,
          couriersCount: couriers.length,
          urgentCount: urgent.length,
          skipReasons,
        });

        setLoading(false);

        // OPTIMIZATION: Load forecast data in background (don't block UI)
        // This allows "Predicted Overflows" to show immediately
        // Only fetch if cache doesn't exist or is expired (updateForecastData checks cache)
        console.log("[FORECAST] Checking if forecast data needs to be fetched...");
        updateForecastData(false).catch(err => {
          console.error("[FORECAST] Background forecast error:", err);
        });
      } catch (err) {
        console.error("[FORECAST] Load error:", err);
        setError("Failed to load forecast data.");
        setPredictions([]);
        setRoutes([]);
        setNextPickupMins(null);
        setDebugInfo(null);
        setLoading(false);
      }
    };

    load();
  }, [mode, updateForecastData]);

  // Update forecast when cauldron levels change (real-time updates)
  useEffect(() => {
    // Skip if no cauldrons loaded yet or if it's the initial load
    if (cauldrons.length === 0) {
      return;
    }

    // Debounce forecast updates to avoid too many API calls
    // Wait 5 seconds after last update before recalculating
    if (forecastUpdateTimeoutRef.current) {
      clearTimeout(forecastUpdateTimeoutRef.current);
    }

    forecastUpdateTimeoutRef.current = setTimeout(() => {
      console.log("[FORECAST] Cauldron levels updated, checking if forecast needs update...");
      // Don't force refresh - will use cache if recent enough
      updateForecastData(false);
    }, 10000); // 10 second debounce (increased from 5s)

    return () => {
      if (forecastUpdateTimeoutRef.current) {
        clearTimeout(forecastUpdateTimeoutRef.current);
      }
    };
  }, [lastUpdate, cauldrons.length, updateForecastData]);

  return (
    <div className="space-y-6">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold text-text-light dark:text-slate-50">
          Forecast &amp; Routes
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateForecastData(true)} // Force refresh
            disabled={loadingForecast}
            className="px-3 py-1.5 text-sm rounded-md bg-neutral-700 dark:bg-slate-700 hover:bg-neutral-600 dark:hover:bg-slate-600 text-white dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh forecast data"
          >
            {loadingForecast ? "Refreshing..." : "🔄 Refresh"}
          </button>
          <div className="inline-flex bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-full p-1 gap-1">
            <button
              onClick={() => setMode("today")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === "today"
                ? "bg-sky-500 text-white"
                : "hover:bg-neutral-300 dark:hover:bg-slate-700"
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setMode("tomorrow")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === "tomorrow"
                ? "bg-sky-500 text-white"
                : "hover:bg-neutral-300 dark:hover:bg-slate-700"
                }`}
            >
              Simulate Tomorrow
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <MinimumWitches
        data={minimumWitches}
        loading={loadingForecast}
        error={null}
      />

      <PredictedOverflows
        loading={loading}
        error={error}
        predictions={predictions}
      />

      <DailySchedule
        data={dailySchedule}
        loading={loadingForecast}
        error={null}
      />

      <OptimizedRoutes
        routes={routes}
        nextPickupMins={nextPickupMins}
        error={error}
      />
    </div>
  );
}
