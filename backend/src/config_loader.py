import os
import yaml
import contextvars
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr

session_config_var = contextvars.ContextVar("session_config_var", default=None)

class SearchParameters(BaseModel):
    positions: list[str]
    locations: list[str]
    distance: int | None = 50
    remote: bool = True
    jobTypes: dict[str, bool] = Field(default_factory=dict)
    experienceLevel: dict[str, bool] = Field(default_factory=dict)
    date_range: dict[str, bool] = Field(default_factory=dict)
    apply_once_at_company: bool = True
    companyBlacklist: list[str] = Field(default_factory=list)
    titleBlacklist: list[str] = Field(default_factory=list)
    candidate_experience_years: float | None = 0.0
    candidate_skills: list[str] = Field(default_factory=list)
    target_portals: dict[str, bool] = Field(default_factory=lambda: {"naukri": True, "linkedin": True, "indeed": True})

class PersonalDetails(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr | str  # Fallback to str if using mocked local email domains
    phone: str

class Demographics(BaseModel):
    gender: str
    pronouns: str
    veteran_status: str
    disability_status: str
    ethnicity: str

class CandidateIdentity(BaseModel):
    personal_details: PersonalDetails
    demographics: Demographics

class CompliancePreferences(BaseModel):
    remote_work: str
    in_person_work: str
    open_to_relocation: str
    relocation_destinations: str = ""
    willing_to_complete_assessments: str
    willing_to_undergo_drug_tests: str
    willing_to_undergo_background_checks: str

class JobAppConfig(BaseModel):
    search_parameters: SearchParameters
    candidate_identity: CandidateIdentity
    compliance_preferences: CompliancePreferences

def load_config(config_path: str | Path) -> JobAppConfig:
    # 1. First, check if there is an active session config ContextVar
    current_config = session_config_var.get()
    if current_config and "searches" in current_config:
        return JobAppConfig(**current_config["searches"])

    # 2. Second, check if a temporary session config JSON path is specified via environment variable
    session_config_path = os.getenv("AEGIS_SESSION_CONFIG_PATH")
    if session_config_path and os.path.exists(session_config_path):
        try:
            with open(session_config_path, "r", encoding="utf-8") as f:
                import json
                file_config = json.load(f)
                if "searches" in file_config:
                    return JobAppConfig(**file_config["searches"])
        except Exception:
            pass

    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return JobAppConfig(**data)
