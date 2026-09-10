"""Base contracts and security enforcement for third-party integration adapters."""

import ipaddress
import re
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urlparse


class SecurityPolicyViolationError(Exception):
    """Raised when an integration attempts unauthorized network egress or violates air-gap policies."""
    pass


class IntegrationUnavailableError(Exception):
    """Raised when an integration is enabled but the required package is not installed."""
    pass


class IntegrationDisabledError(Exception):
    """Raised when an operation is requested on a disabled integration adapter."""
    pass


def validate_local_endpoint(endpoint: str, allow_private_networks: bool = True) -> bool:
    """Validate that an endpoint URL or hostname is strictly local/air-gapped.

    Permits:
    - localhost, 127.0.0.1, ::1
    - host.docker.internal
    - RFC1918 private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) if allowed.

    Rejects:
    - External public hostnames or public IPs (violates NO_EGRESS).
    """
    if not endpoint:
        raise SecurityPolicyViolationError("Empty endpoint cannot be validated.")

    parsed = urlparse(endpoint if "://" in endpoint else f"http://{endpoint}")
    host = parsed.hostname or endpoint.split(":")[0]

    # Whitelist of local loopback/container identifiers
    local_identifiers = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}
    if host.lower() in local_identifiers:
        return True

    # Check for IP address
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_loopback:
            return True
        if allow_private_networks and ip.is_private:
            return True
    except ValueError:
        pass

    raise SecurityPolicyViolationError(
        f"NO_EGRESS policy violation: Endpoint '\''{endpoint}'\'' is not an authorized local host. "
        "Sovereign-Core forbids external cloud calls by default."
    )


class BaseIntegrationAdapter(ABC):
    """Base class for all third-party open-source AI infrastructure adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the integration."""
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        """Return True if enabled in application configuration."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if third-party dependencies are installed."""
        pass

    def check_ready(self) -> None:
        """Validate both enablement and dependency availability."""
        if not self.is_enabled():
            raise IntegrationDisabledError(f"Integration '\''{self.name}'\'' is disabled in settings.")
        if not self.is_available():
            raise IntegrationUnavailableError(
                f"Integration '\''{self.name}'\'' is enabled but its required package is not installed."
            )
