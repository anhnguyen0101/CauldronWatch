// src/components/forecast/DailySchedule.jsx
import React from "react";

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function DailySchedule({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-[#050608] text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
        <h3 className="text-2xl font-semibold mb-3">Daily Pickup Schedule</h3>
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#050608] text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
        <h3 className="text-2xl font-semibold mb-3">Daily Pickup Schedule</h3>
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data || !data.schedules || data.schedules.length === 0) {
    return (
      <div className="bg-[#050608] text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
        <h3 className="text-2xl font-semibold mb-3">Daily Pickup Schedule</h3>
        <p className="text-slate-400">No schedule generated</p>
      </div>
    );
  }

  const { schedules, date, total_tasks } = data;

  return (
    <div className="bg-[#050608] text-slate-50 rounded-3xl px-6 py-5 shadow-xl">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-2xl font-semibold">Daily Pickup Schedule</h3>
        <div className="flex items-center gap-3">
          {data.repeating && (
            <div className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
              🔁 Repeating Daily
            </div>
          )}
          {date && (
            <div className="text-sm text-slate-400">
              {new Date(date).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-slate-400 mb-4">
        {total_tasks} total tasks across {schedules.length} {schedules.length === 1 ? "witch" : "witches"}
      </div>

      <div className="space-y-4">
        {schedules.map((schedule, idx) => (
          <div
            key={schedule.courier_id || idx}
            className="bg-slate-950/40 border border-slate-800/70 rounded-2xl px-4 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-semibold text-sky-300">
                  {schedule.courier_name || schedule.courier_id}
                </div>
                <div className="text-xs text-slate-400">
                  Capacity: {Math.round(schedule.capacity)}L
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-300">
                  {schedule.tasks.length} {schedule.tasks.length === 1 ? "task" : "tasks"}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDuration(schedule.total_time_minutes)} total
                </div>
              </div>
            </div>

            {schedule.route && schedule.route.length > 0 && (
              <div className="mb-2 text-xs text-slate-500">
                Route: {schedule.route.join(' → ')}
              </div>
            )}
            
            {schedule.tasks && schedule.tasks.length > 0 && (
              <div className="space-y-2 mt-3">
                {schedule.tasks.map((task, taskIdx) => (
                  <div
                    key={taskIdx}
                    className="flex items-center gap-3 text-sm bg-slate-900/40 rounded-lg px-3 py-2"
                  >
                    <div className="w-20 text-slate-400 text-xs">
                      {task.pickup_time ? formatTime(task.pickup_time) : 
                       `${Math.round(task.pickup_time_minutes || 0)}m`}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">
                        {task.cauldron_name || task.cauldron_id}
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.round(task.expected_volume || 0)}L • {formatDuration(task.total_time_minutes || 0)}
                        {task.drain_duration && ` (drain: ${formatDuration(task.drain_duration)})`}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      → Market
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
              Total volume: {Math.round(schedule.total_volume)}L / {Math.round(schedule.capacity)}L
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

