import os
import re
import json
import logging
import zipfile
import smtplib
import xml.etree.ElementTree as ET
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

from pypdf import PdfReader
import google.generativeai as genai
from playwright.sync_api import sync_playwright

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PORTAL_DOMAINS = [
    "naukri.com", "linkedin.com", "indeed.com", "glassdoor", "monster", 
    "foundit", "simplyhired", "ziprecruiter", "dice.com", "careerbuilder",
    "internshala", "wellfound", "angel.co", "timesjobs", "shine.com",
    "greenhouse.io", "lever.co", "myworkdayjobs.com", "taleo.net", "icims.com",
    "smartrecruiters.com", "ashbyhq.com", "bamboohr.com", "recruitee.com", 
    "breezy.hr", "workable.com"
]

PORTAL_KEYWORDS = [
    "/careers", "/jobs", "/career", "/job", "job-listings", "job-detail", 
    "viewjob", "vacancy", "position", "recruit", "job-posting"
]

def is_valid_job_portal(url: str) -> bool:
    """
    Checks if the given URL corresponds to a known job portal domain, ATS system, or company careers page.
    """
    url_lower = url.lower()
    # Check if matches whitelisted domains
    if any(domain in url_lower for domain in PORTAL_DOMAINS):
        return True
    # Check if contains career/job portal keywords in path
    if any(kw in url_lower for kw in PORTAL_KEYWORDS):
        return True
    return False

def extract_text_from_docx(docx_path: str) -> str:
    """
    Natively unzips and extracts plain text from a modern .docx Word document
    without requiring third-party compiled binaries.
    """
    try:
        if not os.path.exists(docx_path):
            return ""
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # Namespace for Word OpenXML
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            paragraphs = []
            for p in root.findall('.//w:p', ns):
                texts = []
                for t in p.findall('.//w:t', ns):
                    if t.text:
                        texts.append(t.text)
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)
    except Exception as e:
        logger.error(f"Error natively unzipping/reading DOCX file {docx_path}: {e}")
        return ""

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts plain text from the given PDF file.
    """
    try:
        if not os.path.exists(pdf_path):
            return ""
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text
    except Exception as e:
        logger.error(f"Error reading PDF file {pdf_path}: {e}")
        return ""

def parse_and_structure_resume(raw_text: str, api_key: str) -> dict:
    """
    Sends raw text of any resume to Gemini to structure it dynamically, retaining
    the exact original sections, visual layout, headings, and phrasing without forcing it
    into a rigid candidate profile schema.
    """
    # 1. Create a dynamic fallback layout by parsing lines locally
    dynamic_fallback = {
        "name": "YOUR NAME",
        "title": "Professional Title",
        "contact": "Location | Phone | Email"
    }
    
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    if lines:
        dynamic_fallback["name"] = lines[0][:60]
        if len(lines) > 1:
            if any(sym in lines[1] for sym in ["@", "|", "+", "linkedin", "gmail"]):
                dynamic_fallback["contact"] = lines[1][:120]
            else:
                dynamic_fallback["title"] = lines[1][:80]
                if len(lines) > 2:
                    dynamic_fallback["contact"] = lines[2][:120]
                    
    current_section = "Summary"
    dynamic_fallback[current_section] = []
    
    header_count = 3 if len(lines) > 3 else len(lines)
    for line in lines[header_count:]:
        is_heading = (line.isupper() and len(line) < 40) or (line.endswith(":") and len(line) < 40)
        if is_heading:
            current_section = line.rstrip(":")
            dynamic_fallback[current_section] = []
        else:
            # Clean bullet characters if any
            cleaned_line = re.sub(r'^[•\-\*\u2022\u25cf\u25cb\u25aa\u25ab]\s*', '', line)
            if isinstance(dynamic_fallback[current_section], list):
                dynamic_fallback[current_section].append(cleaned_line)
            else:
                dynamic_fallback[current_section] = [cleaned_line]

    # Convert single-item lists to strings where appropriate
    for k, v in list(dynamic_fallback.items()):
        if k in ["name", "title", "contact"]:
            continue
        if isinstance(v, list):
            if not v:
                dynamic_fallback[k] = ""
            elif len(v) == 1:
                dynamic_fallback[k] = v[0]
            # otherwise keep it as list of bullet strings

    if not raw_text.strip():
        return dynamic_fallback

    if not api_key:
        logger.warning("No Gemini API key provided for structuring custom resume text. Using dynamic local fallback.")
        return dynamic_fallback

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        prompt = f"""
You are an expert ATS parser. Analyze the following candidate resume text.
Structure the entire resume into a JSON object. 
Ensure you:
1. Extract "name", "title", and "contact" information under those exact keys at the top level of the JSON.
2. Extract all other sections EXACTLY as they are named and sequenced in the original resume. Use the original section titles as top-level JSON keys (e.g. "Professional Experience", "Skills", "Certifications", "Projects", "Education", "Interests", etc.). Do not discard, skip, rename, or reorganize any sections.
3. For the content of each section, preserve the exact wording, phrasing, and structure:
   - If a section is a simple text summary or paragraph, represent it as a string.
   - If a section contains a bulleted list of items, represent it as a list of strings (bullets).
   - If a section lists career history or job experience, represent it as a list of objects, where each object contains properties like "role", "company", "location", "dates", and a "bullets" list of strings.
   - If a section contains key-value pairs (like skill categories), represent it as a JSON object with those categories and skill lists.
4. Return ONLY a valid JSON object matching this structure. Do not use markdown tags or wrap the JSON in backticks or code blocks.

Raw Resume Text:
{raw_text}
"""
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        parsed = json.loads(response.text.strip())
        if isinstance(parsed, dict) and "name" in parsed:
            # Successfully parsed! Return parsed dictionary
            return parsed
        return dynamic_fallback
    except Exception as e:
        logger.error(f"Failed structuring custom resume via Gemini: {e}. Falling back to dynamic local structure.")
        return dynamic_fallback

def crawl_job_portal_details(job_url: str) -> dict:
    """
    Crawls a job portal URL in headless mode using Playwright and extracts job details.
    """
    result = {"title": "", "company": "", "description": ""}
    
    logger.info(f"Crawling external job listing details from: {job_url}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate standard mac chrome to prevent bot blockers
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        try:
            page.goto(job_url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            
            # 1. Extract job title
            title_selectors = [
                "h1", "h1.jd-header-title", "h1[class*='title']", 
                "main h1", ".styles_jd-header-title__aWbb2", ".job-title"
            ]
            for sel in title_selectors:
                try:
                    el = page.locator(sel).first
                    if el and el.is_visible():
                        result["title"] = el.inner_text().strip()
                        if result["title"]:
                            break
                except Exception:
                    continue
            
            # 2. Extract company name
            company_selectors = [
                "a.comp-name", "div.companyName", "div[class*='company'] a", 
                "a[class*='company']", ".styles_jd-header-comp-name__MvqAI", ".company-name"
            ]
            for sel in company_selectors:
                try:
                    el = page.locator(sel).first
                    if el and el.is_visible():
                        result["company"] = el.inner_text().strip()
                        # Clean any reviews text e.g. "Google 4.5"
                        result["company"] = re.sub(r'\s*\d+\.\d+\s*Reviews?.*', '', result["company"], flags=re.IGNORECASE).strip()
                        if result["company"]:
                            break
                except Exception:
                    continue
            
            # 3. Extract description
            desc_selectors = [
                "section.job-desc", "div.job-desc", "div[class*='job-desc']", 
                "div[class*='JdContainer']", ".jd-description", "div.clearBoth"
            ]
            desc_text = ""
            for sel in desc_selectors:
                try:
                    el = page.locator(sel).first
                    if el and el.is_visible():
                        desc_text = el.inner_text().strip()
                        if desc_text:
                            break
                except Exception:
                    continue
            
            if not desc_text:
                desc_text = page.locator("body").inner_text().strip()
            
            # Clean consecutive returns
            result["description"] = re.sub(r'\n{3,}', '\n\n', desc_text)
            
            # Set defaults if empty
            if not result["title"]:
                result["title"] = "Scraped Opportunity"
            if not result["company"]:
                result["company"] = "Target Employer"
                
            logger.info(f"Successfully scraped job details: {result['title']} at {result['company']}")
        except Exception as e:
            logger.error(f"Error crawling job portal details: {e}")
        finally:
            browser.close()
            
    return result

def audit_ats_score(resume_text: str, job_desc: str, api_key: str) -> dict:
    """
    Computes ATS score, Matched Keywords, Missing Keywords, and suggestions using Gemini.
    Includes a robust local word token overlap fallback. Supports empty job descriptions for general audits.
    """
    fallback_result = {
        "score": 65,
        "matched_keywords": ["Structure", "Formatting", "Objective", "Education", "Experience"],
        "missing_keywords": ["Certifications", "Skills Matrix", "Metrics", "Action Verbs"],
        "recommendations": [
            "Structure experience chronologically with clear dates.",
            "Enforce a clean, single-column design layout for ATS scanning.",
            "Include strong action verbs and quantified impact metrics."
        ]
    }
    
    if not resume_text.strip():
        return fallback_result

    # Step 1: Run local token search if job description is provided
    if job_desc.strip():
        r_words = set(re.findall(r'\b\w{3,}\b', resume_text.lower()))
        j_words = set(re.findall(r'\b\w{3,}\b', job_desc.lower()))
        
        stopwords = {
            "and", "the", "for", "with", "this", "that", "from", "your", "their", 
            "will", "have", "been", "were", "are", "was", "she", "our", "you"
        }
        j_keywords = j_words - stopwords
        
        matched = list(j_keywords & r_words)
        missing = list(j_keywords - r_words)
        
        matched_sample = sorted(matched, key=len, reverse=True)[:15]
        missing_sample = sorted(missing, key=len, reverse=True)[:15]
        
        overlap_score = int((len(matched) / max(1, len(j_keywords))) * 100)
        local_score = max(30, min(overlap_score + 15, 95))
        
        fallback_result["score"] = local_score
        fallback_result["matched_keywords"] = matched_sample
        fallback_result["missing_keywords"] = missing_sample

    # Step 2: Use Gemini if key is provided
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            if job_desc.strip():
                prompt = f"""
You are a professional ATS scanner. Analyze the candidate resume text against the job description.
Compute an ATS Compatibility Score (0-100), identify matched keywords, missing keywords, and provide 3 highly actionable recommendations.

Return ONLY a valid JSON object with keys:
- "score": integer (0-100)
- "matched_keywords": list of strings (max 12)
- "missing_keywords": list of strings (max 12)
- "recommendations": list of strings (exactly 3 items)

Do not write markdown block formats or backticks.

Resume Text:
{resume_text}

Job Description:
{job_desc}
"""
            else:
                prompt = f"""
You are a professional ATS scanner. Analyze the candidate's resume text for general ATS compatibility, formatting, and best practices.
Compute a general ATS Score (0-100), identify strong keywords already present, identify critical missing standard keywords (such as standard methodologies, tools, or section titles), and provide 3 highly actionable recommendations.

Return ONLY a valid JSON object with keys:
- "score": integer (0-100)
- "matched_keywords": list of strings (max 12)
- "missing_keywords": list of strings (max 12)
- "recommendations": list of strings (exactly 3 items)

Do not write markdown block formats or backticks.

Resume Text:
{resume_text}
"""
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            parsed = json.loads(response.text.strip())
            if "score" in parsed and "matched_keywords" in parsed:
                return parsed
        except Exception as e:
            logger.error(f"Gemini ATS Audit failed: {e}. Utilizing fallback local token score.")
            
    return fallback_result

def generate_ats_friendly_pdf(data: dict, out_path: str):
    """
    Renders an ATS-friendly, pristine standard-format PDF resume from structured JSON data.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Styles definition
    style_name = ParagraphStyle(
        'Name',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1e293b')
    )
    
    style_title = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4f46e5')
    )
    
    style_contact = ParagraphStyle(
        'Contact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b')
    )
    
    style_section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )
    
    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#334155'),
        spaceAfter=4
    )
    
    style_skill_cat = ParagraphStyle(
        'SkillCat',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    
    style_skill_val = ParagraphStyle(
        'SkillVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#334155')
    )
    
    style_job_title = ParagraphStyle(
        'JobTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#1e293b')
    )
    
    style_job_meta = ParagraphStyle(
        'JobMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_RIGHT
    )
    
    style_bullet = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=2
    )

    story = []
    
    # 1. Header (Name, Title, Contact)
    story.append(Paragraph(data.get("name", "CANDIDATE NAME"), style_name))
    story.append(Spacer(1, 4))
    if data.get("title"):
        story.append(Paragraph(data.get("title"), style_title))
        story.append(Spacer(1, 4))
    story.append(Paragraph(data.get("contact", ""), style_contact))
    story.append(Spacer(1, 6))
    
    # 2. Loop through all sections dynamically to keep original visual structure
    for key, val in data.items():
        if key in ["name", "title", "contact"]:
            continue
            
        story.append(Paragraph(str(key).upper(), style_section_heading))
        story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cbd5e1'), spaceBefore=0, spaceAfter=5))
        
        if isinstance(val, str):
            if val.strip():
                story.append(Paragraph(val, style_body))
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, str):
                    if item.strip():
                        story.append(Paragraph(f"&bull; {item}", style_bullet))
                elif isinstance(item, dict):
                    role = item.get("role") or item.get("degree") or item.get("title") or ""
                    comp = item.get("company") or item.get("institution") or item.get("school") or ""
                    loc = item.get("location") or ""
                    dates = item.get("dates") or item.get("dates_active") or ""
                    
                    comp_loc = comp
                    if loc:
                        comp_loc += f" | {loc}"
                        
                    header_text = ""
                    if role and comp_loc:
                        header_text = f"<b>{role}</b> | {comp_loc}"
                    elif role:
                        header_text = f"<b>{role}</b>"
                    elif comp_loc:
                        header_text = f"<b>{comp_loc}</b>"
                        
                    if header_text or dates:
                        meta_table_data = [
                            [Paragraph(header_text, style_job_title), Paragraph(dates, style_job_meta)]
                        ]
                        meta_table = Table(meta_table_data, colWidths=[5.5*inch, 2.0*inch])
                        meta_table.setStyle(TableStyle([
                            ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
                            ('PADDING', (0,0), (-1,-1), 0),
                            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                        ]))
                        story.append(meta_table)
                        
                    bullets = item.get("bullets") or item.get("details") or item.get("achievements") or []
                    if isinstance(bullets, list):
                        for b in bullets:
                            if isinstance(b, str) and b.strip():
                                story.append(Paragraph(f"&bull; {b}", style_bullet))
                    elif isinstance(bullets, str) and bullets.strip():
                        story.append(Paragraph(bullets, style_body))
                    story.append(Spacer(1, 3))
        elif isinstance(val, dict):
            skills_table_data = []
            for cat, s_val in val.items():
                if isinstance(s_val, list):
                    s_val_str = ", ".join(s_val)
                else:
                    s_val_str = str(s_val)
                skills_table_data.append([
                    Paragraph(f"{cat}:", style_skill_cat),
                    Paragraph(s_val_str, style_skill_val)
                ])
            
            if skills_table_data:
                skills_table = Table(skills_table_data, colWidths=[1.5*inch, 6.0*inch])
                skills_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('PADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ]))
                story.append(skills_table)
            story.append(Spacer(1, 4))
            
    doc.build(story)

def send_resume_via_email(to_email: str, subject: str, body: str, attachment_path: str, smtp_host: str, smtp_port: int, smtp_user: str, smtp_pass: str) -> dict:
    """
    Sends the tailored resume PDF securely using smtplib to the candidate or company email address.
    """
    if not smtp_host or not smtp_user or not smtp_pass:
        return {"success": False, "message": "SMTP settings are incomplete. Configure them under the Secrets & Keys tab."}
        
    if not os.path.exists(attachment_path):
        return {"success": False, "message": f"Attachment file not found at: {attachment_path}"}
        
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        filename = os.path.basename(attachment_path)
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {filename}",
            )
            msg.attach(part)
            
        # Secure SMTP connect
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()
        
        logger.info(f"Resume email successfully sent to {to_email}!")
        return {"success": True, "message": f"Successfully sent tailored resume to {to_email}!"}
    except Exception as e:
        logger.error(f"Error sending SMTP email: {e}")
        return {"success": False, "message": f"SMTP email failed: {str(e)}"}
