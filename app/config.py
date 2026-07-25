from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "EventOS API"
    database_url: str = "sqlite:///./eventos.db"
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    class Config:
        env_file = ".env"


settings = Settings()
