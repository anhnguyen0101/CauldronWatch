from datetime import datetime
from typing import List

from backend.models.schemas import (
    TicketsDto,
    DrainEventDto,
    DiscrepancyDto,
    DiscrepanciesDto,
)
from backend.detection.ticket_matcher import (
    Ticket as MTicket,
    DrainEvent as MDrain,
    match_tickets_to_drains,
)

from backend.detection.config import TOL_ABS, TOL_PCT, WARN_PCT


def _to_date(s: str):
    return datetime.strptime(s, "%Y-%m-%d").date()

def _mk_drain_id(d: DrainEventDto) -> str:
    # synthesize a stable ID from fields Person 2 provides
    return f"{d.cauldron_id}@{d.start_time.isoformat()}"

def _drain_volume(d: DrainEventDto) -> float:
    # prefer true_volume; fall back to volume_drained
    v = d.true_volume if d.true_volume is not None else d.volume_drained
    return float(v or 0.0)

def _severity_from(status: str, diff: float, basis: float) -> str:
    # If the matcher said "valid", it's info.
    if status in ("valid", "cross_day_valid"):
        return "info"

    # Also treat differences within tolerance as info.
    tol = max(TOL_ABS, TOL_PCT * max(basis, 1.0))
    if abs(diff) <= tol:
        return "info"

    # Past tolerance → warning vs critical based on % off.
    pct_off = abs(diff) / max(basis, 1.0)
    return "warning" if pct_off <= WARN_PCT else "critical"

def reconcile_from_live(tickets: TicketsDto, drains: List[DrainEventDto]) -> DiscrepanciesDto:
    """Convert live Tickets/Drains → run matcher → DiscrepanciesDto"""
    # 1) adapt inputs to matcher structs
    m_tickets = [
        MTicket(
            ticket_id=t.ticket_id,
            cauldron_id=t.cauldron_id,
            date=_to_date(t.date),
            amount_collected=float(t.amount_collected),
            courier_id=t.courier_id,
        )
        for t in tickets.transport_tickets
    ]

    m_drains = [
        MDrain(
            drain_event_id=_mk_drain_id(d),
            cauldron_id=d.cauldron_id,
            start_ts=d.start_time,
            end_ts=d.end_time,
            drained_volume=_drain_volume(d),
        )
        for d in drains
    ]

    # 2) run matching
    res = match_tickets_to_drains(m_tickets, m_drains)

    # 3) convert matches → DiscrepancyDto list
    discrepancies: List[DiscrepancyDto] = []
    for m in res["matches"]:
        ticket_volume = m.drained_volume + m.difference
        basis = max(ticket_volume, m.drained_volume, 1.0)

        discrepancy_percent = round(abs(m.difference) / basis * 100.0, 2)
        severity = _severity_from(m.status, m.difference, basis)
        discrepancies.append(DiscrepancyDto(
            ticket_id=m.ticket_id,
            cauldron_id=m.cauldron_id,
            date=m.match_date.isoformat() if m.match_date else "",
            ticket_volume=ticket_volume,
            actual_drained=m.drained_volume,
            discrepancy=m.difference,
            discrepancy_percent=discrepancy_percent,
            severity=severity,
            matched_drain_events=m.drain_event_ids,
        ))

    # 4) summary buckets
    critical = sum(1 for d in discrepancies if d.severity == "critical")
    warning  = sum(1 for d in discrepancies if d.severity == "warning")
    info     = sum(1 for d in discrepancies if d.severity == "info")

    return DiscrepanciesDto(
        discrepancies=discrepancies,
        total_discrepancies=len(discrepancies),
        critical_count=critical,
        warning_count=warning,
        info_count=info,
    )
