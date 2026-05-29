from src.extractor import ExtractedRoleSchema
from src.config_loader import JobAppConfig

class ScoringMatrix:
    def __init__(self, config: JobAppConfig):
        self.config = config
        # Weight configurations summing up to 1.0
        self.weights = {
            "title_match": 0.25,
            "location_match": 0.20,
            "tech_stack_match": 0.25,
            "workplace_type_match": 0.15,
            "experience_match": 0.15
        }

    def evaluate(self, role: ExtractedRoleSchema) -> float:
        """
        Calculates a score between 0.0 and 5.0 representing candidate compatibility.
        """
        scores = {}

        # 1. Title Match
        title_lower = role.title.lower()
        # Ensure title does not hit blacklists
        for blacklisted in self.config.search_parameters.titleBlacklist:
            if blacklisted.lower() in title_lower:
                return 0.0  # Disqualify immediately
        
        title_score = 0.0
        for target_pos in self.config.search_parameters.positions:
            if target_pos.lower() in title_lower:
                title_score = 1.0
                break
        scores["title_match"] = title_score

        # 2. Location & Workplace Type Match
        loc_score = 0.0
        loc_lower = role.location.lower()
        for loc in self.config.search_parameters.locations:
            if loc.lower() in loc_lower or (loc.lower() == "remote" and role.workplace_type == "Remote"):
                loc_score = 1.0
                break
        scores["location_match"] = loc_score

        # Workplace types
        workplace_score = 0.0
        if role.workplace_type == "Remote" and self.config.search_parameters.remote:
            workplace_score = 1.0
        elif role.workplace_type == "Hybrid":
            workplace_score = 0.5
        elif role.workplace_type == "On-site":
            workplace_score = 0.2
        scores["workplace_type_match"] = workplace_score

        # 3. Tech Stack Match
        tech_score = 0.0
        cand_skills = getattr(self.config.search_parameters, "candidate_skills", [])
        if role.requirements:
            if cand_skills:
                # Calculate what fraction of job requirement skills the candidate possesses
                matched = [r for r in role.requirements if any(cs.lower() in r.lower() or r.lower() in cs.lower() for cs in cand_skills)]
                tech_score = len(matched) / len(role.requirements) if role.requirements else 1.0
            else:
                tech_score = 1.0
        scores["tech_stack_match"] = tech_score

        # 4. Experience Match
        exp_score = 1.0
        cand_exp = getattr(self.config.search_parameters, "candidate_experience_years", 0.0)
        if cand_exp is not None and cand_exp > 0.0 and role.experience_years is not None and role.experience_years > 0.0:
            if cand_exp >= role.experience_years:
                exp_score = 1.0
            else:
                exp_score = cand_exp / role.experience_years
        scores["experience_match"] = exp_score

        # Calculate final weighted score scaled out of 5.0
        total_score = 0.0
        for key, weight in self.weights.items():
            total_score += weight * scores.get(key, 0.0)

        return round(total_score * 5.0, 2)
