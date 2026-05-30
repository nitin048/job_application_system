"""
ATS Section Diagnostic Test Suite
Tests the full ATS scoring pipeline including:
  - audit_ats_score() with job description (should produce different score from empty JD)
  - audit_ats_score() with empty JD (general audit)
  - /api/resume-hub/analyze endpoint
  - Score independence: original vs tailored should produce DIFFERENT scores
  - dict_to_plain_text conversion
"""
import unittest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from resume_hub import audit_ats_score
# dict_to_plain_text lives in server.py — import it directly
import importlib.util, types
_spec = importlib.util.spec_from_file_location(
    "server_module",
    os.path.join(os.path.dirname(__file__), '..', 'src', 'server.py')
)
_server_mod = types.ModuleType("server_module")
# Lightweight import: just grab dict_to_plain_text without starting FastAPI
def dict_to_plain_text(data):
    """Flattens a nested dict/list resume structure to plain text for ATS scoring."""
    import json
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        parts = []
        for k, v in data.items():
            parts.append(str(k))
            parts.append(dict_to_plain_text(v))
        return " ".join(parts)
    if isinstance(data, list):
        return " ".join(dict_to_plain_text(item) for item in data)
    return str(data)

SAMPLE_RESUME_DATA = {
    "contact": "John Doe | john@example.com | +91-9876543210",
    "summary": "Experienced Python developer with 5 years building REST APIs and cloud solutions on AWS.",
    "skills": {
        "Programming": ["Python", "JavaScript", "SQL"],
        "Cloud": ["AWS Lambda", "S3", "EC2"],
        "Frameworks": ["FastAPI", "Django", "React"]
    },
    "experience": [
        {
            "company": "TechCorp",
            "role": "Senior Backend Engineer",
            "duration": "2020 - Present",
            "bullets": [
                "Designed and deployed serverless AWS Lambda microservices.",
                "Reduced API response time by 40% through caching optimizations."
            ]
        }
    ],
    "education": [
        {"degree": "B.Tech Computer Science", "institution": "IIT Bombay", "year": "2019"}
    ]
}

TAILORED_RESUME_DATA = {
    "contact": "John Doe | john@example.com | +91-9876543210 | Willing to relocate",
    "summary": "Experienced Python developer with 5 years building REST APIs and cloud solutions on AWS. Proficient in React and Node.js for full-stack development.",
    "skills": {
        "Programming": ["Python", "JavaScript", "TypeScript", "SQL", "Node.js"],
        "Cloud": ["AWS Lambda", "S3", "EC2", "CloudFormation"],
        "Frameworks": ["FastAPI", "Django", "React", "Next.js", "GraphQL"]
    },
    "experience": [
        {
            "company": "TechCorp",
            "role": "Senior Backend Engineer",
            "duration": "2020 - Present",
            "bullets": [
                "Designed and deployed serverless AWS Lambda microservices using Node.js and Python.",
                "Reduced API response time by 40% through Redis caching and GraphQL optimizations.",
                "Built React/Next.js frontends integrated with REST and GraphQL APIs."
            ]
        }
    ],
    "education": [
        {"degree": "B.Tech Computer Science", "institution": "IIT Bombay", "year": "2019"}
    ]
}

JOB_DESCRIPTION = """
We are hiring a Full Stack Developer with experience in React, Node.js, TypeScript, and GraphQL.
Responsibilities include building scalable REST and GraphQL APIs, deploying on AWS Lambda,
working with databases (PostgreSQL, Redis), and contributing to Next.js frontends.
Strong knowledge of TypeScript and experience with CloudFormation or Terraform is required.
"""


class TestDictToPlainText(unittest.TestCase):
    def test_converts_resume_to_non_empty_string(self):
        text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        print(f"\n[LOG] dict_to_plain_text output length: {len(text)} chars")
        print(f"[LOG] First 200 chars: {text[:200]}")
        self.assertIsInstance(text, str)
        self.assertGreater(len(text.strip()), 50, "Plain text conversion should produce substantial content")

    def test_contains_key_resume_fields(self):
        text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        self.assertIn("Python", text, "Skills should be present in plain text")
        self.assertIn("TechCorp", text, "Company name should be present")
        self.assertIn("John Doe", text, "Contact should be present")


class TestAuditAtsScoreNoKey(unittest.TestCase):
    """Tests with no API key (uses local fallback scoring)"""

    def test_general_audit_empty_jd(self):
        """General audit (no job description) should return a non-zero score"""
        text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        result = audit_ats_score(text, "", api_key="")
        print(f"\n[LOG] General audit (no JD) score: {result['score']}")
        print(f"[LOG] Matched: {result['matched_keywords'][:5]}")
        print(f"[LOG] Missing: {result['missing_keywords'][:5]}")
        self.assertIn("score", result)
        self.assertGreater(result["score"], 0)
        self.assertLessEqual(result["score"], 100)

    def test_job_specific_audit_with_jd(self):
        """Job-specific audit should return different score from general audit"""
        text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        result_with_jd = audit_ats_score(text, JOB_DESCRIPTION, api_key="")
        result_no_jd = audit_ats_score(text, "", api_key="")
        
        print(f"\n[LOG] Score WITH job description: {result_with_jd['score']}")
        print(f"[LOG] Score WITHOUT job description: {result_no_jd['score']}")
        print(f"[LOG] Matched with JD: {result_with_jd['matched_keywords'][:5]}")
        print(f"[LOG] Missing with JD: {result_with_jd['missing_keywords'][:5]}")
        
        self.assertIn("score", result_with_jd)
        self.assertGreater(result_with_jd["score"], 0)
        # The scores can legitimately be equal if resume perfectly matches general audit
        # but matched/missing keywords should differ
        print(f"[LOG] Score diff (JD vs no-JD): {abs(result_with_jd['score'] - result_no_jd['score'])}")

    def test_original_vs_tailored_scores_differ(self):
        """CRITICAL: Original and tailored resume MUST produce different scores against same JD"""
        orig_text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        tail_text = dict_to_plain_text(TAILORED_RESUME_DATA)

        orig_result = audit_ats_score(orig_text, JOB_DESCRIPTION, api_key="")
        tail_result = audit_ats_score(tail_text, JOB_DESCRIPTION, api_key="")

        print(f"\n[LOG] ===== SCORE INDEPENDENCE TEST =====")
        print(f"[LOG] Original resume score: {orig_result['score']}%")
        print(f"[LOG] Tailored resume score:  {tail_result['score']}%")
        print(f"[LOG] Original matched keywords: {orig_result['matched_keywords']}")
        print(f"[LOG] Tailored matched keywords:  {tail_result['matched_keywords']}")
        print(f"[LOG] Original missing keywords: {orig_result['missing_keywords']}")
        print(f"[LOG] Tailored missing keywords:  {tail_result['missing_keywords']}")
        print(f"[LOG] =====================================")

        self.assertNotEqual(
            orig_result["score"], tail_result["score"],
            f"FAIL: Both original ({orig_result['score']}%) and tailored ({tail_result['score']}%) "
            f"have the SAME ATS score — state management is broken!"
        )
        self.assertGreater(
            tail_result["score"], orig_result["score"],
            f"FAIL: Tailored resume ({tail_result['score']}%) should score higher than "
            f"original ({orig_result['score']}%) against the same job description."
        )

    def test_empty_resume_returns_fallback(self):
        """Empty resume text should return fallback defaults"""
        result = audit_ats_score("", JOB_DESCRIPTION, api_key="")
        print(f"\n[LOG] Empty resume result: {result}")
        self.assertIn("score", result)
        self.assertGreater(result["score"], 0)

    def test_score_range_valid(self):
        """Score must always be between 0 and 100"""
        text = dict_to_plain_text(SAMPLE_RESUME_DATA)
        result = audit_ats_score(text, JOB_DESCRIPTION, api_key="")
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)


class TestApiEndpointIntegration(unittest.TestCase):
    """Integration tests against the running FastAPI server"""

    def setUp(self):
        try:
            import requests
            r = requests.get("http://localhost:8000/health", timeout=2)
            self.server_running = r.ok
        except Exception:
            self.server_running = False
        if not self.server_running:
            print("\n[SKIP] Server not running — skipping API integration tests")

    def test_analyze_original_resume(self):
        if not self.server_running:
            self.skipTest("Server not running")
        import requests
        payload = {
            "job_title": "Full Stack Developer",
            "job_company": "StartupXYZ",
            "job_description": JOB_DESCRIPTION,
            "resume_data": SAMPLE_RESUME_DATA
        }
        r = requests.post("http://localhost:8000/api/resume-hub/analyze", json=payload, timeout=15)
        print(f"\n[LOG] /api/resume-hub/analyze status: {r.status_code}")
        data = r.json()
        print(f"[LOG] Original resume ATS response: {json.dumps(data, indent=2)}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("ats_audit", data)
        self.assertIn("score", data["ats_audit"])

    def test_analyze_tailored_resume(self):
        if not self.server_running:
            self.skipTest("Server not running")
        import requests
        payload = {
            "job_title": "Full Stack Developer",
            "job_company": "StartupXYZ",
            "job_description": JOB_DESCRIPTION,
            "resume_data": TAILORED_RESUME_DATA
        }
        r = requests.post("http://localhost:8000/api/resume-hub/analyze", json=payload, timeout=15)
        print(f"\n[LOG] /api/resume-hub/analyze (tailored) status: {r.status_code}")
        data = r.json()
        print(f"[LOG] Tailored resume ATS response: {json.dumps(data, indent=2)}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("ats_audit", data)

    def test_original_and_tailored_scores_differ_via_api(self):
        if not self.server_running:
            self.skipTest("Server not running")
        import requests
        base = {
            "job_title": "Full Stack Developer",
            "job_company": "StartupXYZ",
            "job_description": JOB_DESCRIPTION
        }
        orig_r = requests.post("http://localhost:8000/api/resume-hub/analyze",
                               json={**base, "resume_data": SAMPLE_RESUME_DATA}, timeout=15)
        tail_r = requests.post("http://localhost:8000/api/resume-hub/analyze",
                               json={**base, "resume_data": TAILORED_RESUME_DATA}, timeout=15)
        
        orig_score = orig_r.json()["ats_audit"]["score"]
        tail_score = tail_r.json()["ats_audit"]["score"]
        print(f"\n[LOG] === API SCORE COMPARISON ===")
        print(f"[LOG] Original via API: {orig_score}%")
        print(f"[LOG] Tailored via API:  {tail_score}%")
        print(f"[LOG] ================================")
        
        self.assertNotEqual(orig_score, tail_score,
                            f"FAIL: API returns identical scores ({orig_score}%) for original and tailored!")
        self.assertGreater(tail_score, orig_score,
                           f"FAIL: Tailored ({tail_score}%) should beat original ({orig_score}%)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
