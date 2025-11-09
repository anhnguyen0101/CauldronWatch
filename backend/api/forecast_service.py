"""
Forecast Service - Calculates minimum witches needed and generates daily schedules
Uses proper routing algorithms (Dijkstra, TSP) with weight column for optimization
Creates repeating daily schedules that prevent overflow forever
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from collections import defaultdict
import networkx as nx
from itertools import permutations

from backend.models.schemas import (
    CauldronDto, CourierDto, NetworkDto, EdgeDto, MarketDto,
    CauldronAnalysisDto
)


@dataclass
class ServiceInterval:
    """Service interval information for a cauldron"""
    cauldron_id: str
    cauldron_name: str
    fill_rate: float  # L/min
    max_volume: float  # L
    service_interval_minutes: float  # How often it must be serviced
    safe_service_interval_minutes: float  # With safety margin (e.g., 90% of time to full)


@dataclass
class PickupTask:
    """A pickup task for a witch"""
    cauldron_id: str
    cauldron_name: str
    pickup_time_minutes: float  # Minutes from start of day
    expected_volume: float
    travel_time_to_cauldron: float  # minutes
    travel_time_to_market: float  # minutes
    drain_duration: float  # minutes
    total_time: float  # minutes (travel to + drain + travel back + unload)
    priority: float  # Lower = more urgent (service interval)


@dataclass
class WitchSchedule:
    """Daily repeating schedule for a witch"""
    courier_id: str
    courier_name: str
    capacity: float  # Max carrying capacity
    tasks: List[PickupTask]
    total_volume: float
    total_time: float  # minutes
    route: List[str]  # Ordered list of nodes visited


class ForecastService:
    """Service for forecasting overflow and scheduling pickups"""
    
    def __init__(self, 
                 cauldrons: List[CauldronDto],
                 couriers: List[CourierDto],
                 network: NetworkDto,
                 market: MarketDto,
                 analyses: Dict[str, CauldronAnalysisDto],
                 latest_levels: Dict[str, float]):
        """
        Initialize forecast service
        
        Args:
            cauldrons: List of all cauldrons
            couriers: List of all couriers/witches
            network: Network graph with edges
            market: Market information
            analyses: Analysis results per cauldron (contains fill_rate)
            latest_levels: Current level for each cauldron (cauldron_id -> level in L)
        """
        self.cauldrons = {c.id: c for c in cauldrons}
        self.couriers = couriers
        self.network = network
        self.market = market
        self.analyses = analyses
        self.latest_levels = latest_levels
        
        # Build NetworkX graph with weight column for routing
        self.G = self._build_networkx_graph()
        
        # Calculate service intervals for each cauldron
        self.service_intervals = self._calculate_service_intervals()
    
    def _build_networkx_graph(self) -> nx.Graph:
        """
        Build NetworkX undirected graph from network edges
        Uses weight column for routing optimization
        """
        G = nx.Graph()  # Undirected graph
        
        for edge in self.network.edges:
            from_node = edge.from_node
            to_node = edge.to_node
            
            # Use weight if available, fallback to travel_time_minutes
            weight = edge.weight if hasattr(edge, 'weight') and edge.weight is not None else edge.travel_time_minutes
            
            if weight is None or weight <= 0:
                # Fallback to travel_time_minutes
                weight = edge.travel_time_minutes or 0.0
            
            # Add bidirectional edge (undirected graph)
            G.add_edge(from_node, to_node, weight=weight)
        
        return G
    
    def _calculate_service_intervals(self) -> Dict[str, ServiceInterval]:
        """
        Calculate how often each cauldron must be serviced to prevent overflow
        
        Returns service intervals based on fill rates
        """
        intervals = {}
        
        for cauldron_id, cauldron in self.cauldrons.items():
            capacity = cauldron.max_volume or 0
            if capacity <= 0:
                continue
            
            # Get fill rate from analysis
            analysis = self.analyses.get(cauldron_id)
            fill_rate = 0.0
            if analysis and hasattr(analysis, 'fill_rate'):
                fill_rate = analysis.fill_rate or 0.0
            
            if fill_rate <= 0:
                # No fill rate means it won't overflow - service interval is infinite
                intervals[cauldron_id] = ServiceInterval(
                    cauldron_id=cauldron_id,
                    cauldron_name=cauldron.name or cauldron_id,
                    fill_rate=0.0,
                    max_volume=capacity,
                    service_interval_minutes=float('inf'),
                    safe_service_interval_minutes=float('inf')
                )
                continue
            
            # Time to fill from empty to full (in minutes)
            time_to_full = capacity / fill_rate
            
            # Service interval: how often we must drain to prevent overflow
            # Use 90% of time_to_full as safety margin
            safe_interval = time_to_full * 0.9
            
            intervals[cauldron_id] = ServiceInterval(
                cauldron_id=cauldron_id,
                cauldron_name=cauldron.name or cauldron_id,
                fill_rate=fill_rate,
                max_volume=capacity,
                service_interval_minutes=time_to_full,
                safe_service_interval_minutes=safe_interval
            )
        
        return intervals
    
    def _get_travel_time(self, from_node: str, to_node: str) -> float:
        """
        Get travel time between two nodes using Dijkstra's algorithm
        Uses weight column for shortest path calculation
        """
        if from_node == to_node:
            return 0.0
        
        try:
            # Use Dijkstra's algorithm with weight column
            return nx.dijkstra_path_length(self.G, from_node, to_node, weight='weight')
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return float('inf')
    
    def _get_shortest_path(self, from_node: str, to_node: str) -> List[str]:
        """Get shortest path between two nodes using Dijkstra's algorithm"""
        if from_node == to_node:
            return [from_node]
        
        try:
            return nx.dijkstra_path(self.G, from_node, to_node, weight='weight')
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []
    
    def _optimize_route_tsp(self, start_node: str, nodes_to_visit: List[str], max_nodes: int = 10) -> Tuple[List[str], float]:
        """
        Optimize route using TSP (Traveling Salesman Problem)
        Uses nearest neighbor heuristic for efficiency
        
        Args:
            start_node: Starting node (usually market)
            nodes_to_visit: List of nodes to visit
            max_nodes: Maximum nodes to optimize (for performance)
        
        Returns:
            (optimized_route, total_time)
        """
        if not nodes_to_visit:
            return [start_node], 0.0
        
        # Limit nodes for performance (TSP is NP-hard)
        if len(nodes_to_visit) > max_nodes:
            # Use nearest neighbor for large sets
            return self._nearest_neighbor_route(start_node, nodes_to_visit)
        
        # Try all permutations for small sets (exact solution)
        best_route = None
        best_time = float('inf')
        
        for perm in permutations(nodes_to_visit):
            route = [start_node] + list(perm) + [start_node]
            total_time = self._calculate_route_time(route)
            
            if total_time < best_time:
                best_time = total_time
                best_route = route
        
        return best_route or [start_node], best_time
    
    def _nearest_neighbor_route(self, start_node: str, nodes_to_visit: List[str]) -> Tuple[List[str], float]:
        """
        Nearest neighbor heuristic for TSP
        Faster but not optimal
        """
        route = [start_node]
        unvisited = set(nodes_to_visit)
        current = start_node
        total_time = 0.0
        
        while unvisited:
            # Find nearest unvisited node
            nearest = None
            min_time = float('inf')
            
            for node in unvisited:
                time = self._get_travel_time(current, node)
                if time < min_time:
                    min_time = time
                    nearest = node
            
            if nearest is None:
                break
            
            route.append(nearest)
            unvisited.remove(nearest)
            total_time += min_time
            current = nearest
        
        # Return to start
        return_time = self._get_travel_time(current, start_node)
        route.append(start_node)
        total_time += return_time
        
        return route, total_time
    
    def _calculate_route_time(self, route: List[str]) -> float:
        """Calculate total time for a route"""
        if len(route) < 2:
            return 0.0
        
        total_time = 0.0
        for i in range(len(route) - 1):
            total_time += self._get_travel_time(route[i], route[i + 1])
        
        return total_time
    
    def calculate_minimum_witches(self, 
                                  safety_margin_percent: float = 0.9,
                                  unload_time_minutes: float = 15.0,
                                  drain_time_per_liter: float = 0.1,
                                  max_shift_hours: float = 8.0) -> Dict:
        """
        Calculate minimum number of witches needed to prevent all overflows forever
        
        Creates a repeating daily schedule that works indefinitely
        
        Args:
            safety_margin_percent: Safety margin (0.9 = service at 90% full)
            unload_time_minutes: Time to unload at market (default 15 minutes)
            drain_time_per_liter: Minutes per liter to drain (default 0.1 min/L = 10 L/min)
            max_shift_hours: Maximum work hours per witch (default 8 hours for reasonable shifts)
        
        Returns:
            Dict with minimum_witches, schedule, and verification
        """
        max_shift_minutes = max_shift_hours * 60
        # Filter to cauldrons that need service (have fill rate)
        cauldrons_needing_service = [
            interval for interval in self.service_intervals.values()
            if interval.fill_rate > 0 and interval.safe_service_interval_minutes < float('inf')
        ]
        
        if not cauldrons_needing_service:
            return {
                "minimum_witches": 0,
                "schedule": [],
                "cauldrons_serviced": 0,
                "total_cauldrons": len(self.service_intervals),
                "verification": {"overflow_prevented": True, "schedule_repeats": True}
            }
        
        # Sort by service interval (most urgent first)
        cauldrons_needing_service.sort(key=lambda x: x.safe_service_interval_minutes)
        
        # Log cauldron fill rates and service intervals for debugging
        print(f"\n📊 Cauldron Service Requirements:")
        for interval in cauldrons_needing_service[:5]:  # Show first 5
            print(f"   {interval.cauldron_name}: fill_rate={interval.fill_rate:.2f} L/min, service_interval={interval.safe_service_interval_minutes:.1f} min ({interval.safe_service_interval_minutes/60:.1f} hrs)")
        if len(cauldrons_needing_service) > 5:
            print(f"   ... and {len(cauldrons_needing_service) - 5} more")
        
        # Try increasing number of witches until we find a feasible schedule
        for num_witches in range(1, len(cauldrons_needing_service) + 1):
            schedule_result = self._try_schedule_with_n_witches(
                num_witches,
                cauldrons_needing_service,
                safety_margin_percent,
                unload_time_minutes,
                drain_time_per_liter
            )
            
            if schedule_result:
                # Log schedule verification details
                schedules = schedule_result.get("schedules", [])
                min_interval = min(c.safe_service_interval_minutes for c in cauldrons_needing_service)
                
                print(f"\n🔍 Testing {num_witches} witches:")
                for i, schedule in enumerate(schedules):
                    print(f"   Witch {i+1}: {len(schedule.tasks)} tasks, {schedule.total_time:.1f} min total")
                print(f"   Min service interval: {min_interval:.1f} min")
                
                is_feasible = self._verify_schedule_prevents_overflow(schedule_result)
                print(f"   {'✅' if is_feasible else '❌'} Feasible: {is_feasible}")
                
                if is_feasible:
                    # Convert schedules to dict format
                    schedule_dicts = [self._schedule_to_dict(s) for s in schedule_result["schedules"]]
                    
                    return {
                        "minimum_witches": num_witches,
                        "schedule": schedule_dicts,
                        "cauldrons_serviced": len(cauldrons_needing_service),
                        "total_cauldrons": len(self.service_intervals),
                        "verification": {
                            "overflow_prevented": True,
                            "schedule_repeats": True,
                            "max_service_interval": max(c.safe_service_interval_minutes for c in cauldrons_needing_service),
                            "min_service_interval": min(c.safe_service_interval_minutes for c in cauldrons_needing_service)
                        }
                    }
        
        # If we can't find a feasible schedule, return best attempt
        return {
            "minimum_witches": len(cauldrons_needing_service),
            "schedule": [],
            "cauldrons_serviced": len(cauldrons_needing_service),
            "total_cauldrons": len(self.service_intervals),
            "verification": {"overflow_prevented": False, "schedule_repeats": False}
        }
    
    def _try_schedule_with_n_witches(self,
                                     num_witches: int,
                                     cauldrons_needing_service: List[ServiceInterval],
                                     safety_margin_percent: float,
                                     unload_time_minutes: float,
                                     drain_time_per_liter: float) -> Optional[Dict]:
        """
        Try to create a feasible schedule with n witches
        Uses greedy assignment with route optimization
        """
        # Assign cauldrons to witches (greedy by service interval)
        witch_assignments = {f"witch_{i}": [] for i in range(num_witches)}
        
        # Round-robin assignment (can be improved with better heuristics)
        for i, interval in enumerate(cauldrons_needing_service):
            witch_id = f"witch_{i % num_witches}"
            witch_assignments[witch_id].append(interval)
        
        # Create schedule for each witch
        schedules = []
        for witch_id, assigned_intervals in witch_assignments.items():
            if not assigned_intervals:
                continue
            
            # Get courier info
            courier = self.couriers[len(schedules) % len(self.couriers)] if self.couriers else None
            courier_id = courier.courier_id if courier else witch_id
            courier_name = courier.name if courier else witch_id
            courier_capacity = courier.capacity if courier else 1000.0
            
            # Optimize route for this witch
            cauldron_ids = [interval.cauldron_id for interval in assigned_intervals]
            optimized_route, route_time = self._optimize_route_tsp(
                self.market.id,
                cauldron_ids,
                max_nodes=8  # Limit for performance
            )
            
            # Create pickup tasks for each cauldron in route
            tasks = []
            current_time = 0.0
            total_volume = 0.0
            
            for node in optimized_route:
                if node == self.market.id:
                    if current_time > 0:  # Not the first market visit
                        current_time += unload_time_minutes
                    continue
                
                # This is a cauldron
                interval = next((i for i in assigned_intervals if i.cauldron_id == node), None)
                if not interval:
                    continue
                
                # Calculate travel time from previous node
                if tasks:
                    prev_node = tasks[-1].cauldron_id
                    travel_time = self._get_travel_time(prev_node, node)
                else:
                    # First cauldron from market
                    travel_time = self._get_travel_time(self.market.id, node)
                
                current_time += travel_time
                
                # Estimate drain volume (drain to 20% capacity for safety)
                target_level = interval.max_volume * 0.2
                drain_volume = interval.max_volume * 0.8  # Drain 80% of capacity
                
                # Account for fill during drain
                drain_duration = drain_volume * drain_time_per_liter
                fill_during_drain = interval.fill_rate * drain_duration
                actual_drain_needed = drain_volume + fill_during_drain
                
                # Recalculate drain duration accounting for fill rate
                net_drain_rate = (1.0 / drain_time_per_liter) - interval.fill_rate
                if net_drain_rate <= 0:
                    drain_duration = 60.0  # Assume 1 hour if fill rate too high
                else:
                    drain_duration = actual_drain_needed / net_drain_rate
                
                # Travel back to market
                travel_to_market = self._get_travel_time(node, self.market.id)
                
                total_task_time = travel_time + drain_duration + travel_to_market
                
                tasks.append(PickupTask(
                    cauldron_id=node,
                    cauldron_name=interval.cauldron_name,
                    pickup_time_minutes=current_time,
                    expected_volume=actual_drain_needed,
                    travel_time_to_cauldron=travel_time,
                    travel_time_to_market=travel_to_market,
                    drain_duration=drain_duration,
                    total_time=total_task_time,
                    priority=interval.safe_service_interval_minutes
                ))
                
                current_time += drain_duration + travel_to_market
                total_volume += actual_drain_needed
            
            # Add final unload time
            current_time += unload_time_minutes
            
            schedules.append(WitchSchedule(
                courier_id=courier_id,
                courier_name=courier_name,
                capacity=courier_capacity,
                tasks=tasks,
                total_volume=total_volume,
                total_time=current_time,
                route=optimized_route
            ))
        
        return {"schedules": schedules}
    
    def _verify_schedule_prevents_overflow(self, schedule_result: Dict) -> bool:
        """
        Verify that the schedule prevents overflow forever
        
        Checks that:
        1. Each cauldron is serviced before it would overflow
        2. Total time for witch's route is less than the minimum service interval
        3. Witches can physically complete their routes
        """
        schedules = schedule_result.get("schedules", [])
        
        if not schedules:
            return False
        
        # Find minimum service interval among all cauldrons
        min_service_interval = min(
            interval.safe_service_interval_minutes 
            for interval in self.service_intervals.values() 
            if interval.fill_rate > 0
        )
        
        # Get max shift hours from context (default 8 hours = 480 minutes)
        max_shift_minutes = 480  # 8 hours
        
        # Check each witch's schedule
        for schedule in schedules:
            # Constraint 1: Total time must be less than min service interval
            # Otherwise, some cauldrons will overflow before the witch can service them again
            if schedule.total_time > min_service_interval:
                return False
            
            # Constraint 2: Total time must be less than max shift hours (work-life balance!)
            # A witch can't work 24/7 - limit to reasonable shift length
            if schedule.total_time > max_shift_minutes:
                return False
            
            # Check each task individually
            for task in schedule.tasks:
                interval = self.service_intervals.get(task.cauldron_id)
                if not interval:
                    continue
                
                # Time from start of day to first service
                time_to_first_service = task.pickup_time_minutes
                
                # Time until overflow (from empty, worst case)
                time_to_overflow = interval.safe_service_interval_minutes
                
                # First service must happen before overflow
                if time_to_first_service > time_to_overflow:
                    return False
        
        return True
    
    def generate_daily_schedule(self, 
                               target_date: Optional[datetime] = None) -> Dict:
        """
        Generate a full daily repeating schedule for all witches
        
        This schedule repeats every day and prevents overflow forever
        
        Args:
            target_date: Date to generate schedule for (default: today)
        
        Returns:
            Dict with daily schedule for each witch
        """
        if target_date is None:
            target_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate minimum witches and get schedule
        result = self.calculate_minimum_witches()
        
        # Schedules are already in dict format from calculate_minimum_witches
        # Just add datetime conversion for pickup times
        schedule_dicts = result["schedule"]
        for schedule_dict in schedule_dicts:
            # Convert pickup times to actual datetime
            for task_dict in schedule_dict["tasks"]:
                pickup_time = target_date + timedelta(minutes=task_dict["pickup_time_minutes"])
                task_dict["pickup_time"] = pickup_time.isoformat()
        
        return {
            "date": target_date.isoformat(),
            "minimum_witches": result["minimum_witches"],
            "schedules": schedule_dicts,
            "total_tasks": sum(len(s["tasks"]) for s in schedule_dicts),
            "verification": result["verification"],
            "repeating": True  # This schedule repeats daily
        }
    
    def _schedule_to_dict(self, schedule: WitchSchedule) -> Dict:
        """Convert WitchSchedule to dict"""
        return {
            "courier_id": schedule.courier_id,
            "courier_name": schedule.courier_name,
            "capacity": schedule.capacity,
            "tasks": [self._task_to_dict(t) for t in schedule.tasks],
            "total_volume": schedule.total_volume,
            "total_time_minutes": schedule.total_time,
            "route": schedule.route
        }
    
    def _task_to_dict(self, task: PickupTask) -> Dict:
        """Convert PickupTask to dict"""
        return {
            "cauldron_id": task.cauldron_id,
            "cauldron_name": task.cauldron_name,
            "pickup_time_minutes": task.pickup_time_minutes,
            "expected_volume": task.expected_volume,
            "travel_time_to_cauldron": task.travel_time_to_cauldron,
            "travel_time_to_market": task.travel_time_to_market,
            "drain_duration": task.drain_duration,
            "total_time_minutes": task.total_time,
            "priority": task.priority
        }
