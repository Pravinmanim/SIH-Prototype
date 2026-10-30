"""
Comprehensive Seed Script for APAAR GUARD Prototype.
Creates:
- 3 AICTE institutions (Delhi, Maharashtra, Tamil Nadu)
- 6 Demo user accounts (Admin + Verification Officer per institution, password: password123)
- 24 AICTE-approved programs/courses per institution (Engineering, Technology, Management, Pharmacy)
- Complete Intake Configurations for 2026 with varied utilization (Over Capacity, Near Limit, Within Limit, Unconfigured)
- 180+ Realistic student records across programs, years (2024, 2025, 2026), and formats
- 35 Realistic Review Cases across all 5 statuses (Pending Review, In Progress, Correction Requested, Resolved, False Positive)
- 45+ Comprehensive Immutable Audit Log events demonstrating portal activity
"""
from datetime import datetime, timezone, timedelta
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
    print("Seeding comprehensive prototype data...")
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

    # 3. Comprehensive 24 AICTE Programs / Courses
    course_catalog = [
        {"code": "CSE", "name": "B.Tech Computer Science and Engineering", "dept": "Computer Science", "duration": 4},
        {"code": "AIML", "name": "B.Tech Artificial Intelligence & Machine Learning", "dept": "Computer Science", "duration": 4},
        {"code": "DS", "name": "B.Tech Data Science & Analytics", "dept": "Computer Science", "duration": 4},
        {"code": "CYBER", "name": "B.Tech Cyber Security & Forensics", "dept": "Computer Science", "duration": 4},
        {"code": "IT", "name": "B.Tech Information Technology", "dept": "Information Technology", "duration": 4},
        {"code": "IOT", "name": "B.Tech Internet of Things & Automation", "dept": "Electronics", "duration": 4},
        {"code": "ECE", "name": "B.Tech Electronics & Communication Engineering", "dept": "Electronics", "duration": 4},
        {"code": "EEE", "name": "B.Tech Electrical & Electronics Engineering", "dept": "Electrical", "duration": 4},
        {"code": "MECH", "name": "B.Tech Mechanical Engineering", "dept": "Mechanical", "duration": 4},
        {"code": "ROBOT", "name": "B.Tech Robotics & Automation", "dept": "Mechanical", "duration": 4},
        {"code": "CIVIL", "name": "B.Tech Civil Engineering", "dept": "Civil", "duration": 4},
        {"code": "AERO", "name": "B.Tech Aerospace Engineering", "dept": "Aerospace", "duration": 4},
        {"code": "AUTO", "name": "B.Tech Automobile Engineering", "dept": "Mechanical", "duration": 4},
        {"code": "CHEM", "name": "B.Tech Chemical Engineering", "dept": "Chemical", "duration": 4},
        {"code": "BIOTECH", "name": "B.Tech Biotechnology", "dept": "Biotechnology", "duration": 4},
        {"code": "BIOMED", "name": "B.Tech Biomedical Engineering", "dept": "Biomedical", "duration": 4},
        {"code": "MCA", "name": "Master of Computer Applications", "dept": "Computer Applications", "duration": 2},
        {"code": "MBA-BA", "name": "MBA Business Analytics", "dept": "Management Studies", "duration": 2},
        {"code": "MBA-FIN", "name": "MBA Financial Management", "dept": "Management Studies", "duration": 2},
        {"code": "MBA-HR", "name": "MBA Human Resource Management", "dept": "Management Studies", "duration": 2},
        {"code": "MTECH-CSE", "name": "M.Tech Advanced Computer Science", "dept": "Computer Science", "duration": 2},
        {"code": "MTECH-VLSI", "name": "M.Tech VLSI Design & Microelectronics", "dept": "Electronics", "duration": 2},
        {"code": "MTECH-AI", "name": "M.Tech Artificial Intelligence", "dept": "Computer Science", "duration": 2},
        {"code": "BPHARM", "name": "Bachelor of Pharmacy", "dept": "Pharmacy", "duration": 4},
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

    # 4. Intake Configurations for 2026 (Varied Quotas and Statuses)
    intakes = [
        # Over capacity: CSE (approved 60, enrolled 68 -> Over by 8)
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-01", notes="Sanctioned quota - Over capacity scenario"),
        # Near capacity: AIML (approved 60, enrolled 58 -> 96%)
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["AIML"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-02", notes="High demand emerging tech branch"),
        # Within limit: DS, CYBER, IT, IOT, ECE, EEE, MECH, ROBOT, etc.
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["DS"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-03", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["CYBER"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-04", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["IT"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-05", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["IOT"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-06", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["ECE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-07", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["EEE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-08", notes="Sanctioned AICTE quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MECH"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-09", notes="Core engineering branch"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["ROBOT"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-10", notes="Specialized robotics intake"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["CIVIL"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-11", notes="Core civil engineering quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["AERO"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-12", notes="Aerospace specialized quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["AUTO"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-13", notes="Automotive technology batch"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["CHEM"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-14", notes="Chemical engineering quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["BIOTECH"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-15", notes="Biotech research stream"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["BIOMED"].id, academic_year=2026, approved_intake=30, source="AICTE Approval Letter 2026-AIT-16", notes="Biomedical engineering"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MCA"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-17", notes="Postgraduate computer applications"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MBA-BA"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-18", notes="Management school analytics track"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MBA-FIN"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-19", notes="Management school finance track"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MBA-HR"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-AIT-20", notes="Management school human resources track"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MTECH-CSE"].id, academic_year=2026, approved_intake=18, source="AICTE Approval Letter 2026-AIT-21", notes="M.Tech research PG quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MTECH-VLSI"].id, academic_year=2026, approved_intake=18, source="AICTE Approval Letter 2026-AIT-22", notes="M.Tech VLSI PG quota"),
        IntakeConfiguration(institution_id=ait.id, course_id=ait_courses["MTECH-AI"].id, academic_year=2026, approved_intake=18, source="AICTE Approval Letter 2026-AIT-23", notes="M.Tech AI PG quota"),
        # Note: BPHARM is intentionally left without IntakeConfiguration to demo 'Unconfigured' status filter!
        
        # BNCE & CERA
        IntakeConfiguration(institution_id=bnce.id, course_id=bnce_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-BNCE-01", notes="Sanctioned quota"),
        IntakeConfiguration(institution_id=cera.id, course_id=cera_courses["CSE"].id, academic_year=2026, approved_intake=60, source="AICTE Approval Letter 2026-CERA-01", notes="Sanctioned quota"),
    ]
    db.add_all(intakes)
    db.commit()

    # 5. Synthetic Students Seed (180+ records)
    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
        "Shaurya", "Atharv", "Aryan", "Kabir", "Ananya", "Diya", "Isha", "Riya", "Tanvi", "Saanvi",
        "Kavya", "Anika", "Meera", "Pooja", "Neha", "Sneha", "Kriti", "Shreya", "Nisha", "Priyanka",
        "Vikram", "Rohan", "Siddharth", "Rahul", "Karan", "Manish", "Gaurav", "Naveen", "Deepak", "Amit"
    ]
    last_names = [
        "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Iyer", "Rao", "Joshi", "Chopra",
        "Reddy", "Mehta", "Bhatia", "Deshmukh", "Nair", "Pillai", "Das", "Banerjee", "Chatterjee", "Mishra",
        "Kulkarni", "Saxena", "Agarwal", "Chauhan", "Pandey"
    ]

    all_students = []

    # AIT CSE 2026: 68 students (Over-intake aggregate alert scenario: 68 enrolled vs 60 approved)
    for i in range(1, 69):
        first = first_names[i % len(first_names)]
        last = last_names[(i * 3) % len(last_names)]
        # Preserves leading zero APAAR IDs required by test_seed_data_integrity
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

    # Additional diverse students across AIML, DS, CYBER, EEE, ROBOT, MCA, MBA for AIT
    additional_ait_courses = ["AIML", "DS", "CYBER", "EEE", "ROBOT", "CIVIL", "MCA", "MBA-BA"]
    for idx, c_code in enumerate(additional_ait_courses):
        for s_idx in range(1, 9):
            fn = first_names[(idx * 4 + s_idx) % len(first_names)]
            ln = last_names[(idx * 2 + s_idx) % len(last_names)]
            s_extra = Student(
                institution_id=ait.id,
                course_id=ait_courses[c_code].id,
                apaar_id=f"300{idx:02d}{s_idx:07d}",
                roll_number=f"2026-{c_code}-{s_idx:03d}",
                full_name=f"{fn} {ln}",
                date_of_birth=f"2004-{((s_idx % 12) + 1):02d}-15",
                gender="Female" if s_idx % 2 == 0 else "Male",
                admission_year=2026,
                email=f"{fn.lower()}.{ln.lower()}{s_idx}@apex.edu",
                phone=f"98711{idx}{s_idx:04d}",
                status="Needs Review" if s_idx == 1 else "Ready",
                version=1
            )
            all_students.append(s_extra)

    # 9. Additional records for BNCE & CERA
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

    # 6. Seed Duplicate Alerts and 35 Realistic Review Cases
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

    review_cases_data = [
        # (student_obj, reason, severity, status, resolution_summary, notes)
        (dup2, "Exact duplicate APAAR ID matched with student 2026-IT-010", "high", "Pending Review", None, None),
        (dup_roll_1, "Duplicate roll number 2026-ECE-099 assigned to multiple students in ECE department", "critical", "Pending Review", None, None),
        (dup_roll_2, "Roll number conflict with existing ECE record #2026-ECE-099", "critical", "Pending Review", None, None),
        (s_invalid1, "APAAR ID length anomaly: 8 digits supplied instead of mandatory 12 numeric digits", "critical", "Pending Review", None, None),
        (s_invalid2, "APAAR ID alphanumeric anomaly: characters detected in strictly numeric 12-digit field", "critical", "In Progress", None, "Contacted admissions cell to request official UID copy."),
        (s_missing, "Mandatory Date of Birth missing from university matriculation record", "high", "Correction Requested", None, "Requested student to submit Class 10 pass certificate."),
        (pos_dup_2, "Possible duplicate candidate: Identical student name 'Karan Kapoor' and DOB", "high", "Pending Review", None, None),
        (all_students[0], "APAAR checksum warning: format passes 12-digit numeric check but NAD record pending verification", "medium", "Pending Review", None, None),
        (all_students[2], "Mother's name differs between admission form and secondary board certificate", "medium", "Pending Review", None, None),
        (all_students[4], "Student age is under 17 years at time of technical university admission", "medium", "In Progress", None, "Awaiting school leaving certificate clarification from regional board."),
        (all_students[6], "Discrepancy in permanent address PIN code and declared state jurisdiction", "low", "Pending Review", None, None),
        (all_students[8], "Special category certificate verification pending with state social welfare portal", "low", "Pending Review", None, None),
        (all_students[10], "Phone number formatting anomaly: non-standard 10-digit sequence flagged", "medium", "Correction Requested", None, "SMS reminder sent to student to update emergency contact number."),
        (all_students[12], "Academic session mismatch: student registered in both 2025 and 2026 admission cycles", "high", "In Progress", None, "Verification officer reviewing lateral entry transfer request."),
        (all_students[14], "Phonetic similarity match with student in sister campus (BNCE Pune)", "medium", "Pending Review", None, None),
        (all_students[16], "Student photo upload resolution below AICTE portal requirement threshold", "low", "Correction Requested", None, "High-resolution passport photograph requested."),
        (all_students[18], "Name spelling variance: expanded initials differ from birth certificate", "medium", "Pending Review", None, None),
        (all_students[20], "Gender record inconsistency between portal profile and secondary board marksheet", "high", "In Progress", None, "Cross-checking original government ID card."),
        (all_students[22], "Lateral entry diploma transcript marks verification pending with state board", "medium", "Pending Review", None, None),
        (all_students[24], "Duplicate email address shared between two student applications", "low", "Pending Review", None, None),
        (all_students[26], "Course transfer request from Mechanical to Computer Science under verification", "medium", "In Progress", None, "Branch change committee approval memo attached."),
        (all_students[28], "Scholarship portal identifier mapping conflict with state welfare system", "medium", "Pending Review", None, None),
        (all_students[30], "Sports quota eligibility certificate awaiting physical verification", "low", "Correction Requested", None, "National federation certificate submitted for validation."),
        (all_students[32], "Domicile certificate document verification pending with revenue department", "medium", "In Progress", None, "Tehsildar counter-signature being inspected."),
        (all_students[34], "Blood group not recorded in institutional emergency medical records", "low", "Pending Review", None, None),
        (all_students[36], "Hostel accommodation record roll number mismatch", "low", "Pending Review", None, None),
        (all_students[38], "APAAR ID digit transposition detected during automated intake ingest", "high", "In Progress", None, "Applicant confirmed 2 transposed digits in original admission paper."),
        (all_students[40], "EWS category annual income certificate validity period expired", "high", "Correction Requested", None, "Fresh financial year income certificate requested from district magistrate."),
        (all_students[42], "Minor typo in student father's middle name resolved with secondary school leaving record", "medium", "Resolved", "Verified father name from original Class 10 certificate. Roster entry confirmed.", "Document verified by Officer Ravi Verma. Status set to Resolved."),
        (all_students[44], "Format mismatch in birth date day/month order corrected upon passport inspection", "medium", "Resolved", "Passport copy reviewed. Date of birth adjusted to ISO-8601.", "Verified against valid government ID."),
        (all_students[46], "Duplicate phone number cleared as family contact for siblings", "low", "Resolved", "Verified that students are twin siblings sharing guardian contact.", "Parent confirmation letter received on file."),
        (all_students[48], "Missing secondary school board roll number updated from original scorecard", "medium", "Resolved", "Roll code updated from marksheet verification portal.", "Roster updated and finalized."),
        (dup1, "Typo in student name corrected upon birth certificate verification", "medium", "Resolved", "Verified student identity with physical record. Roster entry confirmed.", "Identity document verified with institution registrar. Status changed to Resolved."),
        (pos_dup_1, "Possible duplicate flagged for similar name 'Karan Kapoor'", "low", "False Positive", "Two distinct students with distinct parents and Aadhaar numbers. Flagged as False Positive.", "Confirmed separate individuals. Similarity alert closed."),
        (all_students[50], "Phonetic similarity flag with student in affiliated polytechnic", "low", "False Positive", "Distinct students with verified independent family backgrounds.", "Determined to be unrelated individuals by Officer Ravi Verma."),
        (all_students[52], "Identical surname and street address flagged by heuristic deduplicator", "low", "False Positive", "Confirmed cousins residing in ancestral joint family home with distinct national IDs.", "Family tree declaration verified."),
    ]

    for idx, (student_rec, reason, severity, c_status, res_summary, note_text) in enumerate(review_cases_data):
        rule_code = "R3_EXACT_DUPLICATE_APAAR" if "duplicate APAAR" in reason else "R1_REQUIRED_FIELDS" if "length" in reason or "missing" in reason else "R6_POSSIBLE_DUPLICATE"
        fp = compute_issue_fingerprint(rule_code, student_rec.id, {"reason": reason, "index": idx})
        rc = ReviewCase(
            institution_id=ait.id,
            student_id=student_rec.id,
            duplicate_alert_id=dup_alert_1.id if idx == 0 else None,
            fingerprint=fp,
            reason=reason,
            severity=severity,
            status=c_status,
            resolution_summary=res_summary,
            resolved_at=datetime.now(timezone.utc) if c_status in ["Resolved", "False Positive"] else None
        )
        db.add(rc)
        db.commit()
        db.refresh(rc)

        if note_text:
            db.add(ReviewNote(
                review_case_id=rc.id,
                note_text=note_text,
                action_taken="resolve" if c_status == "Resolved" else "mark_false_positive" if c_status == "False Positive" else "start_review"
            ))

    # 7. Seed 45+ Comprehensive Immutable Audit Log Events
    audit_events = [
        ("LOGIN_SUCCESS", "USER", "1", "SUCCESS", {"email": "asha.admin@apex.edu", "method": "password_auth"}),
        ("LOGIN_SUCCESS", "USER", "2", "SUCCESS", {"email": "ravi.officer@apex.edu", "method": "password_auth"}),
        ("LOGIN_FAILED", "USER", None, "FAILURE", {"email": "unknown.user@apex.edu", "reason": "invalid_credentials"}),
        ("STUDENT_CREATED", "STUDENT", "1", "SUCCESS", {"name": "Aarav Sharma", "course": "CSE", "roll": "2026-CSE-001"}),
        ("STUDENT_CREATED", "STUDENT", "2", "SUCCESS", {"name": "Vivaan Verma", "course": "CSE", "roll": "2026-CSE-002"}),
        ("APAAR_REVEALED", "STUDENT", "1", "SUCCESS", {"reason": "Official roster audit for statutory submission", "student": "Aarav Sharma"}),
        ("APAAR_REVEALED", "STUDENT", "5", "SUCCESS", {"reason": "Identity verification against physical registration dossier", "student": "Arjun Patel"}),
        ("VALIDATION_RUN_EXECUTED", "SYSTEM", "AIT-DELHI", "SUCCESS", {"records_checked": 180, "invalid_count": 3, "review_count": 35}),
        ("BATCH_IMPORT_COMPLETED", "IMPORT_BATCH", "BATCH-2026-001", "SUCCESS", {"filename": "btech_first_year_admissions.xlsx", "total_rows": 60, "valid_rows": 58, "errors": 2}),
        ("INTAKE_CAPACITY_UPDATED", "INTAKE_CONFIG", "CSE-2026", "SUCCESS", {"course": "CSE", "approved_intake": 60, "source": "AICTE Approval Letter 2026-AIT-01"}),
        ("INTAKE_CAPACITY_UPDATED", "INTAKE_CONFIG", "AIML-2026", "SUCCESS", {"course": "AIML", "approved_intake": 60, "source": "AICTE Approval Letter 2026-AIT-02"}),
        ("INTAKE_CAPACITY_UPDATED", "INTAKE_CONFIG", "DS-2026", "SUCCESS", {"course": "DS", "approved_intake": 60, "source": "AICTE Approval Letter 2026-AIT-03"}),
        ("INTAKE_CAPACITY_UPDATED", "INTAKE_CONFIG", "CYBER-2026", "SUCCESS", {"course": "CYBER", "approved_intake": 60, "source": "AICTE Approval Letter 2026-AIT-04"}),
        ("REVIEW_CASE_OPENED", "REVIEW_CASE", "1", "SUCCESS", {"severity": "high", "issue": "Exact duplicate APAAR ID"}),
        ("REVIEW_CASE_OPENED", "REVIEW_CASE", "2", "SUCCESS", {"severity": "critical", "issue": "Duplicate roll number collision"}),
        ("REVIEW_STATUS_CHANGED", "REVIEW_CASE", "2", "SUCCESS", {"old_status": "Pending Review", "new_status": "In Progress"}),
        ("REVIEW_DETERMINATION_RESOLVED", "REVIEW_CASE", "32", "SUCCESS", {"determination": "Resolved", "justification": "Verified student identity with physical record"}),
        ("FALSE_POSITIVE_RECORDED", "REVIEW_CASE", "33", "SUCCESS", {"determination": "False Positive", "justification": "Confirmed separate individuals with distinct Aadhaar IDs"}),
        ("STUDENT_RECORD_ARCHIVED", "STUDENT", "12", "SUCCESS", {"reason": "Student transferred to another state university", "roll": "2025-MECH-012"}),
        ("REPORT_EXPORTED_CSV", "REPORTS", "AIT-DELHI", "SUCCESS", {"report_type": "STUDENT_ROSTER", "format": "CSV", "record_count": 180}),
        ("REPORT_EXPORTED_PDF", "REPORTS", "AIT-DELHI", "SUCCESS", {"report_type": "INTAKE_COMPLIANCE", "format": "PDF", "academic_year": 2026}),
        ("AUDIT_LOG_EXPORTED", "AUDIT_TRAIL", "AIT-DELHI", "SUCCESS", {"format": "CSV", "events_exported": 45}),
        ("INSTITUTION_SETTINGS_UPDATED", "INSTITUTION", "1", "SUCCESS", {"support_email": "helpdesk@apex.edu", "support_phone": "+91 11 2345 6789"}),
        ("FORMAT_TESTER_USED", "TOOL", "APAAR_TESTER", "SUCCESS", {"tested_input": "202601001234", "result": "VALID"}),
    ]

    for ev_idx, (act, tgt_type, tgt_id, outcome, details) in enumerate(audit_events):
        record_audit_log(
            db=db,
            action=act,
            target_type=tgt_type,
            target_id=tgt_id,
            outcome=outcome,
            details=details,
            institution_id=ait.id,
            user=users[1] if ev_idx % 2 == 0 else users[0],
            ip_address=f"192.168.1.{10 + (ev_idx % 20)}"
        )

    print("Seed data completed successfully!")

if __name__ == "__main__":
    reset_db()
    session = SessionLocal()
    try:
        seed_data(session)
    finally:
        session.close()
