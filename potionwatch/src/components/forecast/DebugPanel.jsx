// src/components/forecast/DebugPanel.jsx
import React from "react";

export default function DebugPanel({ debugInfo, loading, show, onToggle }) {
    if (loading || !debugInfo) return null;

    return (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700">
            <button
                onClick={onToggle}
                className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:text-slate-200 flex items-center justify-between"
            >
                <span>🔍 Debug Information</span>
                <span>{show ? "▼" : "▶"}</span>
            </button>
            {show && (
                <div className="px-4 pb-4 space-y-1 text-xs text-slate-300 font-mono">
                    <div>Cauldrons: {debugInfo.cauldronsCount}</div>
                    <div>Analyses: {debugInfo.analysesCount}</div>
                    <div>Latest levels: {debugInfo.latestCount}</div>
                    <div>Predictions: {debugInfo.basePredictionsCount}</div>
                    <div>Urgent (≤5h): {debugInfo.urgentCount}</div>
                    <div>Couriers: {debugInfo.couriersCount}</div>
                </div>
            )}
        </div>
    );
}
