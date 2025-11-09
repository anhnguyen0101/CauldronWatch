"""
Cached EOG API Client
Wraps EOGClient with caching functionality
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.api.eog_client import EOGClient
from backend.database.cache import CacheManager
from backend.models.schemas import (
    CauldronDto,
    HistoricalDataDto,
    TicketDto,
    TicketsDto,
    MarketDto,
    CourierDto
)


class CachedEOGClient:
    """EOG Client with database caching"""
    
    def __init__(self, db: Session, cache_ttl_minutes: int = 5):
        self.eog_client = EOGClient()
        self.cache = CacheManager(db)
        self.cache_ttl = cache_ttl_minutes
    
    # ==================== Cauldrons ====================
    
    def get_cauldrons(self, use_cache: bool = True) -> List[CauldronDto]:
        """Get cauldrons with caching and error handling"""
        if use_cache:
            cached = self.cache.get_cached_cauldrons(max_age_minutes=self.cache_ttl)
            if cached:
                return cached
        
        # Fetch from API with fallback to stale cache
        try:
            cauldrons = self.eog_client.get_cauldrons()
            # Cache the results (always cache fetched data)
            # This will automatically calculate and store x, y positions
            if use_cache:
                self.cache.cache_cauldrons(cauldrons)
                # Return cached version which includes x, y coordinates
                cached = self.cache.get_cached_cauldrons(max_age_minutes=999999)
                if cached:
                    return cached
            return cauldrons
        except Exception as e:
            error_str = str(e)
            # Special handling for rate limits - always use stale cache
            if '429' in error_str or 'rate limit' in error_str.lower() or 'Too Many Requests' in error_str:
                print(f"⚠️  Rate limit (429) fetching cauldrons, using stale cache")
                if use_cache:
                    stale_cache = self.cache.get_cached_cauldrons(max_age_minutes=1440)  # Allow 24 hours old for rate limits
                    if stale_cache:
                        print("   ✅ Using stale cache as fallback")
                        return stale_cache
            else:
                print(f"⚠️  API error fetching cauldrons: {e}")
            
            # Fallback to stale cache if available
            if use_cache:
                stale_cache = self.cache.get_cached_cauldrons(max_age_minutes=60)  # Allow 1 hour old
                if stale_cache:
                    print("   Using stale cache as fallback")
                    return stale_cache
            raise  # Re-raise if no cache available
    
    def get_cauldron_by_id(self, cauldron_id: str, use_cache: bool = True) -> Optional[CauldronDto]:
        """Get a specific cauldron by ID"""
        cauldrons = self.get_cauldrons(use_cache=use_cache)
        for cauldron in cauldrons:
            if cauldron.cauldron_id == cauldron_id:
                return cauldron
        return None
    
    # ==================== Historical Data ====================
    
    def get_data(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        cauldron_id: Optional[str] = None,
        use_cache: bool = True
    ) -> List[HistoricalDataDto]:
        """Get historical data with caching"""
        if use_cache:
            # Try cache first
            cached = self.cache.get_cached_historical_data(
                cauldron_id=cauldron_id,
                start_date=start_date,
                end_date=end_date
            )
            # If we have cached data and it covers the requested range, use it
            if cached and len(cached) > 0:
                # For now, always fetch fresh data if specific dates requested
                # Could be optimized to check if cache covers the range
                if start_date is None and end_date is None:
                    return cached
        
        # Fetch from API
        try:
            data = self.eog_client.get_data(
                start_date=start_date,
                end_date=end_date,
                cauldron_id=cauldron_id
            )
            
            # Cache the results (only if not too much data)
            if use_cache and len(data) < 10000:  # Don't cache huge datasets
                self.cache.cache_historical_data(data, clear_old=False)
            
            return data
        except Exception as e:
            error_str = str(e)
            # Special handling for rate limits - use stale cache
            if '429' in error_str or 'rate limit' in error_str.lower() or 'Too Many Requests' in error_str:
                print(f"⚠️  Rate limit (429) fetching data, using stale cache")
                if use_cache:
                    # Try to get cached data even if it's old
                    cached = self.cache.get_cached_historical_data(
                        cauldron_id=cauldron_id,
                        start_date=start_date,
                        end_date=end_date
                    )
                    if cached:
                        print("   ✅ Using stale cache as fallback")
                        return cached
            raise  # Re-raise if no cache available
    
    def get_latest_levels(self, use_cache: bool = True) -> List[HistoricalDataDto]:
        """Get latest level for each cauldron"""
        if use_cache:
            # Try to get from cache
            cauldrons = self.get_cauldrons(use_cache=True)
            latest_levels = []
            for cauldron in cauldrons:
                latest = self.cache.get_latest_historical_data(cauldron_id=cauldron.cauldron_id)
                if latest:
                    latest_levels.append(latest)
                else:
                    # Log when cache is empty for a cauldron
                    print(f"⚠️  No cached data for {cauldron.cauldron_id}")
            
            if latest_levels:
                # Log sample data
                if len(latest_levels) > 0:
                    sample = latest_levels[0]
                    print(f"📊 Returning {len(latest_levels)} cached levels (sample: {sample.cauldron_id} = {sample.level}L)")
                return latest_levels
        
        # Fetch latest from API (get most recent data point)
        try:
            print("📊 Fetching latest levels from API...")
            all_data = self.eog_client.get_data()
            if not all_data:
                print("⚠️  API returned no data")
                return []
            
            print(f"📊 API returned {len(all_data)} data points")
            
            # Group by cauldron and get latest
            latest_by_cauldron = {}
            for item in all_data:
                if item.cauldron_id not in latest_by_cauldron:
                    latest_by_cauldron[item.cauldron_id] = item
                elif item.timestamp > latest_by_cauldron[item.cauldron_id].timestamp:
                    latest_by_cauldron[item.cauldron_id] = item
            
            # Log sample data
            if latest_by_cauldron:
                sample_id = list(latest_by_cauldron.keys())[0]
                sample = latest_by_cauldron[sample_id]
                print(f"📊 Latest levels for {len(latest_by_cauldron)} cauldrons (sample: {sample_id} = {sample.level}L)")
            
            # Cache the latest levels
            if use_cache:
                self.cache.cache_historical_data(list(latest_by_cauldron.values()), clear_old=False)
                print(f"✅ Cached {len(latest_by_cauldron)} latest levels")
            
            return list(latest_by_cauldron.values())
        except Exception as e:
            error_str = str(e)
            # Special handling for rate limits - use stale cache
            if '429' in error_str or 'rate limit' in error_str.lower() or 'Too Many Requests' in error_str:
                print(f"⚠️  Rate limit (429) fetching latest levels, using stale cache")
                # Try to get from cache even if old
                cauldrons = self.get_cauldrons(use_cache=True)
                latest_levels = []
                for cauldron in cauldrons:
                    latest = self.cache.get_latest_historical_data(
                        cauldron_id=cauldron.cauldron_id
                    )
                    if latest:
                        latest_levels.append(latest)
                
                if latest_levels:
                    print(f"   ✅ Using {len(latest_levels)} cached levels as fallback")
                    return latest_levels
            
            # If no cache available and not rate limit, return empty
            print(f"⚠️  Error fetching latest levels: {e}")
            return []
    
    # ==================== Tickets ====================
    
    def get_tickets(self, use_cache: bool = True) -> TicketsDto:
        """Get tickets with caching and error handling"""
        if use_cache:
            cached = self.cache.get_cached_tickets(max_age_minutes=self.cache_ttl)
            if cached:
                # Reconstruct TicketsDto from cached tickets
                from backend.models.schemas import TicketsDto, TicketMetadataDto
                return TicketsDto(
                    transport_tickets=cached,
                    metadata=TicketMetadataDto(total_tickets=len(cached))
                )
        
        # Fetch from API with fallback to stale cache
        try:
            tickets = self.eog_client.get_tickets()
            # Cache the results
            if use_cache:
                self.cache.cache_tickets(tickets.tickets)
            return tickets
        except Exception as e:
            error_str = str(e)
            # Special handling for rate limits - always use stale cache
            if '429' in error_str or 'rate limit' in error_str.lower() or 'Too Many Requests' in error_str:
                print(f"⚠️  Rate limit (429) fetching tickets, using stale cache")
                if use_cache:
                    stale_cache = self.cache.get_cached_tickets(max_age_minutes=1440)  # Allow 24 hours old for rate limits
                    if stale_cache:
                        print("   ✅ Using stale cache as fallback")
                        # Reconstruct TicketsDto from cached tickets
                        from backend.models.schemas import TicketsDto, TicketMetadataDto
                        return TicketsDto(
                            transport_tickets=stale_cache,
                            metadata=TicketMetadataDto(total_tickets=len(stale_cache))
                        )
            else:
                print(f"⚠️  API error fetching tickets: {e}")
            
            # Fallback to stale cache if available
            if use_cache:
                stale_cache = self.cache.get_cached_tickets(max_age_minutes=60)  # Allow 1 hour old
                if stale_cache:
                    print("   Using stale cache as fallback")
                    # Return minimal TicketsDto with cached tickets
                    from backend.models.schemas import TicketsDto, TicketMetadataDto
                    return TicketsDto(
                        transport_tickets=stale_cache,
                        metadata=TicketMetadataDto(total_tickets=len(stale_cache))
                    )
            raise  # Re-raise if no cache available
    
    # ==================== Market ====================
    
    def get_market(self, use_cache: bool = True) -> MarketDto:
        """Get market with caching"""
        if use_cache:
            cached = self.cache.get_cached_market(max_age_minutes=self.cache_ttl)
            if cached:
                return cached
        
        # Fetch from API
        market = self.eog_client.get_market()
        
        # Cache the results (always cache fetched data)
        # This will automatically calculate and store x, y positions
        self.cache.cache_market(market)
        
        # Return cached version which includes x, y coordinates
        cached = self.cache.get_cached_market(max_age_minutes=999999)
        if cached:
            return cached
        
        # Fallback to original if cache retrieval fails
        return market
    
    # ==================== Couriers ====================
    
    def get_couriers(self, use_cache: bool = True) -> List[CourierDto]:
        """Get couriers with caching"""
        if use_cache:
            cached = self.cache.get_cached_couriers(max_age_minutes=self.cache_ttl)
            if cached:
                return cached
        
        # Fetch from API
        couriers = self.eog_client.get_couriers()
        
        # Cache the results (always cache fetched data)
        self.cache.cache_couriers(couriers)
        
        return couriers
    
    # ==================== Network ====================
    
    def get_network(self, use_cache: bool = True):
        """Get network with caching"""
        if use_cache:
            cached = self.cache.get_cached_network(max_age_minutes=self.cache_ttl)
            if cached:
                return cached
        
        # Fetch from API
        network = self.eog_client.get_network()
        
        # Cache the results (always cache fetched data)
        self.cache.cache_network(network)
        
        return network
    
    def get_graph_neighbors(self, node_id: str):
        """Get graph neighbors - no caching needed (can be derived from network)"""
        return self.eog_client.get_graph_neighbors(node_id)
    
    def get_graph_neighbors_directed(self, node_id: str):
        """Get directed graph neighbors - no caching needed (can be derived from network)"""
        return self.eog_client.get_graph_neighbors_directed(node_id)
    
    def get_data_metadata(self, use_cache: bool = True):
        """Get data metadata with caching"""
        if use_cache:
            cached = self.cache.get_cached_data_metadata(max_age_minutes=self.cache_ttl)
            if cached:
                return cached
        
        # Fetch from API
        metadata = self.eog_client.get_data_metadata()
        
        # Cache the results
        if use_cache:
            self.cache.cache_data_metadata(metadata)
        
        return metadata

