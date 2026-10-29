"""
Seed script for APAAR GUARD prototype.
Creates 3 institutions, 6 demo user accounts (1 admin + 1 officer per inst),
courses, intake configurations, and 120 synthetic student records.
Adheres strictly to Corrections & Decisions (v2):
- Student status has ONLY 3 values: Ready, Invalid Data, Needs Review
- ReviewCase status has: Pending Review, In Progress, Correction Requested, Resolved, False Positive
- Review cases carry issue fingerprints
- Aggregate intake configuration with source tracking
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.institution import Institution
from app.models.user import User
from app.models.course import Course
from app.models.student import Student
from app.models.intake import IntakeConfiguration
from app.models.duplicate import DuplicateAlert
from app.models.review import ReviewCase, ReviewNote
from app.services.audit_service import record_audit_log
from app.services.validation.rules import compute_issue_fingerprint, normalize_name

def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database schema reset cleanly with WAL mode & foreign keys enabled.")

def seed_data(db: Session):
    print("Seeding demo data...")
    password_hash = hash_password("password123")

    # 1. Institutions
    institutions = [
        Institution(
            code="AIT-DELHI",
            name="Apex Institute of Technology",
            aicte_id="1-10023412",
            state="Delhi",
            district="New Delhi"
        ),
        Institution(
            code="BNCE-PUNE",
            name="Bharatiya National College of Engineering",
            aicte_id="1-20098711",
            state="Maharashtra",
            district="Pune"
        ),
        Institution(
            code="CERA-TN",
            name="Coromandel Engineering & Research Academy",
            aicte_id="1-30045678",
            state="Tamil Nadu",
            district="Chennai"
        ),
    ]
    db.add_all(institutions)
    db.commit()
    for inst in institutions:
        db.refresh(inst)

    ait, bnce, cera = institutions[0], institutions[1], institutions[2]

    # 2. Demo Users (Admin + Officer per institution)
    users = [
        # AIT
        User(
            email="asha.admin@apex.edu",
            hashed_password=password_hash,
            full_name="Asha Sharma (Admin)",
            role="institution_admin",
            institution_id=ait.id
        ),
        User(
            email="ravi.officer@apex.edu",
            hashed_password=password_hash,
            full_name="Ravi Verma (Officer)",
            role="verification_officer",
            institution_id=ait.id
        ),
        # BNCE
        User(
            email="suresh.admin@bnce.edu",
            hashed_password=password_hash,
            full_name="Suresh Patel (Admin)",
            role="institution_admin",
            institution_id=bnce.id
        ),
        User(
            email="priya.officer@bnce.edu",
            hashed_password=password_hash,
            full_name="Priya Nair (Officer)",
            role="verification_officer",
            institution_id=bnce.id
        ),
        # CERA
        User(
            email="anand.admin@cera.edu",
            hashed_password=password_hash,
            full_name="Anand Kumar (Admin)",
            role="institution_admin",
            institution_id=cera.id
        ),
        User(
            email="deepa.officer@cera.edu",
            hashed_password=password_hash,
            full_name="Deepa Sundaram (Officer)",
            role="verification_officer",
            institution_id=cera.id
        ),
    ]
    db.add_all(users)
    db.commit()
    for u in users:
        db.refresh(u)

    # 3. Courses
    course_catalog = [
        {"code": "CSE", "name": "B.Tech Computer Science and Engineering", "dept": "Computer Science", "duration": 4},
        {"code": "ECE", "name": "B.Tech Electronics & Communication Engineering", "dept": "Electronics", "duration": 4},
        {"code": "MECH", "name": "B.Tech Mechanical Engineering", "dept": "Mechanical", "duration": 4},
        {"code": "IT", "name": "B.Tech Information Technology", "dept": "Information Technology", "duration": 4},
    ]

    all_courses = []
    for inst in [ait, bnce, cera]:
        for c_data in course_catalog:
            course = Course(
                institution_id=inst.id,
                code=c_data["code"],
                name=c_data["name"],
                department=c_data["dept"],
                duration_years=c_data["duration"]
            )
            db.add(course)
            all_courses.append(course)
    db.commit()
    for c in all_courses:
        db.refresh(c)

    ait_courses = {c.code: c for c in all_courses if c.institution_id == ait.id}
    bnce_courses = {c.code: c for c in all_courses if c.institution_id == bnce.id}
    cera_courses = {c.code: c for c in all_courses if c.institution_id == cera.id}

    # 4. Intake Configurations
    intakes = [
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-01", notes="Sanctioned quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["ECE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-02", notes="Sanctioned quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MECH"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-03", notes="Sanctioned quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["IT"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-04", notes="Sanctioned quota"),
        IntakeConfiguration(institution_id=bnce.id, course_id=bnce_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-BNCE-01", notes="Sanctioned quota"),
        # BNCE IT intentionally missing configuration
        IntakeConfiguration(institution_id=cera.id, course_id=cera_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-CERA-01", notes="Sanctioned quota"),
    ]
    db.add_all(intakes)
    db.commit()

    # 5. Synthetic Students Seed (100+ records)
    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
        "Shaurya", "Atharv", "Aryan", "Kabir", "Ananya", "Diya", "Isha", "Riya", "Tanvi", "Saanvi",
        "Kavya", "Anika", "Meera", "Pooja", "Neha", "Sneha", "Kriti", "Shreya", "Nisha", "Priyanka"
    ]
    last_names = [
        "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Iyer", "Rao", "Joshi", "Chopra",
        "Reddy", "Mehta", "Bhatia", "Deshmukh", "Nair", "Pillai", "Das", "Banerjee", "Chatterjee", "Mishra"
    ]

    all_students = []

    # AIT CSE 2026: 68 students (Over-intake aggregate alert scenario)
    for i in range(1, 69):
        first = first_names[i % len(first_names)]
        last = last_names[(i * 3) % len(last_names)]
        apaar = f"0{10000000000 + i}" if i % 4 == 0 else f"{200000000000 + i}"
        roll = f"2026-CSE-{i:03d}"
        
        student = Student(
            institution_id=ait.id,
            course_id=ait_courses["CSE"].id,
            apaar_id=apaar,
            roll_number=roll,
            full_name=f"{first} {last}",
            date_of_birth=f"2005-{((i % 12) + 1):02d}-{((i % 28) + 1):02d}",
            gender="Female" if i % 2 == 0 else "Male",
            admission_year=2026,
            email=f"{first.lower()}.{last.lower()}{i}@example.com",
            phone=f"98765{i:05d}",
            status="Ready",
            version=1
        )
        all_students.append(student)

    # Edge cases in AIT:
    # 1. Invalid APAAR format (too short -> Invalid Data)
    s_invalid1 = Student(
        institution_id=ait.id,
        course_id=ait_courses["ECE"].id,
        apaar_id="12345678", # 8 digits - INVALID
        roll_number="2026-ECE-001",
        full_name="Rohan Malhotra",
        date_of_birth="2005-03-15",
        gender="Male",
        admission_year=2026,
        email="rohan.m@example.com",
        phone="9876543210",
        status="Invalid Data",
        version=1
    )
    # 2. Invalid APAAR format (alphanumeric -> Invalid Data)
    s_invalid2 = Student(
        institution_id=ait.id,
        course_id=ait_courses["ECE"].id,
        apaar_id="1234ABCD5678", # Non-numeric - INVALID
        roll_number="2026-ECE-002",
        full_name="Simran Kaur",
        date_of_birth="2005-07-22",
        gender="Female",
        admission_year=2026,
        email="simran.k@example.com",
        phone="9876543211",
        status="Invalid Data",
        version=1
    )
    # 3. Missing required DOB and empty APAAR (Needs Review because missing APAAR is warning, missing DOB is error -> Invalid Data)
    s_missing = Student(
        institution_id=ait.id,
        course_id=ait_courses["MECH"].id,
        apaar_id="",
        roll_number="2026-MECH-001",
        full_name="Gaurav Sen",
        date_of_birth=None,
        gender="Male",
        admission_year=2026,
        email="gaurav.sen@example.com",
        phone="9876543212",
        status="Invalid Data",
        version=1
    )
    all_students.extend([s_invalid1, s_invalid2, s_missing])

    # 4 & 5. Duplicate APAAR ID pair in AIT -> Needs Review
    duplicate_apaar = "998877665544"
    dup1 = Student(
        institution_id=ait.id,
        course_id=ait_courses["IT"].id,
        apaar_id=duplicate_apaar,
        roll_number="2026-IT-010",
        full_name="Akash Saxena",
        date_of_birth="2005-01-10",
        gender="Male",
        admission_year=2026,
        email="akash.s@example.com",
        phone="9876543220",
        status="Needs Review",
        version=1
    )
    dup2 = Student(
        institution_id=ait.id,
        course_id=ait_courses["IT"].id,
        apaar_id=duplicate_apaar,
        roll_number="2026-IT-011",
        full_name="Alok Saxena",
        date_of_birth="2005-01-10",
        gender="Male",
        admission_year=2026,
        email="alok.s@example.com",
        phone="9876543221",
        status="Needs Review",
        version=1
    )
    all_students.extend([dup1, dup2])

    # 6. Duplicate Roll Number in SAME institution -> Needs Review
    dup_roll_1 = Student(
        institution_id=ait.id,
        course_id=ait_courses["ECE"].id,
        apaar_id="334455667788",
        roll_number="2026-ECE-099",
        full_name="Manish Tiwari",
        date_of_birth="2005-09-12",
        gender="Male",
        admission_year=2026,
        email="manish.t@example.com",
        phone="9876543230",
        status="Needs Review",
        version=1
    )
    dup_roll_2 = Student(
        institution_id=ait.id,
        course_id=ait_courses["ECE"].id,
        apaar_id="556677889900",
        roll_number="2026-ECE-099",
        full_name="Manoj Tiwari",
        date_of_birth="2005-11-05",
        gender="Male",
        admission_year=2026,
        email="manoj.t@example.com",
        phone="9876543231",
        status="Needs Review",
        version=1
    )
    all_students.extend([dup_roll_1, dup_roll_2])

    # 7. Same Roll Number in DIFFERENT institution (BNCE) -> Valid/Ready
    diff_inst_roll = Student(
        institution_id=bnce.id,
        course_id=bnce_courses["CSE"].id,
        apaar_id="778899001122",
        roll_number="2026-ECE-099",
        full_name="Nikhil Deshmukh",
        date_of_birth="2005-04-18",
        gender="Male",
        admission_year=2026,
        email="nikhil.d@bnce-student.in",
        phone="9876543240",
        status="Ready",
        version=1
    )
    all_students.append(diff_inst_roll)

    # 8. Possible duplicate (same name + dob) -> Needs Review
    pos_dup_1 = Student(
        institution_id=ait.id,
        course_id=ait_courses["CSE"].id,
        apaar_id="445566778899",
        roll_number="2026-CSE-101",
        full_name="Karan Kapoor",
        date_of_birth="2005-06-15",
        gender="Male",
        admission_year=2026,
        email="karan.k1@example.com",
        phone="9876543250",
        status="Needs Review",
        version=1
    )
    pos_dup_2 = Student(
        institution_id=ait.id,
        course_id=ait_courses["IT"].id,
        apaar_id="667788990011",
        roll_number="2026-IT-102",
        full_name="Karan Kapoor",
        date_of_birth="2005-06-15",
        gender="Male",
        admission_year=2026,
        email="karan.k2@example.com",
        phone="9876543251",
        status="Needs Review",
        version=1
    )
    all_students.extend([pos_dup_1, pos_dup_2])

    # 9. Additional records for BNCE & CERA to complete 120 total
    for j in range(1, 26):
        bnce_student = Student(
            institution_id=bnce.id,
            course_id=bnce_courses["CSE"].id if j % 2 == 0 else bnce_courses["IT"].id,
            apaar_id=f"7{10000000000 + j}",
            roll_number=f"2026-BNCE-{j:03d}",
            full_name=f"{first_names[j % len(first_names)]} {last_names[(j * 2) % len(last_names)]}",
            date_of_birth="2005-02-14",
            gender="Female" if j % 2 == 0 else "Male",
            admission_year=2026,
            email=f"bnce.student{j}@bnce.edu",
            phone=f"91234{j:05d}",
            status="Ready",
            version=1
        )
        all_students.append(bnce_student)

    for k in range(1, 18):
        cera_student = Student(
            institution_id=cera.id,
            course_id=cera_courses["CSE"].id,
            apaar_id=f"8{10000000000 + k}",
            roll_number=f"2026-CERA-{k:03d}",
            full_name=f"{first_names[(k * 4) % len(first_names)]} {last_names[(k * 3) % len(last_names)]}",
            date_of_birth="2005-10-10",
            gender="Male",
            admission_year=2026,
            email=f"cera.student{k}@cera.edu",
            phone=f"92345{k:05d}",
            status="Ready",
            version=1
        )
        all_students.append(cera_student)

    db.add_all(all_students)
    db.commit()
    for s in all_students:
        db.refresh(s)

    print(f"Total synthetic students seeded: {len(all_students)}")

    # 6. Seed Duplicate Alert and Review Cases with Fingerprints
    dup_alert_1 = DuplicateAlert(
        institution_id=ait.id,
        student_id_1=dup1.id,
        student_id_2=dup2.id,
        alert_type="exact_apaar",
        matching_fields='["apaar_id"]',
        similarity_score=1.0,
        status="open"
    )
    db.add(dup_alert_1)
    db.commit()
    db.refresh(dup_alert_1)

    fp_exact = compute_issue_fingerprint("R3_EXACT_DUPLICATE_APAAR", dup2.id, {"apaar_id": duplicate_apaar})
    review_case_1 = ReviewCase(
        institution_id=ait.id,
        student_id=dup2.id,
        duplicate_alert_id=dup_alert_1.id,
        fingerprint=fp_exact,
        reason="Exact duplicate APAAR ID matched with student 2026-IT-010",
        severity="high",
        status="Pending Review"
    )
    db.add(review_case_1)

    # Pre-seeded Resolved case
    fp_resolved = compute_issue_fingerprint("R1_REQUIRED_FIELDS", dup1.id, {"roll_number": dup1.roll_number})
    review_case_resolved = ReviewCase(
        institution_id=ait.id,
        student_id=dup1.id,
        fingerprint=fp_resolved,
        reason="Typo in student name corrected upon birth certificate verification",
        severity="medium",
        status="Resolved",
        resolution_summary="Verified student identity with physical record. Roster entry confirmed.",
        resolved_at=datetime.now(timezone.utc)
    )
    db.add(review_case_resolved)
    db.commit()
    db.refresh(review_case_resolved)

    db.add(ReviewNote(
        review_case_id=review_case_resolved.id,
        note_text="Identity document verified with institution registrar. Status changed to Resolved.",
        action_taken="resolve"
    ))

    # Pre-seeded False Positive case
    fp_fp = compute_issue_fingerprint("R6_POSSIBLE_DUPLICATE", pos_dup_1.id, {"name": normalize_name(pos_dup_1.full_name), "dob": pos_dup_1.date_of_birth})
    review_case_fp = ReviewCase(
        institution_id=ait.id,
        student_id=pos_dup_1.id,
        fingerprint=fp_fp,
        reason="Possible duplicate flagged for similar name 'Karan Kapoor'",
        severity="low",
        status="False Positive",
        resolution_summary="Two distinct students with distinct parents and Aadhaar numbers. Flagged as False Positive.",
        resolved_at=datetime.now(timezone.utc)
    )
    db.add(review_case_fp)
    db.commit()
    db.refresh(review_case_fp)

    db.add(ReviewNote(
        review_case_id=review_case_fp.id,
        note_text="Confirmed separate individuals. Similarity alert closed.",
        action_taken="mark_false_positive"
    ))

    record_audit_log(
        db=db,
        action="DATABASE_SEEDED",
        target_type="SYSTEM",
        details={"total_students": len(all_students), "institutions": len(institutions)},
        institution_id=ait.id
    )

    print("Seed data completed successfully!")

if __name__ == "__main__":
    reset_db()
    session = SessionLocal()
    try:
        seed_data(session)
    finally:
        session.close()
