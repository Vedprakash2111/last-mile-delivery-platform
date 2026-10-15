# Writes final optimization paths back to Postgres
# Async SQLAlchemy database session manager for Routing Worker (Neon DB Free Tier Auto-Suspend Optimized)

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
<<<<<<< Updated upstream
from app.config import config
=======
from services.routing_worker.app.config import config
from db_models.database_url import asyncpg_connection_settings

database_url, ssl_connect_args = asyncpg_connection_settings(config.database_url)
>>>>>>> Stashed changes

engine = create_async_engine(
    database_url,
    pool_size=config.postgres_pool_size,
    max_overflow=config.postgres_max_overflow,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args={"timeout": 10.0, "command_timeout": 5.0, **ssl_connect_args}
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_worker_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency / context provider for async Postgres DB session in worker tasks."""
    # TODO: Yield async DB session for route persistence and terminal event persistence
    async with async_session_factory() as session:
        yield session
