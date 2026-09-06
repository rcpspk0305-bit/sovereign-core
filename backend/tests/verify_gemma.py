"""Live verification script for local Ollama provider and Gemma 4 E2B model."""

import asyncio
import sys
import time

from app.core.interfaces.llm import ChatMessage, ChatRole
from app.core.llm.ollama import OllamaClient
from app.core.llm.service import LLMService


async def verify_live_gemma():
    print("=" * 60)
    print("SOVEREIGN-CORE: Gemma 4 E2B Live Verification")
    print("=" * 60)

    provider = OllamaClient(default_model="gemma4:e2b")
    service = LLMService(provider=provider)

    # 1. Health & Diagnostic Check
    print("\n[Step 1] Running Health & Model Readiness Diagnostics...")
    health = await service.check_health()
    print(f"  - Provider: {health.provider}")
    print(f"  - Daemon Alive: {health.is_alive}")
    print(f"  - Latency: {health.latency_ms} ms")
    print(f"  - Default Model: {health.default_model}")
    print(f"  - Default Model Ready: {health.default_model_available}")
    print(f"  - Available Models: {health.available_models}")

    if not health.is_alive:
        print("\n[FAIL] Ollama daemon is not reachable at http://localhost:11434.")
        print("Please ensure 'ollama serve' is running.")
        sys.exit(1)

    if not health.default_model_available:
        print(f"\n[FAIL] Default model '{health.default_model}' is not installed.")
        print(f"Run 'ollama pull {health.default_model}' first.")
        sys.exit(1)

    print("  -> Health diagnostic PASSED!")

    # 2. Non-streaming Completion
    prompt = "Explain what Sovereign-Core is in one concise sentence."
    print(f"\n[Step 2] Sending prompt to gemma4:e2b:\n  Prompt: '{prompt}'")
    start = time.perf_counter()
    messages = [ChatMessage(role=ChatRole.USER, content=prompt)]

    response = await service.complete(messages=messages, model="gemma4:e2b", temperature=0.7)
    elapsed = (time.perf_counter() - start) * 1000.0

    print(f"\n  Response received ({response.latency_ms} ms, total {elapsed:.1f} ms):")
    print(f"  Model: {response.model}")
    print(f"  Content: {response.content.strip()}")
    if response.usage:
        print(f"  Prompt tokens: {response.usage.prompt_tokens}")
        print(f"  Completion tokens: {response.usage.completion_tokens}")
        print(f"  Total tokens: {response.usage.total_tokens}")

    assert len(response.content.strip()) > 0, "Response content was empty"
    print("  -> Non-streaming prompt completion PASSED!")

    # 3. Streaming Completion
    stream_prompt = "Count from 1 to 5 separated by commas."
    print(f"\n[Step 3] Sending streaming prompt to gemma4:e2b:\n  Prompt: '{stream_prompt}'")
    stream_messages = [ChatMessage(role=ChatRole.USER, content=stream_prompt)]

    collected_chunks = []
    print("  Streamed output: ", end="", flush=True)
    async for chunk in service.stream(messages=stream_messages, model="gemma4:e2b"):
        print(chunk.content, end="", flush=True)
        collected_chunks.append(chunk.content)
    print()

    full_streamed = "".join(collected_chunks).strip()
    assert len(full_streamed) > 0, "Streaming output was empty"
    print("  -> Streaming prompt completion PASSED!")

    print("\n" + "=" * 60)
    print("ALL VERIFICATIONS PASSED: Gemma 4 E2B is fully operational!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(verify_live_gemma())
