import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import BaseModel
from app.core.config import settings
from app.services.gemini_client import gemini_client


class SmokeSchema(BaseModel):
    greeting: str


async def main():
    if not settings.gemini_configured:
        print("FAIL: Gemini is not configured in backend/.env (GEMINI_API_KEY or GEMINI_MODEL missing).")
        sys.exit(1)

    print(f"Testing model: {settings.GEMINI_MODEL} ...")
    try:
        parsed, meta = await gemini_client.generate_structured(
            system_instruction="You are a test assistant. Output greeting in JSON.",
            user_prompt="Say hello in JSON format.",
            response_schema=SmokeSchema,
            timeout_seconds=15,
        )
        print(f"OK: Model '{settings.GEMINI_MODEL}' responded successfully in {meta.get('latency_ms')} ms.")
    except Exception as e:
        print(f"FAIL: Error contacting Gemini: {type(e).__name__} - {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
