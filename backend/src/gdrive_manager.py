import os
import re
import logging
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from src.config_loader import JobAppConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scopes required to manage only the files created by this app
SCOPES = ['https://www.googleapis.com/auth/drive.file']

class GoogleDriveManager:
    def __init__(self, client_secrets_path: str = None, token_path: str = None, config: JobAppConfig = None,
                 client_secrets_content: str | dict = None, token_content: str | dict = None, on_token_change = None):
        self.client_secrets_path = client_secrets_path
        self.token_path = token_path
        self.config = config
        self.client_secrets_content = client_secrets_content
        self.token_content = token_content
        self.on_token_change = on_token_change
        self.creds = None
        self.service = None

    def load_credentials(self) -> bool:
        """
        Loads saved user credentials from token_content or the local token.json file.
        Returns True if credentials are valid (or successfully refreshed), False otherwise.
        """
        import json
        self.creds = None

        # 1. Try loading from token_content (dict or json string) first
        if self.token_content:
            try:
                token_data = self.token_content
                if isinstance(token_data, str):
                    token_data = json.loads(token_data)
                self.creds = Credentials.from_authorized_user_info(token_data, SCOPES)
            except Exception as e:
                logger.warning(f"Failed to parse token_content: {e}")
                self.creds = None

        # 2. Fallback to physical token file
        if not self.creds and self.token_path and os.path.exists(self.token_path):
            try:
                self.creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
            except Exception as e:
                logger.warning(f"Failed to parse token file: {e}")
                self.creds = None
        
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    logger.info("Google Drive token expired. Attempting refresh...")
                    self.creds.refresh(Request())
                    
                    token_json_str = self.creds.to_json()
                    
                    # Callback to update config in MongoDB
                    if self.on_token_change:
                        try:
                            self.on_token_change(token_json_str)
                        except Exception as cb_err:
                            logger.error(f"Failed on_token_change callback: {cb_err}")

                    # Update local file for backward compatibility if path exists
                    if self.token_path:
                        try:
                            os.makedirs(os.path.dirname(self.token_path), exist_ok=True)
                            with open(self.token_path, 'w', encoding='utf-8') as token:
                                token.write(token_json_str)
                        except Exception as f_err:
                            logger.warning(f"Could not write refreshed token back to file: {f_err}")
                            
                    return True
                except Exception as e:
                    logger.error(f"Failed to refresh Google Drive token: {e}")
                    return False
            return False
        return True

    def authenticate_local(self, url_callback=None) -> bool:
        """
        Launches the local desktop Google OAuth authentication flow.
        Optionally uses url_callback to pass the authorization URL back to the caller.
        Saves the resulting authentication tokens.
        """
        import json
        import wsgiref.simple_server
        import webbrowser
        from google_auth_oauthlib.flow import _RedirectWSGIApp, _WSGIRequestHandler
        from google_auth_oauthlib.flow import WSGITimeoutError

        if not self.client_secrets_content and (not self.client_secrets_path or not os.path.exists(self.client_secrets_path)):
            raise FileNotFoundError("Google Client Secrets credentials not found.")
            
        logger.info("Initializing Google Drive OAuth flow server...")
        if self.client_secrets_content:
            client_config = self.client_secrets_content
            if isinstance(client_config, str):
                client_config = json.loads(client_config)
            flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
        else:
            flow = InstalledAppFlow.from_client_secrets_file(self.client_secrets_path, SCOPES)
        
        # Setup WSGI app and server
        success_message = "Google Drive Authentication completed successfully! You can close this tab and return to the application dashboard."
        wsgi_app = _RedirectWSGIApp(success_message)
        wsgiref.simple_server.WSGIServer.allow_reuse_address = False
        local_server = wsgiref.simple_server.make_server(
            "localhost", 0, wsgi_app, handler_class=_WSGIRequestHandler
        )
        
        try:
            flow.redirect_uri = f"http://localhost:{local_server.server_port}/"
            auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
            
            # Expose the URL to the caller (e.g. FastAPI API)
            if url_callback:
                try:
                    url_callback(auth_url)
                except Exception as cb_err:
                    logger.error(f"Callback error: {cb_err}")
            
            # Try to open the browser locally as a fallback
            try:
                webbrowser.open(auth_url, new=1, autoraise=True)
            except Exception as e:
                logger.warning(f"Failed to open browser locally: {e}")
                
            # Block and wait for redirect request
            local_server.handle_request()
            
            try:
                authorization_response = wsgi_app.last_request_uri.replace("http", "https")
            except AttributeError as e:
                raise WSGITimeoutError("Timed out waiting for response from authorization server") from e
                
            flow.fetch_token(authorization_response=authorization_response)
            self.creds = flow.credentials
            
            token_json_str = self.creds.to_json()
            
            # Callback to update config in MongoDB
            if self.on_token_change:
                try:
                    self.on_token_change(token_json_str)
                except Exception as cb_err:
                    logger.error(f"Failed on_token_change callback: {cb_err}")

            # Update local file for backward compatibility if path exists
            if self.token_path:
                try:
                    os.makedirs(os.path.dirname(self.token_path), exist_ok=True)
                    with open(self.token_path, 'w', encoding='utf-8') as token:
                        token.write(token_json_str)
                except Exception as f_err:
                    logger.warning(f"Could not write token back to file: {f_err}")
                
            logger.info("Google authorization token saved successfully.")
            self.service = build('drive', 'v3', credentials=self.creds)
            
            # Proactively create the _resume root folder for user validation
            try:
                logger.info("Initializing root folder '_resume' on Google Drive...")
                self._get_or_create_folder('_resume', 'root')
            except Exception as folder_err:
                logger.error(f"Failed to initialize root '_resume' folder: {folder_err}")
                
            return True
        finally:
            local_server.server_close()

    def upload_tailored_resume(self, company_name: str, file_path: str) -> str:
        """
        Uploads the tailored resume file to Google Drive.
        Creates '_resume' folder in the root of the user's Drive.
        Creates a subfolder 'companyname_resume' inside it.
        If a file with the same name already exists in that subfolder,
        appends a version suffix (e.g. Nitin_Pradhan_Resume_v2.pdf) to preserve history.
        """
        if not self.service:
            if not self.load_credentials():
                raise RuntimeError("Google Drive credentials not authenticated or expired. Click 'Connect Google Drive' in Settings.")
            self.service = build('drive', 'v3', credentials=self.creds)
            
        # 1. Get or create '_resume' parent folder
        logger.info("Checking Google Drive root folder '_resume'...")
        resume_root_id = self._get_or_create_folder('_resume', 'root')
        
        # 2. Get or create '{company_name}_resume' folder under '_resume'
        company_clean = re.sub(r'\W+', '_', company_name.strip().lower())
        company_folder_name = f"{company_clean}_resume"
        logger.info(f"Checking Google Drive subfolder '{company_folder_name}'...")
        company_folder_id = self._get_or_create_folder(company_folder_name, resume_root_id)
        
        # 3. Determine resume base filename using generic candidate details
        personal = self.config.candidate_identity.personal_details
        first = personal.first_name.strip().replace(" ", "_")
        last = personal.last_name.strip().replace(" ", "_")
        base_name = f"{first}_{last}_Resume"
        
        # List existing files in this subfolder
        existing_files = self._list_files_in_folder(company_folder_id)
        
        final_filename = f"{base_name}.pdf"
        count = 1
        while final_filename in existing_files:
            count += 1
            final_filename = f"{base_name}_v{count}.pdf"
            
        # 4. Upload file
        logger.info(f"Uploading tailored resume as '{final_filename}' to Google Drive...")
        file_metadata = {
            'name': final_filename,
            'parents': [company_folder_id]
        }
        media = MediaFileUpload(file_path, mimetype='application/pdf')
        uploaded_file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        link = uploaded_file.get('webViewLink', '')
        file_id = uploaded_file.get('id', '')
        logger.info(f"Resume uploaded successfully! Drive Link: {link}, ID: {file_id}")
        return link, file_id

    def download_file(self, file_id: str, dest_path: str) -> bool:
        """
        Downloads a file from Google Drive by its file ID to a local destination path.
        """
        if not self.service:
            if not self.load_credentials():
                raise RuntimeError("Google Drive credentials not authenticated or expired.")
            self.service = build('drive', 'v3', credentials=self.creds)
            
        try:
            logger.info(f"Downloading Google Drive file '{file_id}' to '{dest_path}'...")
            request = self.service.files().get_media(fileId=file_id)
            import io
            from googleapiclient.http import MediaIoBaseDownload
            
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, 'wb') as f:
                downloader = MediaIoBaseDownload(f, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
            logger.info(f"File downloaded successfully to {dest_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to download file from Google Drive: {e}")
            return False

    def _get_or_create_folder(self, name: str, parent_id: str) -> str:
        """
        Gets the ID of a folder by name under the specified parent, or creates it if not found.
        """
        query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if parent_id != 'root':
            query += f" and '{parent_id}' in parents"
            
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        if files:
            return files[0]['id']
            
        # Create it
        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id != 'root':
            file_metadata['parents'] = [parent_id]
            
        folder = self.service.files().create(body=file_metadata, fields='id').execute()
        return folder['id']

    def _list_files_in_folder(self, folder_id: str) -> list[str]:
        """
        Lists filenames inside the specified folder ID.
        """
        query = f"'{folder_id}' in parents and trashed = false"
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(name)'
        ).execute()
        files = results.get('files', [])
        return [f['name'] for f in files]
