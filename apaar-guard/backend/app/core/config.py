from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    APP_NAME: str = "APAAR Guard"
    APP_ENV: str = "development"
    SECRET_KEY: str = "demo-insecure-secret-key-change-in-production-min32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Database: SQLite for prototype, PostgreSQL compatible
    DATABASE_URL: str = "sqlite:///./apaar_guard.db"
    
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    OFFICIAL_VERIFICATION_ENABLED: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
