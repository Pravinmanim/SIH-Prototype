from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class OfficialVerificationService(ABC):
    """
    Abstract interface for official APAAR / DigiLocker / ABC API verification.
    Real official verification requires authorized credentials and digital signature.
    """
    @abstractmethod
    def verify_student_apaar(self, apaar_id: str, student_name: str, dob: Optional[str]) -> Dict[str, Any]:
        """
        Submits record to official verification authority.
        """
        pass

class StubOfficialVerificationService(OfficialVerificationService):
    """
    Stub implementation adhering strictly to project boundary:
    Never fake verification; always report honestly that official connection is unavailable.
    """
    def verify_student_apaar(self, apaar_id: str, student_name: str, dob: Optional[str]) -> Dict[str, Any]:
        return {
            "is_official": True,
            "status": "unavailable",
            "verified": False,
            "badge": "Official verification unavailable",
            "message": "Official verification unavailable. Local checks are not official verification.",
            "notice": "A valid 12-digit format does not prove the ID exists or belongs to the student.",
            "provider": "StubOfficialVerificationService"
        }

# Singleton instance
official_verification_service = StubOfficialVerificationService()

