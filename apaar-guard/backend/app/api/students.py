from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from typing import Optional, List
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin, verify_institution_access
from app.models.user import User
from app.models.student import Student
from app.models.course import Course
from app.models.validation import ValidationResult
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentListItemResponse,
    PaginatedStudentResponse,
    StudentDetailResponse,
    StudentRevealResponse,
    CourseResponse,
    mask_apaar_id
)
from app.services.validation.engine import validation_engine
from app.services.audit_service import record_audit_log

router = APIRouter(tags=["Student Records"])

@router.get("/courses", response_model=List[CourseResponse])
def get_institution_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Course).filter(Course.institution_id == current_user.institution_id).order_by(Course.code).all()

@router.get("/students", response_model=PaginatedStudentResponse)
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, roll number, or APAAR ID"),
    course_id: Optional[int] = Query(None),
    admission_year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Student).filter(
        Student.institution_id == current_user.institution_id,
        Student.is_archived == False
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.full_name.ilike(term),
                Student.roll_number.ilike(term),
                Student.apaar_id.ilike(term)
            )
        )

    if course_id:
        query = query.filter(Student.course_id == course_id)
    if admission_year:
        query = query.filter(Student.admission_year == admission_year)
    if status and status != "ALL":
        query = query.filter(Student.status == status)

    total = query.count()

    sort_column = getattr(Student, sort_by, Student.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    items = []
    for s in records:
        items.append(StudentListItemResponse(
            id=s.id,
            institution_id=s.institution_id,
            course_id=s.course_id,
            course_name=s.course.name if s.course else None,
            course_code=s.course.code if s.course else None,
            masked_apaar_id=mask_apaar_id(s.apaar_id),
            has_apaar=bool(s.apaar_id and s.apaar_id.strip()),
            roll_number=s.roll_number,
            full_name=s.full_name,
            date_of_birth=s.date_of_birth,
            gender=s.gender,
            admission_year=s.admission_year,
            email=s.email,
            phone=s.phone,
            status=s.status,
            version=s.version,
            is_archived=s.is_archived,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))

    return PaginatedStudentResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/students/{student_id}", response_model=StudentDetailResponse)
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    validations = db.query(ValidationResult).filter(
        ValidationResult.student_id == student.id
    ).order_by(ValidationResult.id).all()

    apaar_str = student.apaar_id or ""
    return StudentDetailResponse(
        id=student.id,
        institution_id=student.institution_id,
        course_id=student.course_id,
        course=student.course,
        masked_apaar_id=mask_apaar_id(student.apaar_id),
        apaar_length=len(apaar_str.strip()),
        has_apaar=bool(apaar_str.strip()),
        roll_number=student.roll_number,
        full_name=student.full_name,
        date_of_birth=student.date_of_birth,
        gender=student.gender,
        admission_year=student.admission_year,
        email=student.email,
        phone=student.phone,
        status=student.status,
        version=student.version,
        is_archived=student.is_archived,
        created_at=student.created_at,
        updated_at=student.updated_at,
        validation_results=validations,
        official_verification_notice="Official verification unavailable. Local checks are not official verification."
    )

@router.post("/students/{student_id}/reveal-apaar", response_model=StudentRevealResponse)
def reveal_student_apaar(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)  # Admin only!
):
    """
    Explicit reveal action for Admin. Writes an immutable audit log entry.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    # Record Audit Log
    record_audit_log(
        db=db,
        action="APAAR_REVEALED",
        target_type="STUDENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        details={"roll_number": student.roll_number, "masked_apaar": mask_apaar_id(student.apaar_id)},
        user=current_user
    )

    return StudentRevealResponse(
        student_id=student.id,
        roll_number=student.roll_number,
        full_name=student.full_name,
        apaar_id=student.apaar_id,
        warning="Confidential APAAR ID accessed. Audit event logged."
    )

@router.post("/students", status_code=status.HTTP_201_CREATED)
def create_student(
    req: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    course = db.query(Course).filter(
        Course.id == req.course_id,
        Course.institution_id == current_user.institution_id
    ).first()
    if not course:
        raise HTTPException(
            status_code=400,
            detail="The specified course does not belong to your institution."
        )

    existing_roll = db.query(Student).filter(
        Student.institution_id == current_user.institution_id,
        Student.admission_year == req.admission_year,
        Student.roll_number == req.roll_number.strip(),
        Student.is_archived == False
    ).first()
    if existing_roll:
        raise HTTPException(
            status_code=400,
            detail=f"Roll number '{req.roll_number}' is already assigned in admission year {req.admission_year}."
        )

    if req.apaar_id and req.apaar_id.strip():
        existing_apaar = db.query(Student).filter(
            Student.institution_id == current_user.institution_id,
            Student.apaar_id == req.apaar_id.strip(),
            Student.is_archived == False
        ).first()
        if existing_apaar:
            raise HTTPException(
                status_code=400,
                detail="This APAAR ID matches an existing record. Review the duplicate alert."
            )

    student = Student(
        institution_id=current_user.institution_id,
        course_id=req.course_id,
        apaar_id=req.apaar_id.strip() if req.apaar_id else None,
        roll_number=req.roll_number.strip(),
        full_name=req.full_name.strip(),
        date_of_birth=req.date_of_birth.strip() if req.date_of_birth else None,
        gender=req.gender,
        admission_year=req.admission_year,
        email=req.email.strip().lower() if req.email else None,
        phone=req.phone.strip() if req.phone else None,
        status="Needs Review",
        version=1
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Automatically run validation on new student
    context = validation_engine._build_context(db, current_user.institution_id)
    results, derived_status = validation_engine.validate_single_record(student, context)
    student.status = derived_status
    for r in results:
        db.add(ValidationResult(
            student_id=student.id,
            rule_id=r.rule_id,
            rule_name=r.rule_name,
            severity=r.severity,
            status=r.status,
            message=r.message,
            affected_field=r.affected_field,
            suggested_action=r.suggested_action,
            rule_version=r.rule_version
        ))
    db.commit()
    db.refresh(student)

    record_audit_log(
        db=db,
        action="STUDENT_CREATED",
        target_type="STUDENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        details={
            "roll_number": student.roll_number,
            "masked_apaar": mask_apaar_id(student.apaar_id),
            "status": student.status
        },
        user=current_user
    )

    return {
        "message": "Student record created successfully.",
        "student_id": student.id,
        "status": student.status,
        "version": student.version
    }

@router.put("/students/{student_id}")
def update_student(
    student_id: int,
    req: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    # Concurrency check (Section 9):
    if req.version is not None and req.version != student.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This record was changed by someone else. Reload and try again."
        )

    if req.course_id:
        course = db.query(Course).filter(
            Course.id == req.course_id,
            Course.institution_id == current_user.institution_id
        ).first()
        if not course:
            raise HTTPException(status_code=400, detail="The selected course does not belong to your institution.")
        student.course_id = req.course_id

    if req.roll_number is not None:
        new_roll = req.roll_number.strip()
        new_year = req.admission_year or student.admission_year
        existing_roll = db.query(Student).filter(
            Student.institution_id == current_user.institution_id,
            Student.admission_year == new_year,
            Student.roll_number == new_roll,
            Student.id != student.id,
            Student.is_archived == False
        ).first()
        if existing_roll:
            raise HTTPException(
                status_code=400,
                detail=f"Roll number '{new_roll}' is already in use for admission year {new_year}."
            )
        student.roll_number = new_roll

    if req.full_name is not None:
        student.full_name = req.full_name.strip()
    if req.apaar_id is not None:
        new_apaar = req.apaar_id.strip() if req.apaar_id.strip() else None
        if new_apaar:
            existing_apaar = db.query(Student).filter(
                Student.institution_id == current_user.institution_id,
                Student.apaar_id == new_apaar,
                Student.id != student.id,
                Student.is_archived == False
            ).first()
            if existing_apaar:
                raise HTTPException(
                    status_code=400,
                    detail="This APAAR ID matches an existing record. Review the duplicate alert."
                )
        student.apaar_id = new_apaar
    if req.admission_year is not None:
        student.admission_year = req.admission_year
    if req.date_of_birth is not None:
        student.date_of_birth = req.date_of_birth.strip() if req.date_of_birth.strip() else None
    if req.gender is not None:
        student.gender = req.gender
    if req.email is not None:
        student.email = req.email.strip().lower() if req.email.strip() else None
    if req.phone is not None:
        student.phone = req.phone.strip() if req.phone.strip() else None

    # Bump version
    student.version += 1

    # Clear old validation results and re-evaluate
    db.query(ValidationResult).filter(ValidationResult.student_id == student.id).delete()
    
    context = validation_engine._build_context(db, current_user.institution_id)
    results, derived_status = validation_engine.validate_single_record(student, context)
    student.status = derived_status
    for r in results:
        db.add(ValidationResult(
            student_id=student.id,
            rule_id=r.rule_id,
            rule_name=r.rule_name,
            severity=r.severity,
            status=r.status,
            message=r.message,
            affected_field=r.affected_field,
            suggested_action=r.suggested_action,
            rule_version=r.rule_version
        ))

    db.commit()
    db.refresh(student)

    record_audit_log(
        db=db,
        action="STUDENT_UPDATED",
        target_type="STUDENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        details={
            "roll_number": student.roll_number,
            "masked_apaar": mask_apaar_id(student.apaar_id),
            "status": student.status,
            "version": student.version
        },
        user=current_user
    )

    return {
        "message": "Student record updated and re-validated.",
        "student_id": student.id,
        "status": student.status,
        "version": student.version
    }

@router.delete("/students/{student_id}")
def archive_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    student.is_archived = True
    student.archived_at = datetime.now(timezone.utc)
    db.commit()

    record_audit_log(
        db=db,
        action="STUDENT_ARCHIVED",
        target_type="STUDENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        details={"roll_number": student.roll_number},
        user=current_user
    )

    return {"message": f"Student '{student.full_name}' ({student.roll_number}) archived successfully."}

@router.post("/students/{student_id}/reveal-apaar", response_model=StudentRevealResponse)
def reveal_apaar_id(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    verify_institution_access(student.institution_id, current_user)

    record_audit_log(
        db=db,
        action="APAAR_REVEALED",
        target_type="STUDENT",
        target_id=str(student.id),
        outcome="SUCCESS",
        details={
            "roll_number": student.roll_number,
            "masked_apaar": mask_apaar_id(student.apaar_id)
        },
        user=current_user
    )

    return StudentRevealResponse(
        student_id=student.id,
        roll_number=student.roll_number,
        full_name=student.full_name,
        apaar_id=student.apaar_id,
        warning="Confidential APAAR ID accessed. Audit event logged."
    )

