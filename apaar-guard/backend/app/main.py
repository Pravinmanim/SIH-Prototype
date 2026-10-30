from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
import app.models  # Ensure all models are registered

def ensure_schema_updates(bind_engine):
    """
    Non-destructively verifies and adds missing columns for schema evolutions.
    Preserves all existing tables and data records.
    """
    from sqlalchemy import inspect, text
    inspector = inspect(bind_engine)
    with bind_engine.connect() as conn:
        tables = inspector.get_table_names()
        if "students" in tables:
            student_cols = {c["name"] for c in inspector.get_columns("students")}
            if "admission_category" not in student_cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN admission_category VARCHAR(50) DEFAULT 'General' NOT NULL"))
            if "is_supernumerary" not in student_cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN is_supernumerary BOOLEAN DEFAULT 0 NOT NULL"))
        if "intake_configurations" in tables:
            intake_cols = {c["name"] for c in inspector.get_columns("intake_configurations")}
            if "supernumerary_intake" not in intake_cols:
                conn.execute(text("ALTER TABLE intake_configurations ADD COLUMN supernumerary_intake INTEGER DEFAULT 0 NOT NULL"))
        conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates(engine)
    # Automatically seed initial database on first launch if empty
    db = SessionLocal()
    try:
        from app.models.institution import Institution
        if db.query(Institution).first() is None:
            from app.seed import seed_data
            seed_data(db)

        # Ensure demo regulator user is provisioned for prototype evaluation only in development environment
        if settings.APP_ENV == "development":
            from app.models.user import User
            if db.query(User).filter(User.role == "regulator").first() is None:
                from app.core.security import hash_password
                inst1 = db.query(Institution).first()
                reg_user = User(
                    email="rajesh.regulator@aicte.gov.in",
                    hashed_password=hash_password("password123"),
                    full_name="Dr. Rajesh Kumar (AICTE Regulator)",
                    role="regulator",
                    institution_id=inst1.id if inst1 else 1,
                    is_active=True
                )
                db.add(reg_user)
                db.commit()
    except Exception as e:
        print(f"Initial seed check: {e}")
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Software-only web platform for AICTE-approved institutions to validate APAAR IDs, detect duplicates, and monitor intake.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
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

# Include Routers with both /api prefix and root to support all client URL configurations
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
from app.api.regulator import router as regulator_router
from app.api.consent import router as consent_router

router_list = [
    auth_router,
    validation_router,
    students_router,
    import_router,
    review_router,
    dashboard_router,
    intake_router,
    reports_router,
    audit_router,
    institution_router,
    notifications_router,
    regulator_router,
    consent_router,
]

for r in router_list:
    app.include_router(r, prefix="/api")
    app.include_router(r)

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "verification_service": "local_mock_unavailable"
    }
