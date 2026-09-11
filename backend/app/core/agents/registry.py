"""Central Authoritative Registry for Sovereign-Core Agent Squad."""

import logging
from typing import Any, Callable, Dict, List, Optional, Type

from app.core.agents.definitions import AgentDefinition
from app.core.interfaces.agents import BaseAgent
from app.core.interfaces.audit import BaseAuditLogger
from app.core.interfaces.llm import BaseLLMClient
from app.core.interfaces.tools import BaseToolRegistry

logger = logging.getLogger("sovereign.agents.registry")


class AgentRegistry:
    """Authoritative singleton registry governing agent identities and static permissions."""

    def __init__(self) -> None:
        self._definitions: Dict[str, AgentDefinition] = {}
        self._factories: Dict[str, Type[BaseAgent]] = {}

    def register(self, definition: AgentDefinition, agent_cls: Type[BaseAgent]) -> None:
        """Register an agent definition and its implementing class."""
        self._definitions[definition.id] = definition
        self._factories[definition.id] = agent_cls
        logger.info("Registered specialist agent: %s (%s)", definition.name, definition.id)

    def get_definition(self, agent_id: str) -> Optional[AgentDefinition]:
        """Retrieve authoritative definition for an agent."""
        return self._definitions.get(agent_id)

    def has_agent(self, agent_id: str) -> bool:
        """Check if an agent ID is registered."""
        return agent_id in self._definitions

    def list_definitions(self) -> List[AgentDefinition]:
        """List all registered agent specifications."""
        return list(self._definitions.values())

    def get_agent(
        self,
        agent_id: str,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        audit_logger: Optional[BaseAuditLogger] = None,
        **kwargs: Any,
    ) -> BaseAgent:
        """Instantiate an agent with strictly enforced boundaries and allowed tools."""
        if agent_id not in self._definitions:
            raise KeyError(f"Unknown agent ID: '{agent_id}'. Registered agents: {list(self._definitions.keys())}")

        definition = self._definitions[agent_id]
        agent_cls = self._factories[agent_id]

        return agent_cls(
            llm_client=llm_client,
            tool_registry=tool_registry,
            audit_logger=audit_logger,
            definition=definition,
            **kwargs,
        )

    def create_agent(
        self,
        agent_id: str,
        llm_client: BaseLLMClient,
        tool_registry: BaseToolRegistry,
        audit_logger: Optional[BaseAuditLogger] = None,
        **kwargs: Any,
    ) -> BaseAgent:
        """Alias for get_agent."""
        return self.get_agent(
            agent_id=agent_id,
            llm_client=llm_client,
            tool_registry=tool_registry,
            audit_logger=audit_logger,
            **kwargs,
        )


_GLOBAL_AGENT_REGISTRY: Optional[AgentRegistry] = None


def get_agent_registry() -> AgentRegistry:
    """Access or initialize the global agent registry singleton."""
    global _GLOBAL_AGENT_REGISTRY
    if _GLOBAL_AGENT_REGISTRY is None:
        _GLOBAL_AGENT_REGISTRY = AgentRegistry()
    return _GLOBAL_AGENT_REGISTRY


agent_registry = get_agent_registry()
