// src/components/forecast/OptimizedRoutes.jsx
import React from "react";
import { minutesToLabel } from "./forecastUtils";

export default function OptimizedRoutes({ routes, nextPickupMins, error }) {
    return (
        <div className="bg-[#050608] text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
            <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-2xl font-semibold">
                    Optimized Courier Routes
                </h3>
                <div className="text-sm text-slate-400">
                    Next pickup in{" "}
                    {nextPickupMins != null
                        ? minutesToLabel(nextPickupMins)
                        : "—"}
                </div>
            </div>

            {routes.length === 0 || error ? (
                <div className="space-y-2">
                    <p className="text-slate-400">
                        No urgent routes. Couriers are idle. 🧹
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {routes.map((r, idx) => (
                        <div
                            key={`${r.courierName}-${idx}`}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="w-24 text-slate-300">
                                {r.courierName}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-sky-600 text-white text-xs font-semibold">
                                {r.cauldronName}
                            </span>
                            <span className="text-slate-400">
                                → Market · ETA{" "}
                                <span className="text-sky-300 font-medium">
                                    {r.etaLabel}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
