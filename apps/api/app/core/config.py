from functools import lru_cache

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: AnyHttpUrl
    supabase_publishable_key: str
    supabase_secret_key: str
    gemini_api_key: SecretStr | None = None
    gemini_model: str = Field(default='gemini-3.1-flash-lite', pattern=r'^[a-zA-Z0-9._-]+$')
    api_cors_origins: list[str] = Field(default_factory=list)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
