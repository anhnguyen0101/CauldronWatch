"""
Caching layer for EOG API data
Handles storing and retrieving cached data
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from datetime import datetime, timedelta
from typing import List, Optional
from backend.database.models import (
    CauldronCache,
    HistoricalDataCache,
    TicketCache,
    MarketCache,
    CourierCache,
    NetworkEdgeCache,
    CacheMetadata
)
from backend.models.schemas import (
    CauldronDto,
    HistoricalDataDto,
    TicketDto,
    MarketDto,
    CourierDto,
    NetworkDto,
    EdgeDto,
    HistoricalDataMetadataDto
)
from math import radians, sin, cos, sqrt, atan2


class CacheManager:
    """Manages caching of EOG API data"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ==================== Cauldron Caching ====================
    
    def cache_cauldrons(self, cauldrons: List[CauldronDto]):
        """Cache cauldron data"""
        for cauldron in cauldrons:
            existing = self.db.query(CauldronCache).filter_by(id=cauldron.id).first()
            if existing:
                existing.name = cauldron.name
                existing.latitude = cauldron.latitude
                existing.longitude = cauldron.longitude
                existing.max_volume = cauldron.max_volume
                existing.last_updated = datetime.utcnow()
            else:
                self.db.add(CauldronCache(
                    id=cauldron.id,
                    name=cauldron.name,
                    latitude=cauldron.latitude,
                    longitude=cauldron.longitude,
                    max_volume=cauldron.max_volume
                ))
        self.db.commit()
        # Recalculate positions after updating cauldrons
        self.calculate_and_store_node_positions()
    
    def get_cached_cauldrons(self, max_age_minutes: int = 5) -> Optional[List[CauldronDto]]:
        """Get cached cauldrons if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        cached = self.db.query(CauldronCache).filter(
            CauldronCache.last_updated >= cutoff
        ).all()
        
        if cached:
            return [CauldronDto(
                id=c.id,
                name=c.name,
                latitude=c.latitude,
                longitude=c.longitude,
                max_volume=c.max_volume,
                x=c.x,
                y=c.y
            ) for c in cached]
        return None
    
    # ==================== Historical Data Caching ====================
    
    def cache_historical_data(self, data: List[HistoricalDataDto], clear_old: bool = False):
        """Cache historical data"""
        if clear_old:
            # Clear old data for the cauldrons being cached
            cauldron_ids = {d.cauldron_id for d in data}
            if cauldron_ids:
                self.db.query(HistoricalDataCache).filter(
                    HistoricalDataCache.cauldron_id.in_(cauldron_ids)
                ).delete()
        
        for item in data:
            self.db.add(HistoricalDataCache(
                cauldron_id=item.cauldron_id,
                timestamp=item.timestamp,
                level=item.level,
                fill_rate=item.fill_rate
            ))
        self.db.commit()
    
    def get_cached_historical_data(
        self,
        cauldron_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[HistoricalDataDto]:
        """Get cached historical data"""
        query = self.db.query(HistoricalDataCache)
        
        if cauldron_id:
            query = query.filter(HistoricalDataCache.cauldron_id == cauldron_id)
        
        if start_date:
            query = query.filter(HistoricalDataCache.timestamp >= start_date)
        
        if end_date:
            query = query.filter(HistoricalDataCache.timestamp <= end_date)
        
        query = query.order_by(HistoricalDataCache.timestamp)
        
        if limit:
            query = query.limit(limit)
        
        cached = query.all()
        return [HistoricalDataDto(
            cauldron_id=c.cauldron_id,
            timestamp=c.timestamp,
            level=c.level,
            fill_rate=c.fill_rate
        ) for c in cached]
    
    def get_latest_historical_data(self, cauldron_id: Optional[str] = None) -> Optional[HistoricalDataDto]:
        """Get the most recent historical data point"""
        query = self.db.query(HistoricalDataCache)
        if cauldron_id:
            query = query.filter(HistoricalDataCache.cauldron_id == cauldron_id)
        
        latest = query.order_by(desc(HistoricalDataCache.timestamp)).first()
        if latest:
            return HistoricalDataDto(
                cauldron_id=latest.cauldron_id,
                timestamp=latest.timestamp,
                level=latest.level,
                fill_rate=latest.fill_rate
            )
        return None
    
    # ==================== Ticket Caching ====================
    
    def cache_tickets(self, tickets: List[TicketDto]):
        """Cache ticket data"""
        for ticket in tickets:
            existing = self.db.query(TicketCache).filter_by(ticket_id=ticket.ticket_id).first()
            if existing:
                existing.cauldron_id = ticket.cauldron_id
                existing.date = ticket.date
                existing.amount_collected = ticket.amount_collected
                existing.courier_id = ticket.courier_id
                existing.last_updated = datetime.utcnow()
            else:
                self.db.add(TicketCache(
                    ticket_id=ticket.ticket_id,
                    cauldron_id=ticket.cauldron_id,
                    date=ticket.date,
                    amount_collected=ticket.amount_collected,
                    courier_id=ticket.courier_id
                ))
        self.db.commit()
    
    def get_cached_tickets(
        self,
        cauldron_id: Optional[str] = None,
        date: Optional[str] = None,
        max_age_minutes: int = 5
    ) -> Optional[List[TicketDto]]:
        """Get cached tickets if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        query = self.db.query(TicketCache).filter(TicketCache.last_updated >= cutoff)
        
        if cauldron_id:
            query = query.filter(TicketCache.cauldron_id == cauldron_id)
        
        if date:
            query = query.filter(TicketCache.date == date)
        
        cached = query.all()
        if cached:
            return [TicketDto(
                ticket_id=t.ticket_id,
                cauldron_id=t.cauldron_id,
                date=t.date,
                amount_collected=t.amount_collected,
                courier_id=t.courier_id
            ) for t in cached]
        return None
    
    # ==================== Market Caching ====================
    
    def cache_market(self, market: MarketDto):
        """Cache market data"""
        existing = self.db.query(MarketCache).filter_by(id=market.id).first()
        if existing:
            existing.name = market.name
            existing.description = market.description
            existing.latitude = market.latitude
            existing.longitude = market.longitude
            existing.last_updated = datetime.utcnow()
        else:
            self.db.add(MarketCache(
                id=market.id,
                name=market.name,
                description=market.description,
                latitude=market.latitude,
                longitude=market.longitude
            ))
        self.db.commit()
        # Recalculate positions after updating market
        self.calculate_and_store_node_positions()
    
    def get_cached_market(self, max_age_minutes: int = 5) -> Optional[MarketDto]:
        """Get cached market if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        cached = self.db.query(MarketCache).filter(
            MarketCache.last_updated >= cutoff
        ).first()
        
        if cached:
            return MarketDto(
                id=cached.id,
                name=cached.name,
                description=cached.description,
                latitude=cached.latitude,
                longitude=cached.longitude,
                x=cached.x,
                y=cached.y
            )
        return None
    
    # ==================== Courier Caching ====================
    
    def cache_couriers(self, couriers: List[CourierDto]):
        """Cache courier data"""
        for courier in couriers:
            existing = self.db.query(CourierCache).filter_by(courier_id=courier.courier_id).first()
            if existing:
                existing.name = courier.name
                existing.capacity = courier.capacity
                existing.speed = courier.speed
                existing.last_updated = datetime.utcnow()
            else:
                self.db.add(CourierCache(
                    courier_id=courier.courier_id,
                    name=courier.name,
                    capacity=courier.capacity,
                    speed=courier.speed
                ))
        self.db.commit()
    
    def get_cached_couriers(self, max_age_minutes: int = 5) -> Optional[List[CourierDto]]:
        """Get cached couriers if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        cached = self.db.query(CourierCache).filter(
            CourierCache.last_updated >= cutoff
        ).all()
        
        if cached:
            return [CourierDto(
                courier_id=c.courier_id,
                name=c.name,
                capacity=c.capacity,
                speed=c.speed
            ) for c in cached]
        return None
    
    # ==================== Network Caching ====================
    
    def cache_network(self, network: NetworkDto):
        """Cache network edges with calculated weight and distance"""
        from backend.database.models import CauldronCache, MarketCache
        
        # Clear old edges (network structure can change, so replace all)
        self.db.query(NetworkEdgeCache).delete()
        
        # Get all node coordinates (cauldrons + market)
        node_coords = {}
        
        # Get cauldron coordinates
        cauldrons = self.db.query(CauldronCache).all()
        for cauldron in cauldrons:
            node_coords[cauldron.id] = (cauldron.latitude, cauldron.longitude)
        
        # Get market coordinates
        market = self.db.query(MarketCache).first()
        if market:
            node_coords[market.id] = (market.latitude, market.longitude)
        
        # Add new edges with calculated weight and distance
        for edge in network.edges:
            # Set weight = travel_time_minutes (if not already set)
            weight = edge.weight if edge.weight is not None else edge.travel_time_minutes
            
            # Calculate distance from coordinates
            distance = None
            if edge.from_node in node_coords and edge.to_node in node_coords:
                from_lat, from_lon = node_coords[edge.from_node]
                to_lat, to_lon = node_coords[edge.to_node]
                distance = self.haversine_distance(from_lat, from_lon, to_lat, to_lon)
            
            self.db.add(NetworkEdgeCache(
                from_node=edge.from_node,
                to_node=edge.to_node,
                travel_time_minutes=edge.travel_time_minutes,
                weight=weight,
                distance=distance
            ))
        self.db.commit()
    
    def get_cached_network(self, max_age_minutes: int = 60) -> Optional[NetworkDto]:
        """Get cached network if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        cached = self.db.query(NetworkEdgeCache).filter(
            NetworkEdgeCache.last_updated >= cutoff
        ).all()
        
        if cached:
            edges = [EdgeDto(
                from_node=e.from_node,
                to_node=e.to_node,
                travel_time_minutes=e.travel_time_minutes,
                weight=e.weight,
                distance=e.distance
            ) for e in cached]
            return NetworkDto(edges=edges)
        return None
    
    # ==================== Cache Metadata ====================
    
    def set_cache_metadata(self, key: str, value: str):
        """Set cache metadata"""
        existing = self.db.query(CacheMetadata).filter_by(key=key).first()
        if existing:
            existing.value = value
            existing.last_updated = datetime.utcnow()
        else:
            self.db.add(CacheMetadata(key=key, value=value))
        self.db.commit()
    
    def get_cache_metadata(self, key: str) -> Optional[str]:
        """Get cache metadata"""
        metadata = self.db.query(CacheMetadata).filter_by(key=key).first()
        return metadata.value if metadata else None
    
    # ==================== Historical Data Metadata Caching ====================
    
    def cache_data_metadata(self, metadata: HistoricalDataMetadataDto):
        """Cache historical data metadata"""
        import json
        value = json.dumps({
            'start_date': metadata.start_date.isoformat(),
            'end_date': metadata.end_date.isoformat(),
            'interval_minutes': metadata.interval_minutes,
            'unit': metadata.unit
        })
        self.set_cache_metadata('data_metadata', value)
    
    def get_cached_data_metadata(self, max_age_minutes: int = 60) -> Optional[HistoricalDataMetadataDto]:
        """Get cached data metadata if fresh enough"""
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        cached = self.db.query(CacheMetadata).filter(
            CacheMetadata.key == 'data_metadata',
            CacheMetadata.last_updated >= cutoff
        ).first()
        
        if cached and cached.value:
            import json
            try:
                data = json.loads(cached.value)
                return HistoricalDataMetadataDto(
                    start_date=datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')),
                    end_date=datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')),
                    interval_minutes=data['interval_minutes'],
                    unit=data['unit']
                )
            except Exception as e:
                print(f"⚠️  Error parsing cached data metadata: {e}")
                return None
        return None

    def calculate_and_store_node_positions(self):
        """Calculate normalized positions (0-1) for all nodes based on geographic bounds"""
        from backend.database.models import CauldronCache, MarketCache
        import json
        
        # Get all nodes
        cauldrons = self.db.query(CauldronCache).all()
        market = self.db.query(MarketCache).first()
        
        # Collect all coordinates
        all_coords = []
        for c in cauldrons:
            if c.latitude is not None and c.longitude is not None:
                all_coords.append(('cauldron', c.id, c.latitude, c.longitude))
        if market and market.latitude is not None and market.longitude is not None:
            all_coords.append(('market', market.id, market.latitude, market.longitude))
        
        if not all_coords:
            # No coordinates available - cannot calculate positions
            return
        
        # Calculate bounds
        lats = [c[2] for c in all_coords]
        lngs = [c[3] for c in all_coords]
        
        minLat = min(lats)
        maxLat = max(lats)
        minLng = min(lngs)
        maxLng = max(lngs)
        
        latRange = maxLat - minLat
        lngRange = maxLng - minLng
        
        # Handle edge case where all points are the same or very close
        hasRange = latRange > 0.0001 and lngRange > 0.0001
        padding = 0.1 if hasRange else 0.05
        effectiveLatRange = latRange or 0.02  # ~2km at equator
        effectiveLngRange = lngRange or 0.02  # ~2km at equator
        
        bounds = {
            'minLat': minLat - effectiveLatRange * padding,
            'maxLat': maxLat + effectiveLatRange * padding,
            'minLng': minLng - effectiveLngRange * padding,
            'maxLng': maxLng + effectiveLngRange * padding
        }
        
        # Store bounds in metadata
        self.set_cache_metadata('network_bounds', json.dumps(bounds))
        
        # Calculate normalized positions (0-1 range)
        boundsLatRange = bounds['maxLat'] - bounds['minLat']
        boundsLngRange = bounds['maxLng'] - bounds['minLng']
        
        updated_count = 0
        for node_type, node_id, lat, lng in all_coords:
            # Normalize to 0-1 range
            if boundsLngRange > 0.001:
                normalized_x = (lng - bounds['minLng']) / boundsLngRange
            else:
                normalized_x = 0.5
            
            # Flip Y axis (latitude increases upward, but SVG Y increases downward)
            if boundsLatRange > 0.001:
                normalized_y = 1 - ((lat - bounds['minLat']) / boundsLatRange)
            else:
                normalized_y = 0.5
            
            # Update node in database
            if node_type == 'cauldron':
                cauldron = self.db.query(CauldronCache).filter_by(id=node_id).first()
                if cauldron:
                    cauldron.x = normalized_x
                    cauldron.y = normalized_y
                    updated_count += 1
            elif node_type == 'market':
                market_obj = self.db.query(MarketCache).filter_by(id=node_id).first()
                if market_obj:
                    market_obj.x = normalized_x
                    market_obj.y = normalized_y
                    updated_count += 1
        
        # Commit all x, y coordinate updates to database
        self.db.commit()
        
        # Log success (only if updating multiple nodes to avoid spam)
        if updated_count > 0 and len(all_coords) > 5:
            print(f"   ✅ Calculated and saved x, y coordinates for {updated_count} nodes")
    
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great circle distance between two points 
        on the earth (specified in decimal degrees)
        Returns distance in kilometers
        """
        # Earth radius in kilometers
        R = 6371.0
        
        # Convert decimal degrees to radians
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        return distance

