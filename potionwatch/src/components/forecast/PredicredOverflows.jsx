// src/components/forecast/PredictedOverflows.jsx
import React from "react";
import { riskBadge, barColorForPrediction } from "./forecastUtils";

import safeIcon from "../../assets/cauldron-safe.png";
import warnIcon from "../../assets/cauldron-warn.png";
import dangerIcon from "../../assets/cauldron-danger.png";

// Decide which tiny circle "picture" to show based on minutesToOverflow
function getStatusIcon(minutesToOverflow) {
    // > 2h OR no overflow info → safe
    if (!isFinite(minutesToOverflow) || minutesToOverflow > 120) {
        return {
            src: safeIcon,
            alt: "Safe cauldron",
        };
    }

    // 1–2h → warning
    if (minutesToOverflow > 60 && minutesToOverflow <= 120) {
        return {
            src: warnIcon,
            alt: "Warning cauldron",
        };
    }

    // ≤ 1h → danger
    return {
        src: dangerIcon,
        alt: "Critical cauldron",
    };
}

export default function PredictedOverflows({ loading, error, predictions }) {
    // Show max 12, grid will render 2 columns on md+
    const visible = (predictions || []).slice(0, 12);

    return (
        <div className="bg-panel-light dark:bg-[#050608] text-text-light dark:text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
            <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-2xl font-semibold">Predicted Overflows</h3>
                {loading && (
                    <span className="text-xs text-neutral-600 dark:text-slate-400">Loading…</span>
                )}
            </div>

            {error && (
                <p className="text-neutral-600 dark:text-slate-400 text-sm">
                    Unable to load predictions.
                </p>
            )}

            {!loading && !error && visible.length === 0 && (
                <p className="text-neutral-600 dark:text-slate-400 text-sm">
                    No cauldrons available or no valid data.
                </p>
            )}

            {!loading && !error && visible.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visible.map((p) => {
                        const usedFrac = p.capacity
                            ? Math.max(0, Math.min(1, p.level / p.capacity))
                            : 0;

                        const badge = riskBadge(p);              // text + color (uses your 5h/2h/1h rules)
                        const barClass = barColorForPrediction(p);
                        const icon = getStatusIcon(p.minutesToOverflow);

                            return (
                            <div
                                key={p.id}
                                className="flex items-center gap-3 bg-panel-light/80 border border-border-light dark:bg-slate-950/40 dark:border-slate-800/70 rounded-2xl px-3 py-3"
                            >
                                <div className="w-12 h-12 rounded-full bg-panel-dark dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={icon.src}
                                        alt={icon.alt}
                                        className="w-10 h-10 object-contain"
                                    />
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between mb-1 gap-2">
                                        <div className="text-sm font-medium truncate">
                                            {p.name}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="text-[10px] text-neutral-600 dark:text-slate-500">
                                                {p.capacity
                                                    ? `${Math.round(p.level)}/${p.capacity} L`
                                                    : "capacity unknown"}
                                            </div>
                                            <div
                                                className={`text-[10px] leading-tight ${badge.className}`}
                                            >
                                                {badge.text}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-panel-dark rounded-full overflow-hidden">
                                        <div
                                            className={`${barClass} h-2 rounded-full transition-all`}
                                            style={{ width: `${usedFrac * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
