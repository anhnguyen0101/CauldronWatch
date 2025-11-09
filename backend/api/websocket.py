"""
WebSocket handler for real-time updates
Can be extended for more complex real-time features
"""
from fastapi import WebSocket
from typing import List, Dict, Any
import json
from datetime import datetime


class WebSocketManager:
    """Manages WebSocket connections and broadcasting"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """Register a WebSocket connection (connection should already be accepted)"""
        # Note: Connection should be accepted before calling this method
        # This is just for registration
        if websocket not in self.active_connections:
            self.active_connections.append(websocket)
            print(f"WebSocket registered. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a disconnected WebSocket"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific connection"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients"""
        # Ensure all datetime objects are converted to strings
        def serialize_datetime(obj):
            """Recursively serialize datetime objects in dict/list"""
            if isinstance(obj, dict):
                return {k: serialize_datetime(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [serialize_datetime(item) for item in obj]
            elif hasattr(obj, 'isoformat'):  # datetime, pandas Timestamp, etc.
                return obj.isoformat()
            elif hasattr(obj, 'strftime'):  # date objects
                return obj.strftime('%Y-%m-%d')
            return obj
        
        message = serialize_datetime(message)
        
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to connection: {e}")
                import traceback
                traceback.print_exc()
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    async def broadcast_cauldron_update(self, cauldron_data: Dict[str, Any]):
        """Broadcast cauldron level updates"""
        await self.broadcast({
            "type": "cauldron_update",
            "timestamp": datetime.now().isoformat(),
            "data": cauldron_data
        })
    
    async def broadcast_drain_event(self, drain_event: Dict[str, Any]):
        """Broadcast drain event detection"""
        await self.broadcast({
            "type": "drain_event",
            "timestamp": datetime.now().isoformat(),
            "data": drain_event
        })
    
    async def broadcast_discrepancy(self, discrepancy: Dict[str, Any]):
        """Broadcast discrepancy alert"""
        await self.broadcast({
            "type": "discrepancy",
            "timestamp": datetime.now().isoformat(),
            "data": discrepancy
        })


# Global WebSocket manager instance
ws_manager = WebSocketManager()

