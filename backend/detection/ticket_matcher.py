from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, List, Dict, Tuple
from .discrepancy import classify, confidence

@dataclass(frozen=True)
class Ticket:
    ticket_id: str
    cauldron_id: str
    date: date
    amount_collected: float
    courier_id: Optional[str] = None

@dataclass(frozen=True)
class DrainEvent:
    # We'll synthesize an ID: f"{cauldron_id}@{start_iso}"
    drain_event_id: str
    cauldron_id: str
    start_ts: datetime
    end_ts: datetime
    drained_volume: float

@dataclass
class MatchResult:
    ticket_id: str
    cauldron_id: str
    drain_event_ids: List[str]
    drained_volume: float
    difference: float
    pct_diff: float
    status: str
    confidence: float
    cross_day: bool = False
    match_date: Optional[date] = None

def _key_day(ts: datetime) -> date:
    return ts.date()

def match_tickets_to_drains(tickets: List[Ticket], drains: List[DrainEvent]) -> Dict[str, List]:
    # group by (cauldron, day)
    drains_by_key: Dict[Tuple[str, date], List[DrainEvent]] = {}
    for d in sorted(drains, key=lambda x: (x.cauldron_id, x.start_ts)):
        drains_by_key.setdefault((d.cauldron_id, _key_day(d.start_ts)), []).append(d)

    tickets_by_key: Dict[Tuple[str, date], List[Ticket]] = {}
    for t in sorted(tickets, key=lambda x: (x.cauldron_id, x.date, x.ticket_id)):
        tickets_by_key.setdefault((t.cauldron_id, t.date), []).append(t)

    matches: List[MatchResult] = []
    used: set = set()

    # greedy 1→N per (cauldron, day)
    for key, day_tickets in tickets_by_key.items():
        cid, day = key
        day_drains = drains_by_key.get(key, [])
        ptr = 0
        for tk in day_tickets:
            # advance to first unused drain
            while ptr < len(day_drains) and day_drains[ptr].drain_event_id in used:
                ptr += 1
            cur_ids: List[str] = []
            cur_sum = 0.0
            j = ptr
            while j < len(day_drains):
                d = day_drains[j]
                if d.drain_event_id in used:
                    j += 1
                    continue
                trial = cur_sum + d.drained_volume
                # keep the addition only if it improves closeness
                if abs(tk.amount_collected - trial) <= abs(tk.amount_collected - cur_sum):
                    cur_sum = trial
                    cur_ids.append(d.drain_event_id)
                    j += 1
                    if cur_sum >= tk.amount_collected:
                        break
                else:
                    break
            if cur_ids:
                for did in cur_ids: used.add(did)
                ptr = j
            diff = tk.amount_collected - cur_sum
            pct = (abs(diff) / max(cur_sum, 1.0)) * 100.0 if cur_sum > 0 else 100.0
            status = classify(diff, cur_sum, cross_day=False) if cur_ids else "unmatched"
            conf = confidence(diff, cur_sum if cur_sum > 0 else tk.amount_collected,
                              len(cur_ids) if cur_ids else 1)
            matches.append(MatchResult(
                ticket_id=tk.ticket_id,
                cauldron_id=cid,
                drain_event_ids=cur_ids,
                drained_volume=cur_sum,
                difference=diff,
                pct_diff=pct,
                status=status,
                confidence=conf,
                cross_day=False,
                match_date=day
            ))
    unmatched = [d for d in drains if d.drain_event_id not in used]
    return {"matches": matches, "unmatched_drains": unmatched}
