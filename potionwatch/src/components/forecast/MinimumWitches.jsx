// src/components/forecast/MinimumWitches.jsx
import React from "react";

export default function MinimumWitches({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-panel-light dark:bg-[#050608] text-text-light dark:text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
        <h3 className="text-2xl font-semibold mb-3">Minimum Witches Needed</h3>
        <p className="text-neutral-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-panel-light dark:bg-[#050608] text-text-light dark:text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
        <h3 className="text-2xl font-semibold mb-3">Minimum Witches Needed</h3>
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { minimum_witches, cauldrons_serviced, total_cauldrons, verification } = data;

  return (
    <div className="bg-panel-light dark:bg-[#050608] text-text-light dark:text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-2xl font-semibold">Minimum Witches Needed</h3>
        {verification?.schedule_repeats && (
          <div className="text-sm text-emerald-600 dark:text-emerald-400">
            ✅ Repeating Schedule
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl font-bold text-sky-600 dark:text-sky-400">
            {minimum_witches}
          </div>
          <div className="text-text-light dark:text-slate-300">
            {minimum_witches === 1 ? "witch" : "witches"} required
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-light dark:border-slate-800">
          <div>
            <div className="text-sm text-neutral-600 dark:text-slate-400">Cauldrons Serviced</div>
            <div className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">
              {cauldrons_serviced}
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-600 dark:text-slate-400">Total Cauldrons</div>
            <div className="text-xl font-semibold text-text-light dark:text-slate-300">
              {total_cauldrons}
            </div>
          </div>
        </div>

        {verification?.overflow_prevented && (
          <div className="pt-2 text-sm text-emerald-600 dark:text-emerald-400">
            ✅ Schedule prevents overflow forever
          </div>
        )}
        
        {verification?.schedule_repeats && (
          <div className="pt-1 text-xs text-neutral-600 dark:text-slate-400">
            This schedule repeats daily
          </div>
        )}
      </div>
    </div>
  );
}

