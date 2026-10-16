from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "RespawnHub API"
    app_version: str = "dev"
    cafe_tz: str = "Asia/Kolkata"

    # Either a full DATABASE_URL, or the parts (used in Kubernetes so the
    # password can come from a Secret on its own).
    database_url: str | None = None
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "respawnhub"
    db_user: str = "respawnhub"
    db_password: str = ""

    @property
    def sqlalchemy_url(self) -> str | URL:
        if self.database_url:
            return self.database_url
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


settings = Settings()
