"""
Pydantic models for EOG API DTOs
Based on the actual API response structure
"""
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, model_validator


# Data Models
class DateRange(BaseModel):
    """Date range for filtering historical data"""
    start: datetime
    end: datetime


class HistoricalDataMetadataDto(BaseModel):
    """Metadata about historical data"""
    start_date: datetime
    end_date: datetime
    interval_minutes: int
    unit: str  # e.g., "liters"


class HistoricalDataPointDto(BaseModel):
    """Single historical data point with all cauldron levels"""
    timestamp: datetime
    cauldron_levels: Dict[str, float]  # Maps cauldron_id to level


class HistoricalDataDto(BaseModel):
    """Historical data for a specific cauldron (transformed from API response)"""
    cauldron_id: str
    timestamp: datetime
    level: float
    fill_rate: Optional[float] = None


# Information Models
class EdgeDto(BaseModel):
    """Graph edge representation"""
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    travel_time_minutes: Optional[float] = None
    weight: Optional[float] = None
    distance: Optional[float] = None

    class Config:
        populate_by_name = True


class NeighborDto(BaseModel):
    """Graph neighbor information"""
    to: str = Field(alias="to")  # Target node ID
    cost: Optional[str] = None  # Travel time as string (e.g., "00:45:00")
    node_id: Optional[str] = None  # Alias for 'to' for backward compatibility
    distance: Optional[float] = None
    weight: Optional[float] = None
    
    @model_validator(mode='before')
    @classmethod
    def set_node_id(cls, data):
        """Set node_id from 'to' field for backward compatibility"""
        if isinstance(data, dict) and 'to' in data and 'node_id' not in data:
            data['node_id'] = data['to']
        return data
    
    class Config:
        populate_by_name = True


class NetworkDto(BaseModel):
    """Network information"""
    edges: List[EdgeDto]
    nodes: Optional[List[str]] = None

    @property
    def all_nodes(self) -> List[str]:
        """Extract all unique nodes from edges"""
        nodes_set = set()
        for edge in self.edges:
            nodes_set.add(edge.from_node)
            nodes_set.add(edge.to_node)
        return list(nodes_set)


class GraphNodeDto(BaseModel):
    """Graph node with full information"""
    id: str
    name: Optional[str] = None
    latitude: float
    longitude: float
    max_volume: Optional[float] = None  # For cauldrons
    description: Optional[str] = None  # For market
    node_type: str  # "cauldron" | "market"


class CombinedGraphDto(BaseModel):
    """Combined network graph with nodes and edges - ready for visualization"""
    nodes: List[GraphNodeDto]  # All nodes (cauldrons + market) with coordinates
    edges: List[EdgeDto]  # All edges with travel times
    description: Optional[str] = "Potion transport network linking all cauldrons to the market"


class MarketDto(BaseModel):
    """Market information"""
    id: str
    latitude: float
    longitude: float
    name: Optional[str] = None
    description: Optional[str] = None
    x: Optional[float] = None  # Normalized X coordinate (0-1) for visualization
    y: Optional[float] = None  # Normalized Y coordinate (0-1) for visualization

    @property
    def market_id(self) -> str:
        """Alias for id"""
        return self.id

    class Config:
        populate_by_name = True


class CourierDto(BaseModel):
    """Courier information"""
    courier_id: str
    name: Optional[str] = None
    capacity: Optional[float] = None
    max_carrying_capacity: Optional[float] = None  # API field name
    speed: Optional[float] = None
    
    def __init__(self, **data):
        # Map max_carrying_capacity to capacity if capacity is not provided
        if 'max_carrying_capacity' in data and 'capacity' not in data:
            data['capacity'] = data['max_carrying_capacity']
        super().__init__(**data)
    
    class Config:
        populate_by_name = True


class CauldronLevelsDto(BaseModel):
    """Current levels for a cauldron"""
    cauldron_id: str
    level: float
    capacity: float
    fill_rate: float
    timestamp: datetime


class CauldronDto(BaseModel):
    """Cauldron information"""
    id: str
    latitude: float
    longitude: float
    max_volume: float
    name: Optional[str] = None
    current_level: Optional[float] = None
    fill_rate: Optional[float] = None
    x: Optional[float] = None  # Normalized X coordinate (0-1) for visualization
    y: Optional[float] = None  # Normalized Y coordinate (0-1) for visualization

    @property
    def cauldron_id(self) -> str:
        """Alias for id"""
        return self.id

    @property
    def capacity(self) -> float:
        """Alias for max_volume"""
        return self.max_volume

    @property
    def location(self) -> dict:
        """Location as dict for compatibility"""
        return {"latitude": self.latitude, "longitude": self.longitude}

    class Config:
        populate_by_name = True


# Ticket Models
class TicketMetadataDto(BaseModel):
    """Metadata about tickets"""
    total_tickets: int
    suspicious_tickets: Optional[int] = 0
    date_range: Optional[DateRange] = None


class TicketDto(BaseModel):
    """Individual ticket information"""
    ticket_id: str
    cauldron_id: str
    date: str  # Date only (YYYY-MM-DD)
    amount_collected: float
    courier_id: str
    timestamp: Optional[datetime] = None  # May not be provided

    @property
    def volume(self) -> float:
        """Alias for amount_collected"""
        return self.amount_collected

    class Config:
        populate_by_name = True


class TicketsDto(BaseModel):
    """Collection of tickets"""
    transport_tickets: List[TicketDto]
    metadata: TicketMetadataDto

    @property
    def tickets(self) -> List[TicketDto]:
        """Alias for transport_tickets"""
        return self.transport_tickets

    class Config:
        populate_by_name = True


# ==================== Analysis Models (Person 2) ====================

class DrainEventDto(BaseModel):
    """Drain event information - merged from both branches"""
    cauldron_id: str
    start_time: datetime
    end_time: datetime
    start_level: float
    end_level: float
    duration_minutes: float
    level_drop: float
    true_volume: Optional[float] = None  # Account for filling during drain (from analysis)
    volume_drained: Optional[float] = None  # Alias for true_volume (legacy compatibility)
    fill_rate: Optional[float] = None  # Fill rate at time of drain
    date: str  # YYYY-MM-DD format

    class Config:
        populate_by_name = True

    @classmethod
    def from_dict(cls, data: dict):
        """Create DrainEventDto from dict, ensuring compatibility"""
        # Ensure volume_drained is set from true_volume if not provided
        if 'volume_drained' not in data and 'true_volume' in data:
            data['volume_drained'] = data['true_volume']
        elif 'true_volume' not in data and 'volume_drained' in data:
            data['true_volume'] = data['volume_drained']
        return cls(**data)


class DrainEventsDto(BaseModel):
    """Collection of drain events"""
    events: List[DrainEventDto]
    total_events: int
    date_range: Optional[DateRange] = None

    class Config:
        populate_by_name = True


class CauldronAnalysisDto(BaseModel):
    """Analysis results for a cauldron"""
    cauldron_id: str
    fill_rate: float  # L/min
    num_drains: int
    total_volume_drained: float
    avg_drain_volume: float
    drain_events: List[DrainEventDto]
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class DailyDrainSummaryDto(BaseModel):
    """Daily drain summary for ticket matching"""
    cauldron_id: str
    date: str  # YYYY-MM-DD
    total_volume_drained: float
    num_drains: int
    drain_events: List[DrainEventDto]

    class Config:
        populate_by_name = True


# ==================== Discrepancy Detection Models (Person 3) ====================

class DiscrepancyDto(BaseModel):
    """Discrepancy between ticket and drain event"""
    ticket_id: str
    cauldron_id: str
    date: str
    ticket_volume: float
    actual_drained: float
    discrepancy: float  # Difference
    discrepancy_percent: float
    severity: str  # "critical", "warning", "info"
    matched_drain_events: List[str]  # IDs of matched drain events

    class Config:
        populate_by_name = True


class DiscrepanciesDto(BaseModel):
    """Collection of discrepancies"""
    discrepancies: List[DiscrepancyDto]
    total_discrepancies: int
    critical_count: int
    warning_count: int
    info_count: int

    class Config:
        populate_by_name = True
