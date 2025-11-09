"""
FastAPI main application
Provides REST endpoints for frontend and other services
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from datetime import datetime
import asyncio
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from threading import Lock


from backend.api.reconcile_service import reconcile_from_live
from backend.api.cached_eog_client import CachedEOGClient
from backend.api.websocket import ws_manager
from backend.database.db import init_db, get_db
from backend.models.schemas import (
    CauldronDto,
    CourierDto,
    MarketDto,
    NetworkDto,
    TicketDto,
    TicketsDto,
    HistoricalDataDto,
    NeighborDto,
    DrainEventDto,
    DrainEventsDto,
    DiscrepancyDto,
    DiscrepanciesDto,
    CauldronAnalysisDto,
    DailyDrainSummaryDto,
)
from backend.api.analysis_service import AnalysisService


_DISCREP_CACHE_LOCK = Lock()
_DISCREP_CACHE: Optional[DiscrepanciesDto] = None
_LAST_DRAIN_EVENTS_LOCK = Lock()
_LAST_DRAIN_EVENTS: Dict[str, List[str]] = {}  # cauldron_id -> list of drain event IDs
_LAST_DISCREPANCY_IDS_LOCK = Lock()
_LAST_DISCREPANCY_IDS: set = set()  # Set of (ticket_id, cauldron_id) tuples

def _set_last_discrepancies(res: DiscrepanciesDto) -> None:
    global _DISCREP_CACHE
    with _DISCREP_CACHE_LOCK:
        _DISCREP_CACHE = res

def _get_last_discrepancies() -> Optional[DiscrepanciesDto]:
    with _DISCREP_CACHE_LOCK:
        return _DISCREP_CACHE

def _to_date(s: str):
    return datetime.strptime(s, "%Y-%m-%d").date()

def _to_iso_string(dt):
    """Safely convert datetime-like object to ISO string"""
    if dt is None:
        return None
    if hasattr(dt, 'isoformat'):
        return dt.isoformat()
    if hasattr(dt, 'strftime'):
        return dt.strftime('%Y-%m-%dT%H:%M:%S')
    return str(dt)

  
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("Starting CauldronWatch API...")
    print("Initializing database...")
    init_db()
    print("✅ Database ready")
    
    # Start background task for periodic updates
    print("Starting background data fetcher...")
    background_task = asyncio.create_task(periodic_update())
    print("✅ Background tasks started")
    
    yield
    
    # Shutdown
    print("Shutting down CauldronWatch API...")
    background_task.cancel()
    try:
        await background_task
    except asyncio.CancelledError:
        pass
    print("✅ Background tasks stopped")


app = FastAPI(
    title="CauldronWatch API",
    description="Backend API for monitoring cauldrons and detecting discrepancies",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Information Endpoints ====================

@app.get("/api/cauldrons", response_model=List[CauldronDto])
async def get_cauldrons(db: Session = Depends(get_db), use_cache: bool = True):
    """Get all cauldrons"""
    try:
        client = CachedEOGClient(db)
        return client.get_cauldrons(use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cauldrons/{cauldron_id}", response_model=CauldronDto)
async def get_cauldron(cauldron_id: str, db: Session = Depends(get_db), use_cache: bool = True):
    """Get a specific cauldron by ID"""
    client = CachedEOGClient(db)
    cauldron = client.get_cauldron_by_id(cauldron_id, use_cache=use_cache)
    if not cauldron:
        raise HTTPException(status_code=404, detail="Cauldron not found")
    return cauldron


@app.get("/api/market", response_model=MarketDto)
async def get_market(db: Session = Depends(get_db), use_cache: bool = True):
    """Get market information"""
    try:
        client = CachedEOGClient(db)
        return client.get_market(use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/couriers", response_model=List[CourierDto])
async def get_couriers(db: Session = Depends(get_db), use_cache: bool = True):
    """Get all couriers"""
    try:
        client = CachedEOGClient(db)
        return client.get_couriers(use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/network", response_model=NetworkDto)
async def get_network(db: Session = Depends(get_db)):
    """Get network graph information"""
    try:
        client = CachedEOGClient(db)
        return client.get_network()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/graph/neighbors/{node_id}", response_model=List[NeighborDto])
async def get_graph_neighbors(node_id: str, directed: bool = False, db: Session = Depends(get_db)):
    """Get graph neighbors for a node"""
    try:
        client = CachedEOGClient(db)
        if directed:
            return client.get_graph_neighbors_directed(node_id)
        else:
            return client.get_graph_neighbors(node_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Data Endpoints ====================

@app.get("/api/data", response_model=List[HistoricalDataDto])
async def get_historical_data(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    cauldron_id: Optional[str] = None,
    db: Session = Depends(get_db),
    use_cache: bool = True
):
    """Get historical data for cauldrons"""
    try:
        client = CachedEOGClient(db)
        return client.get_data(start, end, cauldron_id, use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/latest", response_model=List[HistoricalDataDto])
async def get_latest_levels(db: Session = Depends(get_db), use_cache: bool = True):
    """Get latest level for each cauldron"""
    try:
        client = CachedEOGClient(db)
        return client.get_latest_levels(use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/metadata")
async def get_data_metadata(db: Session = Depends(get_db)):
    """Get metadata about historical data"""
    try:
        client = CachedEOGClient(db)
        return client.get_data_metadata()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Ticket Endpoints ====================

@app.get("/api/tickets", response_model=TicketsDto)
async def get_tickets(db: Session = Depends(get_db), use_cache: bool = True):
    """Get all tickets"""
    try:
        client = CachedEOGClient(db)
        return client.get_tickets(use_cache=use_cache)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Analysis Endpoints (Person 2 - Implemented) ====================

@app.get("/api/analysis/cauldrons/{cauldron_id}", response_model=CauldronAnalysisDto)
async def analyze_cauldron(
    cauldron_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    use_cache: bool = True
):
    """
    Analyze a specific cauldron
    
    Returns fill rate, drain events, and statistics for the cauldron.
    """
    try:
        service = AnalysisService(db)
        return service.analyze_cauldron(
            cauldron_id=cauldron_id,
            start=start,
            end=end,
            use_cache=use_cache
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/cauldrons", response_model=Dict[str, CauldronAnalysisDto])
async def analyze_all_cauldrons(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    use_cache: bool = True
):
    """
    Analyze all cauldrons
    
    Returns analysis results for all cauldrons.
    """
    try:
        service = AnalysisService(db)
        return service.analyze_all_cauldrons(
            start=start,
            end=end,
            use_cache=use_cache
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/drains/{cauldron_id}/{date}", response_model=DailyDrainSummaryDto)
async def get_daily_drain_summary(
    cauldron_id: str,
    date: str,  # YYYY-MM-DD format (or datetime string - will be parsed)
    db: Session = Depends(get_db),
    use_cache: bool = True
):
    """
    Get daily drain summary for a cauldron
    
    This endpoint is used for ticket matching (Person 3).
    Returns all drain events and total volume drained for a specific date.
    
    Date can be in format:
    - YYYY-MM-DD (preferred)
    - YYYY-MM-DDTHH:MM:SS (datetime - date part will be extracted)
    """
    try:
        # Normalize date format - extract just the date part if datetime provided
        if 'T' in date:
            date = date.split('T')[0]
        elif len(date) > 10:
            date = date[:10]
        
        service = AnalysisService(db)
        return service.get_daily_drain_summary(
            cauldron_id=cauldron_id,
            date=date,
            use_cache=use_cache
        )
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"❌ Error in get_daily_drain_summary: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Legacy Endpoints for Person 2 & 3 (Deprecated - Use Analysis Endpoints Above) ====================

@app.post("/api/drains/detect", response_model=DrainEventsDto)
async def detect_drains(
    cauldron_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Detect drain events from historical data
    DEPRECATED: Use /api/analysis/cauldrons/{cauldron_id} instead
    """
    # Redirect to analysis endpoint
    if cauldron_id:
        try:
            service = AnalysisService(db)
            analysis = service.analyze_cauldron(
                cauldron_id=cauldron_id,
                start=start_date,
                end=end_date,
                use_cache=True
            )
            # Convert to DrainEventsDto format
            from backend.models.schemas import DrainEventsDto, DateRange
            # Convert drain events from analysis format
            drain_events = analysis.drain_events  # Already in DrainEventDto format
            return DrainEventsDto(
                events=drain_events,
                total_events=analysis.num_drains,
                date_range=DateRange(start=start_date or datetime.min, end=end_date or datetime.max) if start_date or end_date else None
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(
            status_code=400,
            detail="cauldron_id is required. Use /api/analysis/cauldrons/{cauldron_id} instead."
        )


@app.get("/api/drains", response_model=DrainEventsDto)
async def get_drain_events(
    cauldron_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Get detected drain events
    DEPRECATED: Use /api/analysis/cauldrons/{cauldron_id} instead
    """
    if not cauldron_id:
        raise HTTPException(
            status_code=400,
            detail="cauldron_id is required. Use /api/analysis/cauldrons/{cauldron_id} instead."
        )
    try:
        service = AnalysisService(db)
        analysis = service.analyze_cauldron(
            cauldron_id=cauldron_id,
            start=start_date,
            end=end_date,
            use_cache=True
        )
        from backend.models.schemas import DrainEventsDto, DateRange
        # Convert drain events from analysis format
        drain_events = analysis.drain_events  # Already in DrainEventDto format
        return DrainEventsDto(
            events=drain_events,
            total_events=analysis.num_drains,
            date_range=DateRange(start=start_date or datetime.min, end=end_date or datetime.max) if start_date or end_date else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Discrepancy Detection Endpoints (Person 3) ====================

@app.post("/api/discrepancies/detect", response_model=DiscrepanciesDto)
async def detect_discrepancies(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    use_cache: bool = True
):
    """
    Run ticket↔drain reconciliation over the given window (all cauldrons).
    Person 3's implementation - matches tickets to drain events and detects discrepancies.
    """
    try:
        client = CachedEOGClient(db)
        tickets_dto: TicketsDto = client.get_tickets(use_cache=use_cache)

        # --- filter tickets by window (inclusive) ---
        if start_date or end_date:
            s = start_date.date() if start_date else None
            e = end_date.date()   if end_date   else None
            tickets_dto.transport_tickets = [
                t for t in tickets_dto.transport_tickets
                if ((s is None or _to_date(t.date) >= s) and
                    (e is None or _to_date(t.date) <= e))
            ]

        service = AnalysisService(db)

        # Optional: avoid stale wide cache if a window is specified
        use_cache_for_analysis = use_cache and not (start_date or end_date)

        analyses = service.analyze_all_cauldrons(
            start=start_date,
            end=end_date,
            use_cache=use_cache_for_analysis
        )

        drains: List[DrainEventDto] = []
        for _, ca in analyses.items():
            drains.extend(ca.drain_events)

        result = reconcile_from_live(tickets_dto, drains)
        _set_last_discrepancies(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/discrepancies", response_model=DiscrepanciesDto)
async def get_discrepancies(
    severity: Optional[str] = None,   # "critical" | "warning" | "info"
    cauldron_id: Optional[str] = None,
    db: Session = Depends(get_db)     # kept for symmetry; not used here
):
    """
    Return the most recent discrepancy run (from POST /api/discrepancies/detect),
    optionally filtered by severity and/or cauldron_id.
    """
    last = _get_last_discrepancies()
    if not last:
        raise HTTPException(status_code=404, detail="No discrepancies cached yet. Run POST /api/discrepancies/detect first.")

    if severity and severity not in {"critical", "warning", "info"}:
        raise HTTPException(status_code=400, detail="Invalid severity. Use one of: critical, warning, info.")

    items = last.discrepancies
    if severity:
        items = [d for d in items if d.severity == severity]
    if cauldron_id:
        items = [d for d in items if d.cauldron_id == cauldron_id]

    def _count(level: str) -> int:
        return sum(1 for d in items if d.severity == level)

    return DiscrepanciesDto(
        discrepancies=items,
        total_discrepancies=len(items),
        critical_count=_count("critical"),
        warning_count=_count("warning"),
        info_count=_count("info"),
    )


# ==================== WebSocket Endpoint ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    # Accept connection first (required by FastAPI)
    try:
        await websocket.accept()
    except Exception as e:
        print(f"❌ Error accepting WebSocket: {e}")
        return
    
    # Register with manager AFTER accepting
    if websocket not in ws_manager.active_connections:
        ws_manager.active_connections.append(websocket)
    print(f"✅ WebSocket connected. Total connections: {len(ws_manager.active_connections)}")
    
    try:
        # Send initial connection message
        try:
            await ws_manager.send_personal_message({
                "type": "connected",
                "message": "Connected to CauldronWatch real-time updates"
            }, websocket)
        except Exception as e:
            print(f"⚠️  Error sending initial WebSocket message: {e}")
            # Don't break - connection might still be valid
        
        # Keep connection alive with a simple heartbeat
        # The client doesn't need to send messages, we just broadcast
        import asyncio
        try:
            # Wait for disconnect or client message
            # Use a background task to keep connection alive
            while True:
                try:
                    # Wait for any message from client (or disconnect)
                    # This keeps the connection alive
                    await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=30.0  # 30 second timeout
                    )
                    # Client sent a message - ignore it (we're just broadcasting)
                except asyncio.TimeoutError:
                    # Timeout is normal - connection is still alive
                    # Check if connection is still valid by trying to send a ping
                    try:
                        if websocket.client_state.value == 1:  # CONNECTED
                            await ws_manager.send_personal_message({
                                "type": "ping",
                                "timestamp": datetime.now().isoformat()
                            }, websocket)
                        else:
                            # Connection is not in CONNECTED state
                            break
                    except Exception:
                        # Error sending ping - connection is likely closed
                        break
        except WebSocketDisconnect:
            # Normal disconnect
            pass
    except WebSocketDisconnect:
        pass  # Normal disconnect
    except Exception as e:
        error_msg = str(e).lower()
        if 'connection closed' not in error_msg and 'disconnect' not in error_msg:
            print(f"❌ WebSocket error: {e}")
            import traceback
            traceback.print_exc()
    finally:
        ws_manager.disconnect(websocket)
        print(f"🔌 WebSocket disconnected. Total connections: {len(ws_manager.active_connections)}")


# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "CauldronWatch API"}


# ==================== Background Task (Optional) ====================

async def periodic_update():
    """Periodically fetch and broadcast updates"""
    from backend.database.db import get_db_session
    update_interval = 5  # Update every 5 seconds to avoid rate limiting
    drain_check_interval = 60  # Check for drains every 60 seconds (reduced frequency)
    discrepancy_check_interval = 120  # Check for discrepancies every 2 minutes (reduced frequency)
    api_refresh_interval = 120  # Only fetch from API every 2 minutes (use cache otherwise)
    
    print(f"🔄 Background updater started (interval: {update_interval}s, API refresh: {api_refresh_interval}s)")
    print(f"   Drain check: every {drain_check_interval}s, Discrepancy check: every {discrepancy_check_interval}s")
    
    last_drain_check = 0
    last_discrepancy_check = 0
    last_api_fetch = 0
    rate_limit_backoff = 0  # Track if we're in rate limit backoff
    
    while True:
        try:
            await asyncio.sleep(update_interval)
            current_time = datetime.now().timestamp()
            
            # Get database session
            db = get_db_session()
            try:
                # Use longer cache TTL to reduce API calls
                client = CachedEOGClient(db, cache_ttl_minutes=10)
                
                # If we're in rate limit backoff, extend the interval
                effective_refresh_interval = api_refresh_interval
                if rate_limit_backoff > 0:
                    effective_refresh_interval = api_refresh_interval * 2  # Double the interval if we hit rate limits
                    rate_limit_backoff = max(0, rate_limit_backoff - 1)  # Decrease backoff counter
                
                # Only fetch from API every N seconds to avoid rate limiting
                should_fetch_from_api = (current_time - last_api_fetch) >= effective_refresh_interval
                
                # Fetch and cache latest data
                # Only log every 30 seconds to reduce console spam
                if int(current_time) % 30 == 0:
                    print(f"📊 Fetching latest data... (API: {'yes' if should_fetch_from_api else 'cache'})")
                
                # Update cauldrons (static data, use cache aggressively)
                cauldrons = client.get_cauldrons(use_cache=True)
                
                # Fetch latest levels - use cache unless it's time for a fresh fetch
                # This reduces API calls while still providing near-real-time updates
                try:
                    latest_levels = client.get_latest_levels(use_cache=not should_fetch_from_api)
                    if should_fetch_from_api:
                        last_api_fetch = current_time
                        rate_limit_backoff = 0  # Reset backoff on successful fetch
                except Exception as e:
                    # If we hit a rate limit, use cache and extend backoff
                    if '429' in str(e) or 'rate limit' in str(e).lower():
                        print(f"⚠️  Rate limit detected, using cache and extending backoff")
                        rate_limit_backoff = 5  # Back off for 5 cycles
                        latest_levels = client.get_latest_levels(use_cache=True)  # Force cache
                    else:
                        # Other errors - still use cache
                        latest_levels = client.get_latest_levels(use_cache=True)
                
                # Update cache with latest data
                if latest_levels:
                    from backend.database.cache import CacheManager
                    cache = CacheManager(db)
                    # Cache the latest levels
                    cache.cache_historical_data(latest_levels, clear_old=False)
                
                # Broadcast to all connected WebSocket clients
                # Enrich level data with cauldron metadata (max_volume) for frontend percentage calculation
                if latest_levels and len(latest_levels) > 0:
                    # Create a lookup map for cauldron metadata (use both id and cauldron_id property)
                    cauldron_map = {}
                    for c in cauldrons:
                        cauldron_map[c.id] = c
                        cauldron_map[c.cauldron_id] = c  # Also index by cauldron_id property
                    
                    # Enrich each level update with cauldron metadata
                    enriched_updates = []
                    for level_data in latest_levels:
                        # Try to find cauldron by cauldron_id first, then by id
                        cauldron_info = cauldron_map.get(level_data.cauldron_id) or cauldron_map.get(getattr(level_data, 'id', None))
                        update_dict = level_data.model_dump()
                        # Add max_volume and capacity for frontend percentage calculation
                        if cauldron_info:
                            update_dict['max_volume'] = cauldron_info.max_volume
                            update_dict['capacity'] = cauldron_info.max_volume  # Alias for compatibility
                            update_dict['name'] = cauldron_info.name
                            # Ensure cauldron_id is set
                            update_dict['cauldron_id'] = level_data.cauldron_id
                            # Log sample data for debugging
                            if len(enriched_updates) < 2:
                                print(f"📊 Broadcasting level update: {level_data.cauldron_id} = {level_data.level}L / {cauldron_info.max_volume}L = {round((level_data.level / cauldron_info.max_volume) * 100, 1)}%")
                        else:
                            print(f"⚠️  No cauldron info found for {level_data.cauldron_id} (available IDs: {list(cauldron_map.keys())[:5]}...)")
                        enriched_updates.append(update_dict)
                    
                    if enriched_updates:
                        await ws_manager.broadcast_cauldron_update({
                            "cauldrons": enriched_updates,
                            "timestamp": datetime.now().isoformat()
                        })
                else:
                    # Log when no levels are available
                    if int(current_time) % 60 == 0:  # Only log every minute to avoid spam
                        print(f"⚠️  No latest levels to broadcast (cache may be empty)")
                
                # Check for new drain events (every 30 seconds)
                if current_time - last_drain_check >= drain_check_interval:
                    last_drain_check = current_time
                    try:
                        service = AnalysisService(db)
                        # Get recent analysis (last hour)
                        from datetime import timedelta
                        import pandas as pd
                        # Convert to pandas Timestamp (timezone-naive) to avoid comparison issues
                        start_time = pd.Timestamp(datetime.now() - timedelta(hours=1), tz=None)
                        try:
                            # Use cache for drain detection to avoid API calls
                            analyses = service.analyze_all_cauldrons(start=start_time, use_cache=True)
                        except Exception as e:
                            # If rate limit, skip this cycle
                            if '429' in str(e) or 'rate limit' in str(e).lower():
                                print(f"⚠️  Rate limit in drain detection, skipping this cycle")
                                continue
                            print(f"⚠️ Error in drain analysis (will retry next cycle): {e}")
                            import traceback
                            traceback.print_exc()
                            continue
                        
                        global _LAST_DRAIN_EVENTS
                        with _LAST_DRAIN_EVENTS_LOCK:
                            for cauldron_id, analysis in analyses.items():
                                if analysis.drain_events:
                                    # Create unique IDs for drain events
                                    current_drain_ids = []
                                    for d in analysis.drain_events:
                                        # Handle both datetime and pandas Timestamp
                                        start_str = _to_iso_string(d.start_time)
                                        current_drain_ids.append(f"{d.cauldron_id}@{start_str}")
                                    
                                    # Get previous drain IDs for this cauldron
                                    previous_ids = _LAST_DRAIN_EVENTS.get(cauldron_id, [])
                                    
                                    # Find new drains
                                    new_drain_ids = set(current_drain_ids) - set(previous_ids)
                                    
                                    if new_drain_ids:
                                        # Broadcast new drain events
                                        for drain in analysis.drain_events:
                                            # Convert to string for ID comparison
                                            start_time_str = _to_iso_string(drain.start_time)
                                            drain_id = f"{drain.cauldron_id}@{start_time_str}"
                                            if drain_id in new_drain_ids:
                                                # Ensure all values are JSON-serializable
                                                start_ts = _to_iso_string(drain.start_time)
                                                end_ts = _to_iso_string(drain.end_time)
                                                volume = float(drain.volume_drained) if drain.volume_drained is not None else 0.0
                                                drain_rate = float(getattr(drain, 'drain_rate', 0)) if getattr(drain, 'drain_rate', None) is not None else None
                                                
                                                await ws_manager.broadcast_drain_event({
                                                    "cauldron_id": str(drain.cauldron_id),
                                                    "start_time": start_ts,
                                                    "end_time": end_ts,
                                                    "volume_drained": volume,
                                                    "drain_rate": drain_rate
                                                })
                                                print(f"💧 New drain event detected: {drain.cauldron_id} at {start_ts}")
                                    
                                    # Update stored drain IDs
                                    _LAST_DRAIN_EVENTS[cauldron_id] = current_drain_ids
                    except Exception as e:
                        print(f"❌ Error checking for drain events: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Check for new discrepancies (every 60 seconds)
                if current_time - last_discrepancy_check >= discrepancy_check_interval:
                    last_discrepancy_check = current_time
                    try:
                        # Run discrepancy detection
                        # Use cache aggressively to avoid rate limits
                        tickets_dto = client.get_tickets(use_cache=True)
                        service = AnalysisService(db)
                        
                        # Get recent analysis (last 24 hours)
                        from datetime import timedelta
                        import pandas as pd
                        # Use timezone-naive Timestamp to avoid comparison issues
                        start_time = pd.Timestamp(datetime.now() - timedelta(hours=24), tz=None)
                        try:
                            analyses = service.analyze_all_cauldrons(start=start_time, use_cache=True)
                        except Exception as e:
                            # If rate limit, skip this cycle
                            if '429' in str(e) or 'rate limit' in str(e).lower():
                                print(f"⚠️  Rate limit in discrepancy detection, skipping this cycle")
                                continue
                            raise
                        
                        drains: List[DrainEventDto] = []
                        for _, ca in analyses.items():
                            drains.extend(ca.drain_events)
                        
                        if tickets_dto.transport_tickets and drains:
                            result = reconcile_from_live(tickets_dto, drains)
                            _set_last_discrepancies(result)
                            
                            # Check for new discrepancies
                            global _LAST_DISCREPANCY_IDS
                            with _LAST_DISCREPANCY_IDS_LOCK:
                                current_discrepancy_ids = {
                                    (d.ticket_id, d.cauldron_id) 
                                    for d in result.discrepancies 
                                    if d.severity in ("critical", "warning")  # Only alert on critical/warning
                                }
                                
                                new_discrepancy_ids = current_discrepancy_ids - _LAST_DISCREPANCY_IDS
                                
                                if new_discrepancy_ids:
                                    # Broadcast new discrepancies
                                    for disc in result.discrepancies:
                                        disc_key = (disc.ticket_id, disc.cauldron_id)
                                        if disc_key in new_discrepancy_ids and disc.severity in ("critical", "warning"):
                                            # Ensure all values are JSON-serializable
                                            await ws_manager.broadcast_discrepancy({
                                                "severity": str(disc.severity),
                                                "cauldron_id": str(disc.cauldron_id),
                                                "ticket_id": str(disc.ticket_id),
                                                "discrepancy": float(disc.discrepancy) if disc.discrepancy is not None else 0.0,
                                                "discrepancy_percent": float(disc.discrepancy_percent) if disc.discrepancy_percent is not None else 0.0,
                                                "message": f"Ticket {disc.ticket_id} at {disc.cauldron_id}: {disc.discrepancy:+.1f}L difference ({disc.discrepancy_percent:.1f}%)"
                                            })
                                            print(f"🚨 New discrepancy detected: {disc.severity} - {disc.cauldron_id} / {disc.ticket_id}")
                                    
                                    # Update stored discrepancy IDs
                                    _LAST_DISCREPANCY_IDS = current_discrepancy_ids
                    except Exception as e:
                        print(f"❌ Error checking for discrepancies: {e}")
                        import traceback
                        traceback.print_exc()
                
            except Exception as e:
                print(f"❌ Error in periodic update: {e}")
                import traceback
                traceback.print_exc()
            finally:
                db.close()
                
        except asyncio.CancelledError:
            print("🛑 Background updater cancelled")
            break
        except Exception as e:
            print(f"❌ Fatal error in background updater: {e}")
            await asyncio.sleep(60)  # Wait before retrying


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

