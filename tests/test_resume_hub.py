import unittest
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.resume_hub import (
    is_valid_job_portal,
    extract_text_from_docx,
    extract_text_from_pdf,
    parse_and_structure_resume,
    audit_ats_score,
    generate_ats_friendly_pdf,
    send_resume_via_email
)

class TestResumeHub(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def test_job_portal_validation(self):
        self.assertTrue(is_valid_job_portal("https://www.naukri.com/job-listings-python-developer"))
        self.assertTrue(is_valid_job_portal("https://www.linkedin.com/jobs/view/12345"))
        self.assertTrue(is_valid_job_portal("https://indeed.com/viewjob?jk=54321"))
        self.assertTrue(is_valid_job_portal("https://careers.google.com/jobs/results/12345"))
        self.assertTrue(is_valid_job_portal("https://jobs.lever.co/company/abc"))
        self.assertTrue(is_valid_job_portal("https://company.myworkdayjobs.com/en-US/careers/job/123"))
        self.assertFalse(is_valid_job_portal("https://google.com"))
        self.assertFalse(is_valid_job_portal("https://github.com"))
        
    def test_docx_extraction_native(self):
        # Create a mock zip-based docx file
        docx_path = os.path.join(self.temp_dir, "test.docx")
        with zipfile.ZipFile(docx_path, 'w') as docx:
            xml_content = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                <w:body>
                    <w:p><w:r><w:t>Nitin Pradhan</w:t></w:r></w:p>
                    <w:p><w:r><w:t>Full Stack Engineer</w:t></w:r></w:p>
                </w:body>
            </w:document>
            """
            docx.writestr('word/document.xml', xml_content)
            
        extracted = extract_text_from_docx(docx_path)
        self.assertIn("Nitin Pradhan", extracted)
        self.assertIn("Full Stack Engineer", extracted)
        
    def test_pdf_extraction_non_existent(self):
        # Non-existent file should safely return empty string
        self.assertEqual(extract_text_from_pdf("nonexistent.pdf"), "")
        
    def test_resume_structuring_fallback(self):
        # Structuring without an API key should fallback gracefully
        raw_text = "Nitin Pradhan\nSenior Full Stack Engineer\nLocation | Phone | Email"
        structured = parse_and_structure_resume(raw_text, "")
        self.assertEqual(structured["name"], "Nitin Pradhan")
        self.assertEqual(structured["title"], "Senior Full Stack Engineer")
        
    def test_ats_scoring_baseline(self):
        resume_text = "Experienced React developer proficient in C# and .NET Core microservices."
        job_desc = "Looking for a React developer with expertise in .NET Core microservices."
        audit = audit_ats_score(resume_text, job_desc, "")
        self.assertGreaterEqual(audit["score"], 30)
        self.assertIn("react", audit["matched_keywords"])
        self.assertIn("recommendations", audit)
        
    @patch('smtplib.SMTP')
    def test_smtp_email_send(self, mock_smtp):
        # Setup mock smtplib Server
        instance = mock_smtp.return_value
        
        # Create a dummy attachment file
        dummy_attachment = os.path.join(self.temp_dir, "tailored_copy.pdf")
        with open(dummy_attachment, "w") as f:
            f.write("%PDF-1.4 dummy contents")
            
        result = send_resume_via_email(
            to_email="recipients@company.com",
            subject="ATS Optimized Resume",
            body="Hello, please see attached.",
            attachment_path=dummy_attachment,
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="sender@gmail.com",
            smtp_pass="app_password"
        )
        
        self.assertTrue(result["success"])
        self.assertTrue(instance.login.called)
        self.assertTrue(instance.sendmail.called)

    def test_tailor_resume_with_custom_data(self):
        from src.resume_tweaker import ResumeTweaker
        tweaker = ResumeTweaker(config={})
        custom_data = {
            "name": "Custom Candidate Name",
            "contact": "Custom Contact Details",
            "title": "Custom Job Title",
            "summary": "Custom Career Summary",
            "skills": {
                "Languages & Frameworks": "React, Python",
                "Cloud & Architecture": "AWS, REST",
                "Databases": "SQL, NoSQL",
                "Testing & CI/CD": "xUnit, Git",
                "Tools & Monitoring": "VS Code, Splunk",
                "Methodologies": "Agile, SOLID"
            },
            "experience": [
                {
                    "company": "Custom Company",
                    "role": "Custom Role",
                    "dates": "Custom Dates",
                    "location": "Custom Location",
                    "bullets": ["Custom bullet point"]
                }
            ],
            "education": []
        }
        
        # Call tailor_resume passing custom_data
        with patch.object(tweaker, 'generate_pdf_from_json') as mock_gen, \
             patch('src.document_generator.DocumentGenerator') as mock_dg:
            res_path = tweaker.tailor_resume(
                job_title="Custom Target Title",
                job_company="Custom Target Company",
                job_desc="We need custom skills and AWS.",
                resume_data=custom_data
            )
            self.assertIsNotNone(res_path)
            self.assertEqual(tweaker.last_tailored_data["name"], "Custom Candidate Name")

