from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict

class ValidationResultDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_id: str
    rule_name: str
    severity: str  # "error", "warning", "info"
    status: str    # "passed", "failed"
    message: str
    affected_field: Optional[str] = None
    suggested_action: Optional[str] = None
    rule_version: str = "1.0"
    timestamp: datetime = datetime.now(timezone.utc)

class BaseValidationRule(ABC):
    rule_id: str
    name: str
    severity: str
    rule_version: str = "1.0"

    @abstractmethod
    def evaluate(self, context: Dict[str, Any]) -> List[ValidationResultDTO]:
        """Evaluates rule against context and returns a list of ValidationResultDTO."""
        pass

