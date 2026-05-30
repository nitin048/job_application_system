import sys
import unittest
import hashlib
from pathlib import Path

# Add src to the path
sys.path.append(str(Path(__file__).parent.parent))

from src.config_loader import load_config
from src.discovery import normalize_url, DiscoveryEngine
from src.extractor import ExtractedRoleSchema, CascadingExtractor
from src.scoring import ScoringMatrix
from src.form_graph import FormGraphOrchestrator
from src.document_generator import DocumentGenerator
from src.resume_tweaker import ResumeTweaker
from pypdf import PdfReader


class TestJobApplicationSystem(unittest.TestCase):
    def setUp(self):
        self.config_path = Path(__file__).parent.parent / "config" / "searches.yaml"
        self.config = load_config(self.config_path)

    def test_config_loader(self):
        self.assertEqual(self.config.candidate_identity.personal_details.first_name, "Nitin")
        self.assertIn("Software Engineer", self.config.search_parameters.positions)

    def test_config_optional_fields(self):
        from src.config_loader import SearchParameters
        params = SearchParameters(
            positions=["Software Engineer"],
            locations=["London"],
            distance=None,
            candidate_experience_years=None
        )
        self.assertIsNone(params.distance)
        self.assertIsNone(params.candidate_experience_years)

    def test_url_normalization(self):
        dirty_url = "https://www.linkedin.com/jobs/view/12345?refId=abc&trackingId=xyz&jk=12345"
        clean_url = normalize_url(dirty_url)
        # Verify specific URL identifier parameters remain but tracking is discarded
        self.assertIn("jk=12345", clean_url)
        self.assertNotIn("refId", clean_url)

    def test_deduplication(self):
        engine = DiscoveryEngine(self.config.search_parameters)
        raw = [
            {"title": "SE", "url": "https://domain.com/job?id=1"},
            {"title": "SE Duplicate", "url": "https://domain.com/job?id=1&tracking=true"},
            {"title": "Different Job", "url": "https://domain.com/job?id=2"}
        ]
        results = engine.deduplicate_and_load(raw)
        self.assertEqual(len(results), 2)

    def test_scoring_matrix(self):
        matrix = ScoringMatrix(self.config)
        role = ExtractedRoleSchema(
            title="Senior Software Engineer",
            location="Pune",
            workplace_type="Remote",
            requirements=["React", "TypeScript"],
            experience_years=5.0
        )
        score = matrix.evaluate(role)
        # Should qualify based on the matching parameters
        self.assertGreaterEqual(score, 3.5)

    def test_form_filling_graph(self):
        orchestrator = FormGraphOrchestrator(self.config)
        mock_dom = [
            {"id": "first_name_input", "label": "First Name", "type": "text"},
            {"id": "email_input", "label": "Email address", "type": "text"},
            {"id": "gender_select", "label": "Select Gender", "type": "select", "options": ["Male", "Female", "Non-binary", "Declined to State"]}
        ]
        
        state = orchestrator.run("https://example.com/apply", mock_dom)
        self.assertEqual(state.assembled_payload["first_name_input"], "Nitin")
        self.assertEqual(state.assembled_payload["email_input"], "nitinpradhan48@gmail.com")
        self.assertEqual(state.assembled_payload["gender_select"], "Male")
        self.assertFalse(state.errors)

    def test_pdf_hash_modification(self):
        pdf_path = Path(__file__).parent.parent / "data" / "test_resume.pdf"
        doc = DocumentGenerator("", str(pdf_path))
        doc.compile_pdf("Alex", "Morgan", "alex@domain.local", "+447111111111")
        
        with open(pdf_path, "rb") as f:
            orig_hash = hashlib.sha256(f.read()).hexdigest()
            
        doc.regenerate_with_hash_modifier()
        
        with open(pdf_path, "rb") as f:
            new_hash = hashlib.sha256(f.read()).hexdigest()
            
        self.assertNotEqual(orig_hash, new_hash)
        
        # Clean up
        if pdf_path.exists():
            pdf_path.unlink()

    def test_resume_tweaker_fallback(self):
        tweaker = ResumeTweaker(self.config)
        out_path = Path(__file__).parent.parent / "data" / "test_modified_resume.pdf"
        
        # Override the MODIFIED_RESUME_PATH and GEMINI_API_KEY temporarily to test
        import config.constants as consts
        orig_mod_path = consts.MODIFIED_RESUME_PATH
        orig_gemini_key = consts.GEMINI_API_KEY
        
        consts.MODIFIED_RESUME_PATH = str(out_path)
        consts.GEMINI_API_KEY = "" # Force fallback mode
        
        try:
            res_path = tweaker.tailor_resume(
                job_title="Python AWS Full Stack Engineer",
                job_company="Test Company",
                job_desc="We are looking for a developer with experience in Python and AWS Lambda, Step Functions, S3."
            )
            self.assertTrue(Path(res_path).exists())
            
            # Verify text was written
            reader = PdfReader(res_path)
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text()
                
            self.assertIn("Willing to relocate", full_text)
            self.assertIn("Python", full_text)
            self.assertIn("AWS Lambda", full_text)
        finally:
            consts.MODIFIED_RESUME_PATH = orig_mod_path
            consts.GEMINI_API_KEY = orig_gemini_key
            if out_path.exists():
                out_path.unlink()

    def test_gdrive_manager_upload(self):
        from unittest.mock import MagicMock, patch
        from src.gdrive_manager import GoogleDriveManager
        
        manager = GoogleDriveManager(
            client_secrets_path="config/credentials.json",
            token_path="data/token.json",
            config=self.config
        )
        
        mock_service = MagicMock()
        manager.service = mock_service
        
        mock_service.files.return_value.list.return_value.execute.side_effect = [
            {"files": [{"id": "root_resume_id", "name": "_resume"}]},
            {"files": [{"id": "company_resume_id", "name": "test_company_resume"}]},
            {"files": [{"name": "Nitin_Pradhan_Resume.pdf"}]}
        ]
        
        mock_service.files.return_value.create.return_value.execute.return_value = {
            "id": "new_uploaded_file_id",
            "webViewLink": "https://drive.google.com/mock-link"
        }
        
        with patch('src.gdrive_manager.MediaFileUpload') as mock_media:
            link, file_id = manager.upload_tailored_resume("Test Company", "/path/to/resume.pdf")
            self.assertEqual(link, "https://drive.google.com/mock-link")
            self.assertEqual(file_id, "new_uploaded_file_id")
            
            mock_service.files.return_value.create.assert_called_once()
            call_kwargs = mock_service.files.return_value.create.call_args[1]
            self.assertEqual(call_kwargs['body']['name'], "Nitin_Pradhan_Resume_v2.pdf")
            self.assertEqual(call_kwargs['body']['parents'], ["company_resume_id"])

    def test_server_endpoints(self):
        from src.server import get_original_resume, get_tailored_data
        import src.server as server
        
        # Test original resume endpoint
        data = get_original_resume()
        self.assertEqual(data["name"], "NITIN PRADHAN")
        
        # Test tailored data endpoint with a mock job
        mock_job = {
            "id": "test_endpoint_job",
            "title": "React .NET Engineer",
            "company": "Endpoint Company",
            "description": "Must know React and .NET Core.",
            "url": "https://naukri.com/mock-job-id"
        }
        server.jobs_cache = [mock_job]
        
        tailored_data = get_tailored_data("test_endpoint_job")
        self.assertEqual(tailored_data["name"], "NITIN PRADHAN")
        self.assertIn("React", tailored_data["skills"]["Languages & Frameworks"])

    def test_ensure_tailored_resume_locally(self):
        from src.server import _ensure_tailored_resume_locally
        import src.server as server
        from unittest.mock import patch, MagicMock
        
        # Test case 1: tailored resume exists locally
        test_path = Path(__file__).parent.parent / "data" / "test_exist.pdf"
        test_path.parent.mkdir(parents=True, exist_ok=True)
        test_path.touch()
        try:
            path = _ensure_tailored_resume_locally({}, str(test_path))
            self.assertEqual(path, str(test_path))
        finally:
            if test_path.exists():
                test_path.unlink()
                
        # Test case 2: file does not exist locally but can download from Google Drive
        mock_job = {
            "id": "gdrive_job",
            "gdrive_file_id": "mock_file_123",
            "title": "React Engineer",
            "company": "GDrive Company",
            "description": "React"
        }
        
        # Mock GoogleDriveManager and download_file success
        with patch("src.server.get_gdrive_config") as mock_gdrive_config, \
             patch("src.server.GoogleDriveManager") as mock_gdrive_class:
            mock_gdrive_config.return_value = (True, "secrets.json", "token.json")
            mock_manager = MagicMock()
            mock_manager.download_file.return_value = True
            mock_gdrive_class.return_value = mock_manager
            
            non_exist_path = Path(__file__).parent.parent / "data" / "test_download.pdf"
            if non_exist_path.exists():
                non_exist_path.unlink()
                
            path = _ensure_tailored_resume_locally(mock_job, str(non_exist_path))
            self.assertEqual(path, str(non_exist_path))
            mock_manager.download_file.assert_called_once_with("mock_file_123", str(non_exist_path))

    def test_parallel_scan(self):
        from unittest.mock import patch
        from src.job_crawler import JobCrawler
        
        crawler = JobCrawler(self.config)
        
        # Override positions and locations to have multiple configurations
        self.config.search_parameters.positions = ["Software Engineer", "Full Stack Developer"]
        self.config.search_parameters.locations = ["Pune", "Remote"]
        
        mock_listings = {
            ("Software Engineer", "Pune"): [
                {"id": "n1", "title": "Software Engineer", "company": "Company A", "location": "Pune", "description": "**About the Role**: Looking for React, C#, AWS skills.", "is_easy_apply": True, "url": "https://naukri.com/1"}
            ],
            ("Software Engineer", "Remote"): [
                {"id": "n2", "title": "Software Engineer", "company": "Company B", "location": "Remote", "description": "**About the Role**: Need React and .NET Core developer.", "is_easy_apply": True, "url": "https://naukri.com/2"}
            ],
            ("Full Stack Developer", "Pune"): [
                {"id": "n3", "title": "Full Stack Developer", "company": "Company C", "location": "Pune", "description": "**About the Role**: AWS, TypeScript, React and microservices developer.", "is_easy_apply": False, "url": "https://naukri.com/3"}
            ],
            ("Full Stack Developer", "Remote"): [
                {"id": "n4", "title": "Full Stack Developer", "company": "Company D", "location": "Remote", "description": "**About the Role**: Looking for Python, react developer.", "is_easy_apply": True, "url": "https://naukri.com/4"}
            ]
        }
        
        def mock_fetch(*args, **kwargs):
            if len(args) >= 1 and isinstance(args[0], JobCrawler):
                pos = args[1]
                loc = args[2]
                cache = args[3] if len(args) > 3 else kwargs.get("cache")
                on_job_found_cb = args[4] if len(args) > 4 else kwargs.get("on_job_found_cb")
            else:
                pos = args[0]
                loc = args[1]
                cache = args[2] if len(args) > 2 else kwargs.get("cache")
                on_job_found_cb = args[3] if len(args) > 3 else kwargs.get("on_job_found_cb")
                
            raw_results = mock_listings.get((pos, loc), [])
            scored_results = []
            for raw in raw_results:
                scored = crawler._process_and_score_listing(raw)
                if scored:
                    scored_results.append(scored)
                    if on_job_found_cb:
                        on_job_found_cb(scored)
            return scored_results
            
        with patch.object(JobCrawler, "_fetch_naukri_listings", side_effect=mock_fetch) as mock_fetch_listings:
            results = crawler.scan_jobs()
            
            # Assert all 4 queries were executed
            self.assertEqual(mock_fetch_listings.call_count, 4)
            
            # Verify results are returned and populated
            self.assertTrue(len(results) > 0)
            
            companies = [r["company"] for r in results]
            self.assertIn("Company A", companies)
            self.assertIn("Company B", companies)
            self.assertIn("Company C", companies)
            self.assertIn("Company D", companies)

if __name__ == "__main__":
    unittest.main()
