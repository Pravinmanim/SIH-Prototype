from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # Ensure all models are registered

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Software-only web platform for AICTE-approved institutions to validate APAAR IDs, detect duplicates, and monitor intake.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers for safe plain-English errors (no stack trace exposure)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = " -> ".join([str(loc) for loc in error.get("loc", []) if loc != "body"])
        errors.append({
            "field": field,
            "message": error.get("msg", "Invalid input value.")
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Data validation failed. Please check the supplied fields.",
            "errors": errors
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # In production/demo, do not expose internal stack trace
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server error occurred. Please try again later or contact support."
        }
    )

# Include Routers
from app.api.auth import router as auth_router
from app.api.validation import router as validation_router
from app.api.students import router as students_router
from app.api.import_data import router as import_router
from app.api.review import router as review_router
from app.api.dashboard import router as dashboard_router
from app.api.intake import router as intake_router
from app.api.reports import router as reports_router
from app.api.audit import router as audit_router
from app.api.institution import router as institution_router
from app.api.notifications import router as notifications_router

app.include_router(auth_router, prefix="/api")
app.include_router(validation_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(review_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(intake_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(institution_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "verification_service": "local_mock_unavailable"
    }
