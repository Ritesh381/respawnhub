from logging.config import fileConfig

from sqlalchemy import text

from alembic import context
from app import models  # noqa: F401  registers the tables on Base.metadata
from app.config import settings
from app.db import Base, make_engine

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Every backend replica runs migrations on start. A Postgres advisory lock
# makes them take turns so two pods never apply the same revision at once.
MIGRATION_LOCK_ID = 727001


def run_migrations_offline() -> None:
    context.configure(
        url=str(settings.sqlalchemy_url), target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = make_engine(settings.sqlalchemy_url)
    with engine.connect() as connection:
        postgres = connection.dialect.name == "postgresql"
        if postgres:
            connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
            connection.commit()
        try:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
            connection.commit()
        finally:
            if postgres:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:id)"), {"id": MIGRATION_LOCK_ID}
                )
                connection.commit()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
