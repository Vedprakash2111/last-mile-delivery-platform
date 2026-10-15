"""Helpers for shared database connection URL handling."""

from sqlalchemy.engine import make_url


def asyncpg_connection_settings(database_url: str) -> tuple[str, dict[str, str]]:
    """Translate libpq ``sslmode`` URL syntax for SQLAlchemy's asyncpg dialect.

    asyncpg accepts ``sslmode`` when parsing a DSN itself, but SQLAlchemy's
    asyncpg dialect forwards URL query parameters as connect() keyword args.
    In that path the driver's option is named ``ssl``.
    """
    url = make_url(database_url)
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    if sslmode is None:
        return database_url, {}

    if "ssl" in query:
        raise ValueError("DATABASE_URL cannot contain both 'sslmode' and 'ssl' options")

    query["ssl"] = sslmode
    return url.set(query=query).render_as_string(hide_password=False), {}
