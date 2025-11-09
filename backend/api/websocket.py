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
        from fastapi import WebSocketDisconnect
        from websockets.exceptions import ConnectionClosedError
        from uvicorn.protocols.utils import ClientDisconnected
        
        try:
            # Check if connection is still valid before sending
            if hasattr(websocket, 'client_state'):
                if websocket.client_state.value == 2:  # DISCONNECTED
                    self.disconnect(websocket)
                    return
            
            await websocket.send_json(message)
        except (WebSocketDisconnect, ConnectionClosedError, ClientDisconnected):
            # Normal disconnect - silently handle
            self.disconnect(websocket)
        except Exception as e:
            error_msg = str(e).lower()
            # Only log non-disconnect errors
            if 'connection closed' not in error_msg and 'disconnect' not in error_msg and 'not connected' not in error_msg:
                print(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients"""
        from fastapi import WebSocketDisconnect
        from websockets.exceptions import ConnectionClosedError
        from uvicorn.protocols.utils import ClientDisconnected
        
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
        
        # Use a copy to avoid modification during iteration
        disconnected = []
        for connection in list(self.active_connections):
            try:
                # Check connection state before sending
                # FastAPI WebSocket has client_state attribute
                if hasattr(connection, 'client_state'):
                    # 1 = CONNECTED, 2 = DISCONNECTED
                    if connection.client_state.value == 2:
                        disconnected.append(connection)
                        continue
                
                await connection.send_json(message)
            except (WebSocketDisconnect, ConnectionClosedError, ClientDisconnected) as e:
                # Normal disconnect - silently handle
                disconnected.append(connection)
            except Exception as e:
                # Other errors - log but don't spam
                error_msg = str(e)
                # Only log if it's not a connection closed error
                if 'connection closed' not in error_msg.lower() and 'disconnect' not in error_msg.lower():
                    print(f"Error broadcasting to connection: {e}")
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

