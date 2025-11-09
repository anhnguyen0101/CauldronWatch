"""
SQLAlchemy database models for caching EOG API data
"""
from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from typing import Optional

Base = declarative_base()


class CauldronCache(Base):
    """Cache for cauldron information"""
    __tablename__ = "cauldrons"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    max_volume = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<CauldronCache(id={self.id}, name={self.name})>"


class HistoricalDataCache(Base):
    """Cache for historical cauldron level data"""
    __tablename__ = "historical_data"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    cauldron_id = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    level = Column(Float, nullable=False)
    fill_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Composite index for faster queries
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )
    
    def __repr__(self):
        return f"<HistoricalDataCache(cauldron_id={self.cauldron_id}, timestamp={self.timestamp}, level={self.level})>"


class TicketCache(Base):
    """Cache for ticket information"""
    __tablename__ = "tickets"
    
    ticket_id = Column(String, primary_key=True)
    cauldron_id = Column(String, nullable=False, index=True)
    date = Column(String, nullable=False, index=True)  # YYYY-MM-DD format
    amount_collected = Column(Float, nullable=False)
    courier_id = Column(String, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<TicketCache(ticket_id={self.ticket_id}, cauldron_id={self.cauldron_id}, date={self.date})>"


class MarketCache(Base):
    """Cache for market information"""
    __tablename__ = "market"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<MarketCache(id={self.id}, name={self.name})>"


class CourierCache(Base):
    """Cache for courier information"""
    __tablename__ = "couriers"
    
    courier_id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    capacity = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<CourierCache(courier_id={self.courier_id})>"


class CacheMetadata(Base):
    """Metadata about cache state"""
    __tablename__ = "cache_metadata"
    
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<CacheMetadata(key={self.key}, value={self.value})>"

