// src/components/forecast/forecastUtils.js

export function minutesToLabel(mins) {
    if (!isFinite(mins) || mins < 0) return "now";
    if (mins < 1) return "<1m";
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------- RISK + COLOR HELPERS ----------

export function riskBadge(p) {
    if (!p.capacity || !isFinite(p.level)) {
        return { text: "No data", className: "text-slate-400" };
    }

    const remaining = p.capacity - p.level;

    if (remaining <= 0) {
        return { text: "Overflowing", className: "text-red-400 font-semibold" };
    }

    const eta = p.minutesToOverflow;

    // > 5h or no ETA ⇒ safe
    if (!isFinite(eta) || eta > 300) {
        return { text: "Good", className: "text-emerald-400 font-medium" };
    }

    if (eta <= 60) {
        return {
            text: `Overflow in ${minutesToLabel(eta)}`,
            className: "text-red-400 font-semibold",
        };
    }
    if (eta <= 120) {
        return {
            text: `Overflow in ${minutesToLabel(eta)}`,
            className: "text-yellow-400 font-medium",
        };
    }
    // 2–5h
    return {
        text: `Overflow in ${minutesToLabel(eta)}`,
        className: "text-emerald-400 font-medium",
    };
}

export function barColorForPrediction(p) {
    if (!p.capacity || !isFinite(p.level)) return "bg-slate-700";

    const remaining = p.capacity - p.level;
    if (remaining <= 0) return "bg-red-500";

    const eta = p.minutesToOverflow;
    if (!isFinite(eta) || eta > 300) return "bg-emerald-500";

    if (eta <= 60) return "bg-red-500";
    if (eta <= 120) return "bg-yellow-400";
    return "bg-emerald-400"; // 2–5h
}

// ---------- FETCH HELPER ----------

export async function requireJson(res, label) {
    if (!res.ok) {
        const text = await res.text();
        console.error(
            `[FORECAST] ${label} error`,
            res.status,
            text.slice(0, 200)
        );
        throw new Error(`Failed to load ${label}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
        const text = await res.text();
        console.error(
            `[FORECAST] ${label} not JSON`,
            text.slice(0, 200)
        );
        throw new Error(`${label} response not JSON`);
    }
    return res.json();
}

// ---------- PREDICTIONS ----------

export function buildPredictions({ cauldrons, analyses, latest, mode }) {
    const latestById = {};
    for (const row of latest || []) {
        if (!row.cauldron_id) continue;
        const id = row.cauldron_id;
        const ts = new Date(row.timestamp).getTime();
        if (!latestById[id] || ts > latestById[id].ts) {
            latestById[id] = {
                level: Number(row.level) || 0,
                ts,
            };
        }
    }

    const preds = [];
    const skipReasons = { noCapacity: 0, noLevel: 0 };
    const zeroFillRates = [];
    const analysisErrors = [];

    for (const c of cauldrons || []) {
        const id = c.id || c.cauldron_id;
        const capacity = Number(c.max_volume) || 0;
        if (!id || !capacity) {
            skipReasons.noCapacity++;
            continue;
        }

        const latestEntry = latestById[id];
        const level =
            (latestEntry && latestEntry.level) ??
            (c.current_level != null ? Number(c.current_level) : NaN);

        if (!isFinite(level)) {
            skipReasons.noLevel++;
            continue;
        }

        const ana = analyses && analyses[id];
        if (ana?.error) {
            analysisErrors.push({ id, error: ana.error });
        }

        let fillRate = 0;
        if (ana && typeof ana.fill_rate === "number") {
            fillRate = ana.fill_rate;
        } else if (c.fill_rate != null) {
            fillRate = Number(c.fill_rate) || 0;
        }
        if (!fillRate) zeroFillRates.push(id);

        const remaining = capacity - level;
        let minutesToOverflow = Number.POSITIVE_INFINITY;

        if (remaining <= 0) {
            minutesToOverflow = 0;
        } else if (fillRate > 0) {
            minutesToOverflow = remaining / fillRate;
            if (mode === "tomorrow") {
                minutesToOverflow *= 0.9 + Math.random() * 0.2;
            }
        }

        preds.push({
            id,
            name: c.name || id,
            capacity,
            level,
            minutesToOverflow,
        });
    }

    preds.sort((a, b) => a.minutesToOverflow - b.minutesToOverflow);

    const urgent = preds.filter(
        (p) => isFinite(p.minutesToOverflow) && p.minutesToOverflow <= 300
    );

    return {
        preds,
        urgent,
        meta: {
            cauldronsCount: (cauldrons || []).length,
            analysesCount: analyses ? Object.keys(analyses).length : 0,
            latestCount: (latest || []).length,
            basePredictionsCount: preds.length,
            skipReasons,
            zeroFillRatesCount: zeroFillRates.length,
            analysisErrors,
        },
    };
}

// ---------- ROUTES ----------

export function buildRoutes({ preds, urgent, couriers }) {
    const routes = [];
    const skipReasons = {};

    if (!couriers || couriers.length === 0) {
        skipReasons.noCouriers = true;
        return { routes, nextPickupMins: null, skipReasons };
    }

    if (!preds || preds.length === 0) {
        skipReasons.noPredictions = true;
        return { routes, nextPickupMins: null, skipReasons };
    }

    const source = urgent.length ? urgent : [];

    source.forEach((p, idx) => {
        if (!couriers[idx]) return;
        if (!isFinite(p.minutesToOverflow)) return;

        routes.push({
            courierName: couriers[idx].name || couriers[idx].courier_id,
            cauldronName: p.name,
            minutes: p.minutesToOverflow,
            etaLabel: minutesToLabel(p.minutesToOverflow),
        });
    });

    const mins = routes
        .map((r) => r.minutes)
        .filter((m) => isFinite(m) && m >= 0);
    const nextPickupMins =
        mins.length > 0 ? Math.min(...mins) : null;

    return { routes, nextPickupMins, skipReasons };
}
