"""
EOG API Client
Handles all interactions with the EOG API endpoints
"""
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime
import time
from functools import wraps
from backend.models.schemas import (
    CauldronDto,
    CauldronLevelsDto,
    CourierDto,
    DateRange,
    EdgeDto,
    HistoricalDataDto,
    HistoricalDataPointDto,
    HistoricalDataMetadataDto,
    MarketDto,
    NeighborDto,
    NetworkDto,
    TicketDto,
    TicketsDto,
)


def retry_on_failure(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """Decorator for retrying failed API calls with special handling for rate limits"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.HTTPError as e:
                    # Special handling for 429 (Too Many Requests)
                    if e.response is not None and e.response.status_code == 429:
                        last_exception = e
                        if attempt < max_retries - 1:
                            # For rate limits, wait longer (exponential backoff)
                            wait_time = current_delay * 3  # Wait 3x longer for rate limits
                            print(f"⚠️  Rate limit (429) hit for {func.__name__}")
                            print(f"   Waiting {wait_time:.1f}s before retry {attempt + 1}/{max_retries}...")
                            time.sleep(wait_time)
                            current_delay *= backoff
                        else:
                            print(f"❌ Rate limit (429) - all {max_retries} attempts failed for {func.__name__}")
                            raise e
                    else:
                        # Other HTTP errors
                        last_exception = e
                        if attempt < max_retries - 1:
                            print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {e}")
                            print(f"   Retrying in {current_delay:.1f}s...")
                            time.sleep(current_delay)
                            current_delay *= backoff
                        else:
                            print(f"❌ All {max_retries} attempts failed for {func.__name__}")
                except (requests.exceptions.RequestException, 
                        requests.exceptions.Timeout,
                        requests.exceptions.ConnectionError) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        print(f"⚠️  Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {e}")
                        print(f"   Retrying in {current_delay:.1f}s...")
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        print(f"❌ All {max_retries} attempts failed for {func.__name__}")
            
            raise last_exception
        return wrapper
    return decorator


class EOGClient:
    """Client for interacting with EOG API"""
    
    def __init__(self, base_url: str = "https://hackutd2025.eog.systems", max_retries: int = 3):
        self.base_url = base_url.rstrip('/')
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
    @retry_on_failure(max_retries=3, delay=1.0, backoff=2.0)
    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make GET request to API with retry logic"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            print(f"⏱️  Timeout fetching {endpoint}")
            raise
        except requests.exceptions.ConnectionError:
            print(f"🔌 Connection error fetching {endpoint}")
            raise
        except requests.exceptions.HTTPError as e:
            # Special case: 429 (rate limit) should be retried
            if e.response.status_code == 429:
                print(f"⚠️  Rate limit (429) fetching {endpoint}")
                raise  # Let the retry decorator handle it
            # Don't retry on other 4xx errors (client errors)
            if 400 <= e.response.status_code < 500:
                print(f"❌ Client error {e.response.status_code} fetching {endpoint}: {e}")
                raise
            # Retry on 5xx errors (server errors)
            print(f"⚠️  Server error {e.response.status_code} fetching {endpoint}: {e}")
            raise
        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching {endpoint}: {e}")
            raise
    
    # Data Endpoints
    def get_data(self, start_date: Optional[datetime] = None, 
                 end_date: Optional[datetime] = None,
                 cauldron_id: Optional[str] = None) -> List[HistoricalDataDto]:
        """
        GET /api/Data
        Fetch historical data for cauldrons
        Returns list of HistoricalDataDto (one per cauldron per timestamp)
        """
        params = {}
        if start_date:
            params['start'] = start_date.isoformat()
        if end_date:
            params['end'] = end_date.isoformat()
        
        data = self._get("/api/Data", params=params)
        
        # Transform API response (list of {timestamp, cauldron_levels}) 
        # into list of HistoricalDataDto (one per cauldron per timestamp)
        result = []
        if isinstance(data, list):
            for point in data:
                point_obj = HistoricalDataPointDto(**point)
                for cid, level in point_obj.cauldron_levels.items():
                    if cauldron_id is None or cid == cauldron_id:
                        result.append(HistoricalDataDto(
                            cauldron_id=cid,
                            timestamp=point_obj.timestamp,
                            level=level
                        ))
        return result
    
    def get_data_metadata(self) -> HistoricalDataMetadataDto:
        """
        GET /api/Data/metadata
        Get metadata about available historical data
        """
        data = self._get("/api/Data/metadata")
        return HistoricalDataMetadataDto(**data)
    
    # Information Endpoints
    def get_network(self) -> NetworkDto:
        """
        GET /api/Information/network
        Get network graph information
        """
        data = self._get("/api/Information/network")
        return NetworkDto(**data)
    
    def get_market(self) -> MarketDto:
        """
        GET /api/Information/market
        Get market information
        """
        data = self._get("/api/Information/market")
        return MarketDto(**data)
    
    def get_couriers(self) -> List[CourierDto]:
        """
        GET /api/Information/couriers
        Get all courier information
        """
        data = self._get("/api/Information/couriers")
        return [CourierDto(**item) for item in data] if isinstance(data, list) else []
    
    def get_cauldrons(self) -> List[CauldronDto]:
        """
        GET /api/Information/cauldrons
        Get all cauldron information
        """
        data = self._get("/api/Information/cauldrons")
        return [CauldronDto(**item) for item in data] if isinstance(data, list) else []
    
    def get_graph_neighbors(self, node_id: str) -> List[NeighborDto]:
        """
        GET /api/Information/graph/neighbors/{nodeId}
        Get undirected graph neighbors for a node
        """
        data = self._get(f"/api/Information/graph/neighbors/{node_id}")
        return [NeighborDto(**item) for item in data] if isinstance(data, list) else []
    
    def get_graph_neighbors_directed(self, node_id: str) -> List[NeighborDto]:
        """
        GET /api/Information/graph/neighbors/directed/{nodeId}
        Get directed graph neighbors for a node
        """
        data = self._get(f"/api/Information/graph/neighbors/directed/{node_id}")
        return [NeighborDto(**item) for item in data] if isinstance(data, list) else []
    
    # Ticket Endpoints
    def get_tickets(self) -> TicketsDto:
        """
        GET /api/Tickets
        Get all tickets
        """
        data = self._get("/api/Tickets")
        return TicketsDto(**data)
    
    # Convenience Methods
    def get_cauldron_by_id(self, cauldron_id: str) -> Optional[CauldronDto]:
        """Get a specific cauldron by ID"""
        cauldrons = self.get_cauldrons()
        for cauldron in cauldrons:
            if cauldron.cauldron_id == cauldron_id:
                return cauldron
        return None
    
    def get_historical_data_for_cauldron(self, cauldron_id: str, 
                                        start_date: Optional[datetime] = None,
                                        end_date: Optional[datetime] = None) -> List[HistoricalDataDto]:
        """Get historical data for a specific cauldron"""
        return self.get_data(start_date, end_date, cauldron_id=cauldron_id)

