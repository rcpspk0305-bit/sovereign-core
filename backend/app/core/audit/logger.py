"""Durable and in-memory enterprise audit logger."""

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Optional, Union

from app.config import settings
from app.core.interfaces.audit import AuditEvent, AuditEventType, BaseAuditLogger

logger = logging.getLogger("sovereign.audit")


class FileAndMemoryAuditLogger(BaseAuditLogger):
    """Hybrid audit logger storing recent records in memory and appending to durable JSONL on disk."""

    def __init__(
        self,
        log_dir: Optional[Union[Path, str]] = None,
        log_file: Optional[str] = None,
        enabled: Optional[bool] = None,
        max_memory_records: int = 1000,
    ) -> None:
        self.log_dir = Path(log_dir) if log_dir is not None else settings.AUDIT_LOG_DIR
        self.log_file = log_file if log_file is not None else settings.AUDIT_LOG_FILE
        self.enabled = enabled if enabled is not None else settings.AUDIT_LOG_ENABLED
        self.max_memory_records = max_memory_records

        self.file_path = self.log_dir / self.log_file
        self._events: List[AuditEvent] = []
        self._lock = asyncio.Lock()

        if self.enabled:
            try:
                self.log_dir.mkdir(parents=True, exist_ok=True)
                self._load_persisted_events()
            except Exception as exc:
                logger.warning("Could not initialize audit log directory or load events: %s", exc)

    def _load_persisted_events(self) -> None:
        """Load recent records from existing JSONL log file into memory buffer."""
        if not self.file_path.exists():
            return
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            self._events.append(AuditEvent(**data))
                        except Exception as parse_err:
                            logger.warning("Could not parse audit record from %s: %s", self.file_path, parse_err)
            if len(self._events) > self.max_memory_records:
                self._events = self._events[-self.max_memory_records:]
        except Exception as exc:
            logger.warning("Failed to read audit log file %s: %s", self.file_path, exc)

    async def log(self, event: AuditEvent) -> None:
        """Record an audit event to in-memory buffer and persist to disk."""
        if not self.enabled:
            return

        async with self._lock:
            self._events.append(event)
            if len(self._events) > self.max_memory_records:
                self._events.pop(0)

            try:
                self.log_dir.mkdir(parents=True, exist_ok=True)
                with open(self.file_path, "a", encoding="utf-8") as f:
                    f.write(event.model_dump_json() + "\n")
            except Exception as exc:
                logger.error("Failed to append audit event to %s: %s", self.file_path, exc)

    async def query(
        self,
        limit: int = 50,
        event_type: Optional[Union[AuditEventType, str]] = None,
        session_id: Optional[str] = None,
    ) -> List[AuditEvent]:
        """Query recent audit events matching optional criteria (newest first)."""
        async with self._lock:
            filtered: List[AuditEvent] = []
            for event in reversed(self._events):
                if event_type is not None:
                    ev_type_val = event_type.value if isinstance(event_type, AuditEventType) else str(event_type)
                    cur_type_val = event.event_type.value if isinstance(event.event_type, AuditEventType) else str(event.event_type)
                    if cur_type_val != ev_type_val:
                        continue
                if session_id is not None and event.session_id != session_id:
                    continue
                filtered.append(event)
                if len(filtered) >= limit:
                    break
            return filtered

    async def flush(self) -> None:
        """Flush pending buffers (no-op since writes append immediately)."""
        pass
