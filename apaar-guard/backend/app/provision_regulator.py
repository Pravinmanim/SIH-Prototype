"""
Safe User Provisioning Utility for Regulator Role.
Enables administrators to provision or update regulator accounts via secure CLI.

Usage:
    python -m app.provision_regulator --email regulator@aicte.gov.in --name "Dr. Rajesh Kumar" --password <secret>
"""
import argparse
import sys
from app.core.database import SessionLocal
from app.models.user import User
from app.models.institution import Institution
from app.core.security import hash_password

def provision_regulator(email: str, full_name: str, password: str) -> User:
    email_clean = email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise ValueError("A valid email address is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    db = SessionLocal()
    try:
        inst1 = db.query(Institution).first()
        inst_id = inst1.id if inst1 else 1

        existing = db.query(User).filter(User.email == email_clean).first()
        if existing:
            existing.full_name = full_name
            existing.hashed_password = hash_password(password)
            existing.role = "regulator"
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            print(f"Successfully updated user {email_clean} with role 'regulator'.")
            return existing
        else:
            new_user = User(
                email=email_clean,
                full_name=full_name,
                hashed_password=hash_password(password),
                role="regulator",
                institution_id=inst_id,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"Successfully provisioned new regulator account: {email_clean} (ID: {new_user.id})")
            return new_user
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision a regulator account.")
    parser.add_argument("--email", required=True, help="Regulator's government/institutional email")
    parser.add_argument("--name", required=True, help="Full name of regulatory officer")
    parser.add_argument("--password", required=True, help="Secure password (min 8 characters)")
    args = parser.parse_args()

    try:
        provision_regulator(args.email, args.name, args.password)
    except Exception as e:
        print(f"Provisioning error: {e}", file=sys.stderr)
        sys.exit(1)

