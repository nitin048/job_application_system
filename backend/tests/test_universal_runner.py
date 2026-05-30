import unittest
from unittest.mock import MagicMock, patch
from src.universal_runner import UniversalRunner

class TestUniversalRunner(unittest.TestCase):
    def setUp(self):
        self.username = "default_user@example.com"
        self.password = "default_password"
        self.resume_path = "data/Modified_Resume.pdf"
        self.runner = UniversalRunner(
            username=self.username,
            password=self.password,
            resume_path=self.resume_path,
            headed=True
        )

    def test_portal_detection_routing(self):
        # Mock the individual apply methods
        with patch.object(self.runner, '_apply_linkedin') as mock_li, \
             patch.object(self.runner, '_apply_naukri') as mock_na, \
             patch.object(self.runner, '_apply_indeed') as mock_ind, \
             patch.object(self.runner, '_apply_generic') as mock_gen:
            
            # LinkedIn routing
            self.runner.apply_to_job("https://www.linkedin.com/jobs/view/123", "Title", "Company", self.resume_path)
            mock_li.assert_called_once()
            
            # Naukri routing
            self.runner.apply_to_job("https://www.naukri.com/job-listings-abc", "Title", "Company", self.resume_path)
            mock_na.assert_called_once()

            # Indeed routing
            self.runner.apply_to_job("https://indeed.com/rc/clk?jk=123", "Title", "Company", self.resume_path)
            mock_ind.assert_called_once()

            # Generic fallback
            self.runner.apply_to_job("https://careers.google.com/jobs", "Title", "Company", self.resume_path)
            mock_gen.assert_called_once()

    def test_get_credentials_fallback(self):
        # When constants are not set, it should fallback to general/constructor credentials
        with patch('config.constants.LINKEDIN_USERNAME', "", create=True), \
             patch('config.constants.LINKEDIN_PASSWORD', "", create=True):
            u, p = self.runner._get_credentials("linkedin")
            self.assertEqual(u, self.username)
            self.assertEqual(p, self.password)

    def test_get_credentials_portal_specific(self):
        # When portal-specific constants are set, it should use them
        with patch('config.constants.LINKEDIN_USERNAME', "li_user@example.com", create=True), \
             patch('config.constants.LINKEDIN_PASSWORD', "li_pass", create=True):
            u, p = self.runner._get_credentials("linkedin")
            self.assertEqual(u, "li_user@example.com")
            self.assertEqual(p, "li_pass")

    def test_is_2fa_active_detection(self):
        # Create a mock page
        mock_page = MagicMock()
        mock_page.url = "https://www.linkedin.com/checkpoint/challenge/submit"
        
        # URL checkpoint trigger
        self.assertTrue(self.runner._is_2fa_active(mock_page, "linkedin"))

        # Body text trigger
        mock_page.url = "https://www.linkedin.com/login-submit"
        mock_page.locator("body").inner_text.return_value = "Please enter the verification code sent to your phone"
        self.assertTrue(self.runner._is_2fa_active(mock_page, "linkedin"))

        # Input field selector trigger
        mock_page.locator("body").inner_text.return_value = "Nothing suspicious here"
        mock_page.locator("input#input-code").count.return_value = 1
        self.assertTrue(self.runner._is_2fa_active(mock_page, "linkedin"))

        # Captcha iframe src trigger
        mock_page.locator("input#input-code").count.return_value = 0
        mock_iframe = MagicMock()
        mock_iframe.get_attribute.return_value = "https://example.com/challenge/hcaptcha/index.html"
        mock_page.locator("iframe").all.return_value = [mock_iframe]
        self.assertTrue(self.runner._is_2fa_active(mock_page, "linkedin"))

        # No 2FA trigger
        mock_page.locator("iframe").all.return_value = []
        self.assertFalse(self.runner._is_2fa_active(mock_page, "linkedin"))

    def test_log_callback(self):
        callback_msgs = []
        def my_callback(msg):
            callback_msgs.append(msg)
            
        runner_with_callback = UniversalRunner(
            username=self.username,
            password=self.password,
            resume_path=self.resume_path,
            headed=True,
            log_callback=my_callback
        )
        
        # Test that calling logger.info calls the callback
        import src.universal_runner as ur
        ur.logger.info("Test message for log callback")
        self.assertIn("Test message for log callback", callback_msgs)

    def test_obf_credentials_deobfuscation(self):
        # OBF:: prefixed password should be deobfuscated
        # btoa('my_secret_password') -> 'bXlfc2VjcmV0X3Bhc3N3b3Jk'
        obf_password = "OBF::bXlfc2VjcmV0X3Bhc3N3b3Jk"
        
        with patch('config.constants.LINKEDIN_USERNAME', "li_user", create=True), \
             patch('config.constants.LINKEDIN_PASSWORD', obf_password, create=True):
            u, p = self.runner._get_credentials("linkedin")
            self.assertEqual(u, "li_user")
            self.assertEqual(p, "my_secret_password")
