"""Verify the configured application database connection without printing secrets."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

# Keep this runnable from the repository root without a PYTHONPATH override.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.core_api.app.database.connection import engine


async def main() -> int:
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as connection:
                result = await connection.execute(text("SELECT 1"))
                value = result.scalar_one()
                if value != 1:
                    raise RuntimeError("Database returned an unexpected result")
        print("Database connection verified (SELECT 1 succeeded).")
        return 0
    except Exception as exc:
        print(f"Database connection failed: {type(exc).__name__}: {exc}")
        return 1
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
