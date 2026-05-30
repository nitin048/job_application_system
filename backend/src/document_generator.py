import os
import random
import string
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter

class DocumentGenerator:
    def __init__(self, template_path: str, output_path: str):
        self.template_path = template_path
        self.output_path = output_path

    def compile_pdf(self, first_name: str, last_name: str, email: str, phone: str):
        """
        Creates a basic PDF resume layout dynamically.
        """
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        c = canvas.Canvas(self.output_path)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(100, 750, f"{first_name} {last_name}")
        c.setFont("Helvetica", 12)
        c.drawString(100, 720, f"Email: {email} | Phone: {phone}")
        c.drawString(100, 700, "Position: Software Engineer")
        
        c.drawString(100, 650, "Professional Experience:")
        c.drawString(120, 630, "- Built large-scale autonomous parsing systems.")
        c.drawString(120, 610, "- Hardened automation runtimes against bot detection frameworks.")
        
        c.showPage()
        c.save()

    def regenerate_with_hash_modifier(self):
        """
        Appends hidden white characters (such as spaces/tabs) to the PDF metadata
        and end section. This alters the cryptographic file hash to force target databases
        like Naukri to mark it as a 'new' file, while retaining visual identity for recruiter viewers.
        """
        if not os.path.exists(self.output_path):
            return False
            
        reader = PdfReader(self.output_path)
        writer = PdfWriter()
        
        for page in reader.pages:
            writer.add_page(page)
            
        # Append random string to metadata metadata values to break direct hash matches
        random_hash_buster = "".join(random.choices(string.ascii_letters + string.digits, k=16))
        writer.add_metadata({
            "/ModifierID": random_hash_buster,
            "/Keywords": f"AI Engine {random_hash_buster}"
        })
        
        # Overwrite with modified data
        with open(self.output_path, "wb") as f:
            writer.write(f)
            
        return True
