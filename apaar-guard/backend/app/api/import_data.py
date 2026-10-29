from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.import_job import ImportJob, ImportJobError
from app.services.import_service import (
    compute_file_hash,
    compute_mapping_hash,
    parse_file_to_df,
    auto_suggest_mapping,
    validate_and_stage_import,
    commit_import_job,
    REQUIRED_IMPORT_FIELDS
)
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/import", tags=["Bulk Import Wizard"])

@router.get("/template")
def download_template(
    format: str = "csv",
    current_user: User = Depends(require_admin)
):
    cols = ['roll_number', 'full_name', 'apaar_id', 'course_code', 'admission_year', 'date_of_birth', 'gender', 'email', 'phone']
    df = pd.DataFrame(columns=cols)

    if format == "xlsx":
        out = io.BytesIO()
        df.to_excel(out, index=False)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=student_import_template.xlsx"}
        )
    else:
        out = io.StringIO()
        df.to_csv(out, index=False)
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=student_import_template.csv"}
        )

@router.post("/inspect")
async def inspect_uploaded_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    filename = file.filename or "upload.csv"
    if not (filename.lower().endswith(".csv") or filename.lower().endswith((".xlsx", ".xls"))):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a .csv or .xlsx spreadsheet file."
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 10 MB."
        )

    try:
        df = parse_file_to_df(content, filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read file: {str(e)}"
        )

    if len(df) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file contains no data rows."
        )

    headers = [str(c).strip() for c in df.columns]
    auto_mapping = auto_suggest_mapping(headers)
    file_hash = compute_file_hash(content)

    return {
        "filename": filename,
        "file_hash": file_hash,
        "total_rows": len(df),
        "headers": headers,
        "suggested_mapping": auto_mapping,
        "required_fields": REQUIRED_IMPORT_FIELDS,
        "sample_preview": df.head(5).to_dict(orient="records")
    }

@router.post("/validate")
async def validate_import_staging(
    file: UploadFile = File(...),
    mapping_json: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    try:
        mapping = json.loads(mapping_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid column mapping format.")

    content = await file.read()
    filename = file.filename or "upload.csv"
    try:
        df = parse_file_to_df(content, filename)
        staging_result = validate_and_stage_import(
            db=db,
            institution_id=current_user.institution_id,
            df=df,
            mapping=mapping
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

    file_hash = compute_file_hash(content)
    mapping_hash = compute_mapping_hash(mapping)

    return {
        "file_hash": file_hash,
        "mapping_hash": mapping_hash,
        "filename": filename,
        "summary": staging_result["summary"],
        "staged_rows": staging_result["rows"]
    }

@router.post("/commit")
def execute_import_commit(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    filename = payload.get("filename", "import.csv")
    file_hash = payload.get("file_hash")
    mapping_hash = payload.get("mapping_hash") or compute_mapping_hash(payload.get("mapping", {}))
    rows = payload.get("staged_rows", [])
    options = payload.get("options", {})

    if not file_hash or not rows:
        raise HTTPException(status_code=400, detail="Invalid import commit payload.")

    try:
        job = commit_import_job(
            db=db,
            institution_id=current_user.institution_id,
            user_id=current_user.id,
            filename=filename,
            file_hash=file_hash,
            mapping_hash=mapping_hash,
            rows=rows,
            options=options
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    return {
        "status": "success",
        "job_id": job.id,
        "filename": job.filename,
        "total_rows": job.total_rows,
        "created_rows": job.created_rows,
        "updated_rows": job.updated_rows,
        "skipped_rows": job.skipped_rows,
        "invalid_rows": job.invalid_rows,
        "review_rows": job.review_rows,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None
    }

@router.get("/jobs")
def list_import_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    jobs = db.query(ImportJob).filter(
        ImportJob.institution_id == current_user.institution_id
    ).order_by(ImportJob.created_at.desc()).limit(20).all()

    return jobs

@router.get("/jobs/{job_id}/errors")
def export_job_errors_csv(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    job = db.query(ImportJob).filter(
        ImportJob.id == job_id,
        ImportJob.institution_id == current_user.institution_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found.")

    errors = db.query(ImportJobError).filter(
        ImportJobError.import_job_id == job.id
    ).all()

    rows = []
    for e in errors:
        rows.append({
            "Job ID": job.id,
            "Row Number": e.row_index,
            "Field": e.field_name,
            "Error Description": e.error_message,
            "Raw Data": e.raw_data
        })

    df = pd.DataFrame(rows)
    out = io.StringIO()
    df.to_csv(out, index=False)
    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=errors_job_{job.id}.csv"}
    )
