from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_current_user(user: CurrentUser):
    return user
