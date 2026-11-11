"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession) -> User:
    """The assignment asks for a default logged-in user instead of real login.

    Every route that needs "who is asking" goes through this one function, so
    adding authentication later means changing this body and nothing else.
    """
    user = db.scalar(select(User).where(User.email == settings.default_user_email))
    if user is None:
        raise HTTPException(status_code=503, detail="The default user is missing. Run the seed.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
