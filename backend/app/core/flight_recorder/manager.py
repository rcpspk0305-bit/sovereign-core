"""Flight Recorder Manager for mission telemetry, blackbox records, and WebSocket streaming."""

import asyncio
import datetime
import hashlib
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket

from app.config import settings
from app.core.flight_recorder.models import (
    ApprovalStatus,
    FlightEvent,
    FlightEventType,
    FlightRecord,
    GeneratedArtifact,
    NetworkMode,
    RecordedError,
    RetrievedSource,
    StepRecord,
    ToolExecutionRecord,
)
from app.core.interfaces.agents import BaseAgent

logger = logging.getLogger("sovereign.flight_recorder")


class FlightRecorderManager:
    """Manages active mission blackbox recordings and real-time WebSocket telemetry."""

    MAX_STORED_RECORDS: int = 500

    def __init__(self, storage_dir: Optional[Path] = None) -> None:
        self.records: Dict[str, FlightRecord] = {}
        self.active_connections: Set[WebSocket] = set()
        self.task_connections: Dict[str, Set[WebSocket]] = {}
        self.storage_dir = storage_dir or settings.FLIGHT_RECORDS_DIR
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            self._load_persisted_records()
        except Exception as e:
            logger.warning("Could not initialize flight recorder storage directory: %s", e)

    def _load_persisted_records(self) -> None:
        """Load previously saved records from disk."""
        if not self.storage_dir.exists():
            return
        for file in self.storage_dir.glob("*.json"):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                record = FlightRecord(**data)
                self._add_record_with_eviction(record)
            except Exception as ex:
                logger.warning("Failed to load flight record from %s: %s", file, ex)

    def _add_record_with_eviction(self, record: FlightRecord) -> None:
        """Add record and evict oldest if capacity exceeded."""
        if len(self.records) >= self.MAX_STORED_RECORDS and record.task_id not in self.records:
            try:
                oldest_task_id = min(self.records.keys(), key=lambda k: self.records[k].start_time)
                del self.records[oldest_task_id]
            except Exception:
                pass
        self.records[record.task_id] = record

    def _persist_record(self, record: FlightRecord) -> None:
        """Save record to disk."""
        self._add_record_with_eviction(record)
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            path = self.storage_dir / f"{record.task_id}.json"
            path.write_text(record.model_dump_json(indent=2), encoding="utf-8")
        except Exception as ex:
            logger.warning("Failed to persist flight record %s: %s", record.task_id, ex)

    async def connect(self, websocket: WebSocket, task_id: Optional[str] = None) -> None:
        """Register a WebSocket client for real-time telemetry streaming."""
        await websocket.accept()
        self.active_connections.add(websocket)
        if task_id:
            self.subscribe(websocket, task_id)

    def subscribe(self, websocket: WebSocket, task_id: str) -> None:
        """Subscribe a WebSocket connection to a specific task ID."""
        if task_id not in self.task_connections:
            self.task_connections[task_id] = set()
        self.task_connections[task_id].add(websocket)

    def unsubscribe(self, websocket: WebSocket, task_id: str) -> None:
        """Unsubscribe a WebSocket connection from a specific task ID."""
        if task_id in self.task_connections:
            self.task_connections[task_id].discard(websocket)
            if not self.task_connections[task_id]:
                del self.task_connections[task_id]

    def disconnect(self, websocket: WebSocket, task_id: Optional[str] = None) -> None:
        """Unregister a disconnected WebSocket client."""
        self.active_connections.discard(websocket)
        if task_id and task_id in self.task_connections:
            self.task_connections[task_id].discard(websocket)
            if not self.task_connections[task_id]:
                del self.task_connections[task_id]
        # Clean from any other task mapping
        for tid in list(self.task_connections.keys()):
            self.task_connections[tid].discard(websocket)

    async def broadcast_event(self, event: FlightEvent) -> None:
        """Broadcast event concurrently to both global subscribers and task-specific subscribers."""
        payload = event.model_dump()
        text = json.dumps(payload)

        targets: Set[WebSocket] = set(self.active_connections)
        if event.task_id in self.task_connections:
            targets.update(self.task_connections[event.task_id])

        if not targets:
            return

        async def _safe_send(ws: WebSocket) -> Optional[WebSocket]:
            try:
                await ws.send_text(text)
                return None
            except Exception:
                return ws

        results = await asyncio.gather(*[_safe_send(ws) for ws in targets], return_exceptions=True)
        for res in results:
            if isinstance(res, WebSocket):
                self.disconnect(res)

    def get_record(self, task_id: str) -> Optional[FlightRecord]:
        return self.records.get(task_id)

    def list_records(self) -> List[FlightRecord]:
        # Return sorted by start_time descending
        return sorted(self.records.values(), key=lambda r: r.start_time, reverse=True)

    async def update_approval(
        self,
        task_id: str,
        approval_status: ApprovalStatus,
        notes: Optional[str] = None,
    ) -> Optional[FlightRecord]:
        """Update approval status for a task record and broadcast update."""
        record = self.records.get(task_id)
        if not record:
            return None

        record.approval_status = approval_status
        if notes:
            record.metadata["approval_notes"] = notes
        record.metadata["approval_updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self._persist_record(record)

        # Broadcast approval event
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        ev = FlightEvent(
            event_type=FlightEventType.APPROVAL_UPDATED,
            task_id=task_id,
            timestamp=now_iso,
            data={
                "approval_status": approval_status.value,
                "notes": notes,
            },
        )
        await self.broadcast_event(ev)
        return record

    async def run_mission(
        self,
        prompt: str,
        agent: BaseAgent,
        model: Optional[str] = None,
        network_mode: NetworkMode = NetworkMode.AIR_GAPPED_LOCAL,
        task_id: Optional[str] = None,
        max_steps: int = 5,
    ) -> FlightRecord:
        """Execute a mission, capture fine-grained telemetry, and stream real-time events."""
        start_time = time.perf_counter()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        tid = task_id or f"task_{uuid.uuid4().hex[:8]}"
        resolved_model = model or settings.DEFAULT_MODEL

        # Initialize flight record
        record = FlightRecord(
            task_id=tid,
            model=resolved_model,
            prompt=prompt,
            network_mode=network_mode,
            approval_status=ApprovalStatus.PENDING,
            status="running",
            start_time=now_iso,
            steps=[],
            tools_called=[],
            retrieved_sources=[],
            artifacts_generated=[],
            errors=[],
            metadata={"agent": agent.name, "max_steps": max_steps},
        )
        self.records[tid] = record

        # Emit task started event
        await self.broadcast_event(
            FlightEvent(
                event_type=FlightEventType.TASK_STARTED,
                task_id=tid,
                timestamp=now_iso,
                data={
                    "model": resolved_model,
                    "prompt": prompt,
                    "network_mode": network_mode.value,
                    "approval_status": record.approval_status.value,
                    "start_time": now_iso,
                },
            )
        )

        async def telemetry_callback(raw_event: Dict[str, Any]) -> None:
            ev_type_str = raw_event.get("type")
            ts = raw_event.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()

            if ev_type_str == "step_started":
                step_num = raw_event.get("step_number", len(record.steps) + 1)
                record.steps.append(
                    StepRecord(
                        step_number=step_num,
                        thought=raw_event.get("thought", ""),
                        timestamp=ts,
                        status="running",
                    )
                )
                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.STEP_STARTED,
                        task_id=tid,
                        timestamp=ts,
                        data={
                            "step_number": step_num,
                            "thought": raw_event.get("thought", ""),
                        },
                    )
                )

            elif ev_type_str == "tool_called":
                step_num = raw_event.get("step_number", len(record.steps))
                tool_name = raw_event.get("tool_name", "unknown")
                args = raw_event.get("tool_arguments", {})
                thought = raw_event.get("thought", "")

                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.TOOL_CALLED,
                        task_id=tid,
                        timestamp=ts,
                        data={
                            "step_number": step_num,
                            "tool_name": tool_name,
                            "tool_arguments": args,
                            "thought": thought,
                        },
                    )
                )

            elif ev_type_str == "tool_completed":
                step_num = raw_event.get("step_number", len(record.steps))
                tool_rec = ToolExecutionRecord(
                    step_number=step_num,
                    tool_name=raw_event.get("tool_name", "unknown"),
                    tool_arguments=raw_event.get("tool_arguments", {}),
                    execution_time_ms=raw_event.get("execution_time_ms", 0.0),
                    success=raw_event.get("success", True),
                    error=raw_event.get("error"),
                    output_preview=raw_event.get("output_preview"),
                )
                record.tools_called.append(tool_rec)

                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.TOOL_COMPLETED,
                        task_id=tid,
                        timestamp=ts,
                        data=tool_rec.model_dump(),
                    )
                )

            elif ev_type_str == "sources_retrieved":
                chunks = raw_event.get("chunks", [])
                new_sources: List[RetrievedSource] = []
                for c in chunks:
                    src = RetrievedSource(
                        document_name=c.get("document_name", "unknown"),
                        page_number=c.get("page_number"),
                        similarity_score=round(float(c.get("similarity_score", 0.0)), 4),
                        chunk_preview=c.get("content", "")[:300],
                        metadata={"source": c.get("source", ""), "chunk_index": c.get("chunk_index", 0)},
                    )
                    record.retrieved_sources.append(src)
                    new_sources.append(src)

                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.SOURCES_RETRIEVED,
                        task_id=tid,
                        timestamp=ts,
                        data={
                            "step_number": raw_event.get("step_number"),
                            "sources": [s.model_dump() for s in new_sources],
                        },
                    )
                )

            elif ev_type_str == "artifact_generated":
                art_data = raw_event.get("artifact", {})
                content = art_data.get("document_content", "")
                if not isinstance(content, str):
                    content = json.dumps(content, indent=2)
                title = art_data.get("title", "Generated Inspection Report")
                checksum = art_data.get("checksum_sha256") or hashlib.sha256(content.encode("utf-8")).hexdigest()
                artifact = GeneratedArtifact(
                    artifact_id=f"art_{uuid.uuid4().hex[:8]}",
                    artifact_type=art_data.get("artifact_type") or art_data.get("format", "report"),
                    title=title,
                    content=content,
                    checksum_sha256=checksum,
                    timestamp=ts,
                    metadata={
                        "citations": art_data.get("citations", []),
                        "step_number": raw_event.get("step_number"),
                        "docx_file_path": art_data.get("docx_file_path"),
                        "docx_file_name": art_data.get("docx_file_name"),
                        "docx_file_size_bytes": art_data.get("docx_file_size_bytes"),
                        "validation_status": art_data.get("validation_status"),
                        "unsupported_claims_count": art_data.get("unsupported_claims_count", 0),
                        "verified_claims_count": art_data.get("verified_claims_count", 0),
                        "human_approval_role": art_data.get("human_approval_role"),
                    },
                )
                record.artifacts_generated.append(artifact)

                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.ARTIFACT_GENERATED,
                        task_id=tid,
                        timestamp=ts,
                        data=artifact.model_dump(),
                    )
                )

            elif ev_type_str == "error_recorded":
                err = RecordedError(
                    step_number=raw_event.get("step_number"),
                    error_message=raw_event.get("error_message", "Unknown error"),
                    severity=raw_event.get("severity", "error"),
                    timestamp=ts,
                )
                record.errors.append(err)

                await self.broadcast_event(
                    FlightEvent(
                        event_type=FlightEventType.ERROR_RECORDED,
                        task_id=tid,
                        timestamp=ts,
                        data=err.model_dump(),
                    )
                )

        try:
            agent_result = await agent.run(
                prompt=prompt,
                session_id=tid,
                max_steps=max_steps,
                model=resolved_model,
                event_callback=telemetry_callback,
            )
            total_elapsed = (time.perf_counter() - start_time) * 1000.0
            end_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            record.end_time = end_iso
            record.total_latency_ms = round(total_elapsed, 2)
            record.final_response = agent_result.final_response
            if agent_result.steps:
                record.steps = [
                    StepRecord(
                        step_number=s.step_number,
                        thought=s.thought,
                        tool_name=s.tool_name,
                        tool_arguments=s.tool_arguments or {},
                        observation=s.observation,
                        timestamp=s.timestamp,
                        status="completed",
                    )
                    for s in agent_result.steps
                ]

            # Evaluate approval status
            has_violations = any(e.severity == "policy_violation" for e in record.errors)
            has_errors = any(e.severity == "error" for e in record.errors)
            used_fallback = bool(agent_result.metadata.get("used_fallback", False))

            if has_violations:
                record.approval_status = ApprovalStatus.POLICY_VIOLATION
                record.status = "failed"
            elif not agent_result.success or has_errors:
                record.approval_status = ApprovalStatus.FAILED
                record.status = "failed"
            elif used_fallback:
                # Offline/fallback runs must not be automatically certified
                record.approval_status = ApprovalStatus.PENDING
                record.status = "completed"
            else:
                record.approval_status = ApprovalStatus.AUTO_VERIFIED
                record.status = "completed"

        except Exception as exc:
            total_elapsed = (time.perf_counter() - start_time) * 1000.0
            end_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            err_msg = f"Mission execution error: {str(exc)}"
            logger.exception(err_msg)

            err = RecordedError(
                error_message=err_msg,
                severity="error",
                timestamp=end_iso,
            )
            record.errors.append(err)
            record.end_time = end_iso
            record.total_latency_ms = round(total_elapsed, 2)
            record.status = "failed"
            record.approval_status = ApprovalStatus.FAILED
            record.final_response = err_msg

        self._persist_record(record)

        # Broadcast completion event
        await self.broadcast_event(
            FlightEvent(
                event_type=FlightEventType.TASK_COMPLETED,
                task_id=tid,
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                data={
                    "status": record.status,
                    "approval_status": record.approval_status.value,
                    "total_latency_ms": record.total_latency_ms,
                    "final_response": record.final_response,
                    "steps_count": len(record.steps),
                    "tools_called_count": len(record.tools_called),
                    "artifacts_count": len(record.artifacts_generated),
                    "errors_count": len(record.errors),
                },
            )
        )

        return record


# Global singleton instance
_flight_recorder_manager: Optional[FlightRecorderManager] = None


def get_flight_recorder_manager() -> FlightRecorderManager:
    global _flight_recorder_manager
    if _flight_recorder_manager is None:
        _flight_recorder_manager = FlightRecorderManager()
    return _flight_recorder_manager
