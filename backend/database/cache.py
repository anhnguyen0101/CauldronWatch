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
    CacheMetadata
)
from backend.models.schemas import (
    CauldronDto,
    HistoricalDataDto,
    TicketDto,
    MarketDto,
    CourierDto
)


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
                max_volume=c.max_volume
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
                longitude=cached.longitude
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

