from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List, Optional
import io
import pandas as pd

from app.core.database import get_db
from app.core.dependencies import require_regulator
from app.models.user import User
from app.models.institution import Institution
from app.models.course import Course
from app.models.student import Student
from app.models.intake import IntakeConfiguration
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/regulator", tags=["Regulator Oversight"])

CANONICAL_CATEGORIES = ["General", "NRI", "OCI", "Foreign National", "Other"]

@router.get("/overview")
def get_regulator_overview(
    academic_year: int = Query(2026, description="Academic year for intake and enrolment metrics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regulator)
):
    """
    Returns system-wide aggregate metrics for statutory regulator oversight.
    Strictly aggregates data with zero student-level PII exposure.
    """
    total_institutions = db.query(Institution).count()

    # Active students total (all cohorts)
    total_active_all_years = db.query(Student).filter(Student.is_archived == False).count()

    # Active students in selected academic year
    active_year_query = db.query(Student).filter(
        Student.is_archived == False,
        Student.admission_year == academic_year
    )
    active_in_year = active_year_query.count()

    # Regular vs Supernumerary enrolled in selected academic year
    reg_enrolled_in_year = active_year_query.filter(Student.is_supernumerary == False).count()
    super_enrolled_in_year = active_year_query.filter(Student.is_supernumerary == True).count()

    # Intake configurations across all institutions for selected academic year
    intake_configs = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.academic_year == academic_year
    ).all()

    total_approved_regular = sum(c.approved_intake for c in intake_configs)
    total_supernumerary_intake = sum(c.supernumerary_intake for c in intake_configs)

    overall_regular_utilization = (
        round((reg_enrolled_in_year / total_approved_regular * 100.0), 1)
        if total_approved_regular > 0 else 0.0
    )

    # Admission categories breakdown across active students in academic year
    cat_rows = (
        db.query(Student.admission_category, func.count(Student.id))
        .filter(Student.is_archived == False, Student.admission_year == academic_year)
        .group_by(Student.admission_category)
        .all()
    )
    category_counts = {k: 0 for k in CANONICAL_CATEGORIES}
    for cat_name, cnt in cat_rows:
        canonical_name = cat_name or "General"
        if canonical_name == "FN":
            canonical_name = "Foreign National"
        if canonical_name in category_counts:
            category_counts[canonical_name] += cnt
        else:
            category_counts["Other"] += cnt

    # Data Quality / Validation Status breakdown (all active students)
    validation_status_rows = (
        db.query(Student.status, func.count(Student.id))
        .filter(Student.is_archived == False)
        .group_by(Student.status)
        .all()
    )
    data_quality = {
        "ready_count": 0,
        "needs_review_count": 0,
        "invalid_data_count": 0
    }
    for st_label, cnt in validation_status_rows:
        if st_label == "Ready":
            data_quality["ready_count"] = cnt
        elif st_label == "Needs Review":
            data_quality["needs_review_count"] = cnt
        elif st_label == "Invalid Data":
            data_quality["invalid_data_count"] = cnt
    data_quality["total_evaluated"] = sum(data_quality.values())

    # Duplicate alerts & review cases summaries
    pending_reviews = (
        db.query(ReviewCase)
        .filter(ReviewCase.status == "Pending Review")
        .count()
    )
    open_duplicate_alerts = (
        db.query(DuplicateAlert)
        .filter(DuplicateAlert.status == "open")
        .count()
    )
    cross_inst_collisions = (
        db.query(DuplicateAlert)
        .filter(
            DuplicateAlert.status == "open",
            DuplicateAlert.alert_type == "cross_institution_apaar"
        )
        .count()
    )

    # Calculate course and institution over-capacity counts
    # Group regular enrolled count by (institution_id, course_id)
    course_reg_rows = (
        db.query(Student.institution_id, Student.course_id, func.count(Student.id))
        .filter(
            Student.is_archived == False,
            Student.admission_year == academic_year,
            Student.is_supernumerary == False
        )
        .group_by(Student.institution_id, Student.course_id)
        .all()
    )
    reg_by_course = {(r[0], r[1]): r[2] for r in course_reg_rows}

    exceeding_courses_count = 0
    exceeding_institutions = set()

    for config in intake_configs:
        reg_cnt = reg_by_course.get((config.institution_id, config.course_id), 0)
        if config.approved_intake > 0 and reg_cnt > config.approved_intake:
            exceeding_courses_count += 1
            exceeding_institutions.add(config.institution_id)

    # Record Audit Event (NO PII)
    record_audit_log(
        db=db,
        action="REGULATOR_DASHBOARD_ACCESSED",
        target_type="SYSTEM",
        details={"academic_year": academic_year, "institutions_represented": total_institutions},
        user=current_user
    )

    return {
        "academic_year": academic_year,
        "total_institutions": total_institutions,
        "total_active_students_all_years": total_active_all_years,
        "total_active_students": active_in_year,
        "total_approved_regular_intake": total_approved_regular,
        "total_regular_enrolled": reg_enrolled_in_year,
        "total_supernumerary_intake": total_supernumerary_intake,
        "total_supernumerary_enrolled": super_enrolled_in_year,
        "overall_regular_utilization": overall_regular_utilization,
        "institutions_exceeding_capacity_count": len(exceeding_institutions),
        "courses_exceeding_capacity_count": exceeding_courses_count,
        "admission_categories": category_counts,
        "data_quality_summary": data_quality,
        "duplicate_review_summary": {
            "pending_review_cases": pending_reviews,
            "total_open_duplicate_alerts": open_duplicate_alerts,
            "cross_institution_collisions": cross_inst_collisions
        },
        "disclaimer": "Statutory regulatory oversight view. Aggregated institutional data only — student-level PII excluded."
    }

@router.get("/institutions")
def list_regulator_institutions(
    academic_year: int = Query(2026, description="Academic year for intake and enrolment metrics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regulator)
):
    """
    Returns aggregate monitoring rows per registered institution.
    Strictly aggregates data with zero student-level PII exposure.
    """
    institutions = db.query(Institution).order_by(Institution.name).all()

    # Pre-fetch intake configs for academic year
    intake_configs = (
        db.query(IntakeConfiguration)
        .filter(IntakeConfiguration.academic_year == academic_year)
        .all()
    )
    configs_by_inst_and_course = {(c.institution_id, c.course_id): c for c in intake_configs}
    configs_by_inst = {}
    for c in intake_configs:
        configs_by_inst.setdefault(c.institution_id, []).append(c)

    # Pre-fetch active student counts by institution and category for academic year
    active_students_rows = (
        db.query(
            Student.institution_id,
            Student.is_supernumerary,
            Student.admission_category,
            func.count(Student.id)
        )
        .filter(
            Student.is_archived == False,
            Student.admission_year == academic_year
        )
        .group_by(
            Student.institution_id,
            Student.is_supernumerary,
            Student.admission_category
        )
        .all()
    )

    inst_data_map = {}
    for inst_id, is_super, cat, cnt in active_students_rows:
        if inst_id not in inst_data_map:
            inst_data_map[inst_id] = {
                "regular_enrolled": 0,
                "supernumerary_enrolled": 0,
                "categories": {k: 0 for k in CANONICAL_CATEGORIES}
            }
        if is_super:
            inst_data_map[inst_id]["supernumerary_enrolled"] += cnt
        else:
            inst_data_map[inst_id]["regular_enrolled"] += cnt

        c_name = cat or "General"
        if c_name == "FN":
            c_name = "Foreign National"
        if c_name in inst_data_map[inst_id]["categories"]:
            inst_data_map[inst_id]["categories"][c_name] += cnt
        else:
            inst_data_map[inst_id]["categories"]["Other"] += cnt

    # Pre-fetch course-level regular enrolled counts to detect exceeding courses
    course_reg_rows = (
        db.query(Student.institution_id, Student.course_id, func.count(Student.id))
        .filter(
            Student.is_archived == False,
            Student.admission_year == academic_year,
            Student.is_supernumerary == False
        )
        .group_by(Student.institution_id, Student.course_id)
        .all()
    )
    reg_by_inst_course = {(r[0], r[1]): r[2] for r in course_reg_rows}

    # Pre-fetch pending review cases by institution
    review_rows = (
        db.query(ReviewCase.institution_id, func.count(ReviewCase.id))
        .filter(ReviewCase.status == "Pending Review")
        .group_by(ReviewCase.institution_id)
        .all()
    )
    pending_by_inst = {r[0]: r[1] for r in review_rows}

    # Pre-fetch open duplicate alerts by institution
    alert_rows = (
        db.query(DuplicateAlert.institution_id, func.count(DuplicateAlert.id))
        .filter(DuplicateAlert.status == "open")
        .group_by(DuplicateAlert.institution_id)
        .all()
    )
    alerts_by_inst = {r[0]: r[1] for r in alert_rows}

    # Courses offered by institution
    courses = db.query(Course.institution_id, func.count(Course.id)).group_by(Course.institution_id).all()
    courses_by_inst = {r[0]: r[1] for r in courses}

    results = []
    for inst in institutions:
        inst_id = inst.id
        info = inst_data_map.get(inst_id, {
            "regular_enrolled": 0,
            "supernumerary_enrolled": 0,
            "categories": {k: 0 for k in CANONICAL_CATEGORIES}
        })
        inst_configs = configs_by_inst.get(inst_id, [])

        approved_regular = sum(c.approved_intake for c in inst_configs)
        supernumerary_quota = sum(c.supernumerary_intake for c in inst_configs)

        reg_enrolled = info["regular_enrolled"]
        super_enrolled = info["supernumerary_enrolled"]
        total_enrolled = reg_enrolled + super_enrolled

        # Count exceeding courses
        exceeding_courses = 0
        for c in inst_configs:
            c_reg = reg_by_inst_course.get((inst_id, c.course_id), 0)
            if c.approved_intake > 0 and c_reg > c.approved_intake:
                exceeding_courses += 1

        if approved_regular <= 0:
            status_label = "Configuration Missing"
            utilization = 0.0
            warning_msg = "Intake quotas not configured for this academic session."
        else:
            utilization = round((reg_enrolled / approved_regular * 100.0), 1)
            if reg_enrolled > approved_regular or exceeding_courses > 0:
                status_label = "Exceeds Capacity"
                warning_msg = f"{exceeding_courses} course(s) exceed approved AICTE regular intake capacity."
            elif utilization >= 90.0:
                status_label = "Near Capacity"
                warning_msg = f"Institutional enrollment is near capacity ({utilization}%)."
            else:
                status_label = "Within Capacity"
                warning_msg = None

        results.append({
            "institution_id": inst.id,
            "institution_name": inst.name,
            "institution_code": inst.code,
            "aicte_id": inst.aicte_id,
            "state": inst.state,
            "district": inst.district,
            "active_students_count": total_enrolled,
            "approved_regular_intake": approved_regular,
            "regular_enrolled": reg_enrolled,
            "supernumerary_quota": supernumerary_quota,
            "supernumerary_enrolled": super_enrolled,
            "regular_utilization": utilization,
            "status": status_label,
            "warning": warning_msg,
            "admission_categories": info["categories"],
            "pending_review_cases": pending_by_inst.get(inst_id, 0),
            "open_duplicate_alerts": alerts_by_inst.get(inst_id, 0),
            "courses_count": courses_by_inst.get(inst_id, 0),
            "courses_exceeding_count": exceeding_courses
        })

    return {
        "academic_year": academic_year,
        "total_institutions": len(results),
        "items": results,
        "disclaimer": "Statutory regulatory oversight view. Aggregated institutional data only — student-level PII excluded."
    }

@router.get("/institutions/{institution_id}/courses")
def get_regulator_institution_courses(
    institution_id: int,
    academic_year: int = Query(2026, description="Academic year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regulator)
):
    """
    Returns aggregate course capacity and demographic breakdown for a single institution.
    Strictly aggregates data with zero student-level PII exposure.
    """
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found.")

    courses = db.query(Course).filter(Course.institution_id == institution_id).order_by(Course.code).all()
    intakes = db.query(IntakeConfiguration).filter(
        IntakeConfiguration.institution_id == institution_id,
        IntakeConfiguration.academic_year == academic_year
    ).all()
    intake_by_course = {i.course_id: i for i in intakes}

    # Student regular and supernumerary counts
    counts_rows = (
        db.query(Student.course_id, Student.is_supernumerary, func.count(Student.id))
        .filter(
            Student.institution_id == institution_id,
            Student.admission_year == academic_year,
            Student.is_archived == False
        )
        .group_by(Student.course_id, Student.is_supernumerary)
        .all()
    )
    reg_counts = {}
    super_counts = {}
    for cid, is_super, cnt in counts_rows:
        if is_super:
            super_counts[cid] = super_counts.get(cid, 0) + cnt
        else:
            reg_counts[cid] = reg_counts.get(cid, 0) + cnt

    # Category counts by course
    cat_rows = (
        db.query(Student.course_id, Student.admission_category, func.count(Student.id))
        .filter(
            Student.institution_id == institution_id,
            Student.admission_year == academic_year,
            Student.is_archived == False
        )
        .group_by(Student.course_id, Student.admission_category)
        .all()
    )
    categories_by_course = {}
    for cid, cat, cnt in cat_rows:
        c_name = cat or "General"
        if c_name == "FN":
            c_name = "Foreign National"
        categories_by_course.setdefault(cid, {})[c_name] = categories_by_course.setdefault(cid, {}).get(c_name, 0) + cnt

    course_rows = []
    for c in courses:
        config = intake_by_course.get(c.id)
        reg_cnt = reg_counts.get(c.id, 0)
        super_cnt = super_counts.get(c.id, 0)
        approved = config.approved_intake if config else 0
        super_quota = config.supernumerary_intake if config else 0

        c_cats = categories_by_course.get(c.id, {})
        category_breakdown = {
            "General": c_cats.get("General", 0),
            "NRI": c_cats.get("NRI", 0),
            "OCI": c_cats.get("OCI", 0),
            "Foreign National": c_cats.get("Foreign National", 0),
            "Other": c_cats.get("Other", 0)
        }

        if not config or approved <= 0:
            status_label = "Configuration Missing"
            utilization = 0.0
            remaining = 0
            warning_msg = "Intake configuration missing."
        else:
            remaining = approved - reg_cnt
            utilization = round((reg_cnt / approved * 100.0), 1)
            if reg_cnt > approved:
                status_label = "Exceeds Capacity"
                warning_msg = f"Regular enrollment ({reg_cnt}) exceeds approved quota ({approved}) by {reg_cnt - approved} seats."
            elif utilization >= 90.0:
                status_label = "Near Capacity"
                warning_msg = f"Course is near capacity at {utilization}%."
            else:
                status_label = "Within Capacity"
                warning_msg = None

        course_rows.append({
            "course_id": c.id,
            "course_code": c.code,
            "course_name": c.name,
            "approved_regular_intake": approved,
            "supernumerary_quota": super_quota,
            "regular_enrolled": reg_cnt,
            "supernumerary_enrolled": super_cnt,
            "total_enrolled": reg_cnt + super_cnt,
            "remaining_regular_capacity": remaining,
            "regular_utilization": utilization,
            "status": status_label,
            "warning": warning_msg,
            "categories": category_breakdown
        })

    return {
        "institution_id": inst.id,
        "institution_name": inst.name,
        "institution_code": inst.code,
        "academic_year": academic_year,
        "courses": course_rows,
        "disclaimer": "Statutory regulatory oversight view. Aggregated institutional data only — student-level PII excluded."
    }

@router.get("/export")
def export_regulator_summary_csv(
    academic_year: int = Query(2026, description="Academic year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regulator)
):
    """
    Exports aggregate institutional capacity and quality monitoring data as CSV.
    Strictly aggregates data with zero student-level PII exposure.
    """
    inst_response = list_regulator_institutions(academic_year=academic_year, db=db, current_user=current_user)
    items = inst_response["items"]

    csv_rows = []
    for it in items:
        csv_rows.append({
            "Institution Code": it["institution_code"],
            "Institution Name": it["institution_name"],
            "AICTE ID": it["aicte_id"] or "",
            "State": it["state"] or "",
            "Approved Regular Intake": it["approved_regular_intake"],
            "Regular Enrolled": it["regular_enrolled"],
            "Supernumerary Quota": it["supernumerary_quota"],
            "Supernumerary Enrolled": it["supernumerary_enrolled"],
            "Total Active Enrolled": it["active_students_count"],
            "Regular Utilization %": f"{it['regular_utilization']}%",
            "Capacity Status": it["status"],
            "Courses Exceeding Capacity": it["courses_exceeding_count"],
            "Pending Review Cases": it["pending_review_cases"],
            "Open Duplicate Alerts": it["open_duplicate_alerts"],
            "General Category": it["admission_categories"].get("General", 0),
            "NRI Category": it["admission_categories"].get("NRI", 0),
            "OCI Category": it["admission_categories"].get("OCI", 0),
            "Foreign National Category": it["admission_categories"].get("Foreign National", 0),
            "Other Category": it["admission_categories"].get("Other", 0)
        })

    df = pd.DataFrame(csv_rows)
    output = io.StringIO()
    df.to_csv(output, index=False)

    filename = f"regulator_institutions_summary_{academic_year}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

