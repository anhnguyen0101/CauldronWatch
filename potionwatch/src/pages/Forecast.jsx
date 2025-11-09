import React, { useEffect, useState } from "react";
import PredictedOverflows from "../components/forecast/PredicredOverflows";
import OptimizedRoutes from "../components/forecast/OptimizedRoutes";
import DebugPanel from "../components/forecast/DebugPanel";
import {
  requireJson,
  buildPredictions,
  buildRoutes,
} from "../components/forecast/forecastUtils";

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
  }, []);

  return (
    <div className="space-y-6">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold text-text-light dark:text-slate-50">
          Forecast &amp; Routes
        </h2>
        <span className="text-xs text-slate-500">
          Based on latest live fill rates
        </span>
      </div>


      {/* Debug */}
      <DebugPanel
        debugInfo={debugInfo}
        loading={loading}
        show={showDebug}
        onToggle={() => setShowDebug((v) => !v)}
      />

      {/* Sections */}
      <PredictedOverflows
        loading={loading}
        error={error}
        predictions={predictions}
      />

      <OptimizedRoutes
        routes={routes}
        nextPickupMins={nextPickupMins}
        error={error}
      />
    </div>
  );
}
