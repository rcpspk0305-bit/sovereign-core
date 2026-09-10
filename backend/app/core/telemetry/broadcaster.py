import asyncio
import inspect
from typing import Any, Callable, Dict, List
from app.core.interfaces.telemetry import BaseTelemetryBroadcaster


class NativeTelemetryBroadcaster(BaseTelemetryBroadcaster):
    """Local pub/sub telemetry broadcaster for WebSocket or internal event streaming."""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Dict[str, Any]], Any]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str, callback: Callable[[Dict[str, Any]], Any]) -> None:
        async with self._lock:
            if channel not in self._subscribers:
                self._subscribers[channel] = []
            self._subscribers[channel].append(callback)

    async def unsubscribe(self, channel: str, callback: Callable[[Dict[str, Any]], Any]) -> None:
        async with self._lock:
            if channel in self._subscribers:
                self._subscribers[channel] = [
                    cb for cb in self._subscribers[channel] if cb != callback
                ]

    async def broadcast(self, channel: str, message: Dict[str, Any]) -> int:
        async with self._lock:
            callbacks = list(self._subscribers.get(channel, []))

        count = 0
        for callback in callbacks:
            try:
                if inspect.iscoroutinefunction(callback):
                    await callback(message)
                else:
                    callback(message)
                count += 1
            except Exception:
                pass
        return count
