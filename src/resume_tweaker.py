import os
import re
import logging
import json
import random
import string
from pathlib import Path
from pypdf import PdfReader
import google.generativeai as genai

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch

from src.config_loader import JobAppConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NITIN_RESUME_TEMPLATE = {
    "name": "NITIN PRADHAN",
    "title": "Sr. Software Engineer (Full Stack .NET & React)",
    "contact": "Pune, India | +91-7795275103 | nitinpradhan48@gmail.com | LinkedIn",
    "summary": "Results-driven Full Stack Software Engineer with 7+ years of experience designing, developing, and deploying scalable enterprise-grade applications. Proficient across the entire SDLC with deep expertise in .NET technologies (C#, .NET Core, Web API) and modern frontend frameworks (React.js, TypeScript). Adept at transitioning seamlessly between backend microservices and frontend architectures to deliver robust, end-to-end solutions. Demonstrated ability to lead technical initiatives, optimize system performance, enforce rigorous accessibility standards (WCAG/508), and collaborate cross-functionally in Agile environments to meet strategic business goals.",
    "skills": {
        "Languages & Frameworks": "C#, .NET Core, ASP.NET Web API, React.js, JavaScript, TypeScript, HTML5, CSS3, LINQ, Entity Framework 6.0, Redux",
        "Cloud & Architecture": "RESTful APIs, Microservices, AWS (Lambda, Step Functions, S3)",
        "Databases": "MS SQL Server, MySQL",
        "Testing & CI/CD": "xUnit, Moq, Postman, SonarQube, Checkmarx, Jenkins, Git",
        "Tools & Monitoring": "Dynatrace, Kibana, Splunk, Visual Studio, VS Code, IIS, Accessibility Tools (ARC, JAWS, NVDA)",
        "Methodologies": "Agile, Scrum, Threat Modeling, SOLID Principles, SDLC"
    },
    "experience": [
        {
            "role": "Sr. Software Engineer",
            "company": "Cornerstone OnDemand",
            "location": "Pune, India",
            "dates": "Jun 2024 – Present",
            "bullets": [
                "Spearheaded the development of 'Cornerstone Succession', a strategic talent management module, using .NET Core for backend APIs and React.js/TypeScript for scalable frontend components.",
                "Optimized legacy LINQ queries and refactored critical codebase modules, significantly reducing API response times and improving overall system performance.",
                "Resolved complex accessibility (A11y) defects by implementing semantic HTML and ARIA standards, ensuring strict Section 508 compliance across screen readers (ARC, JAWS, NVDA).",
                "Managed end-to-end delivery of client-requested work orders, analyzing technical impact, estimating effort, and deploying seamless code fixes with minimal turnaround time.",
                "Enforced rigorous code quality standards by applying SOLID principles, conducting peer code reviews, and maintaining high test coverage utilizing xUnit and SonarQube.",
                "Mentored junior developers, acted as the primary point of contact for module-level technical challenges, and facilitated functional quality checks prior to QA handoffs."
            ]
        },
        {
            "role": "Sr. Software Engineer",
            "company": "Globant Pvt Ltd",
            "location": "Pune, India",
            "dates": "Dec 2021 – Jun 2024",
            "bullets": [
                "Deloitte Project (GOAT): Engineered a centralized document comparison tool leveraging C#, .NET Core, and AWS (Lambda, Step Functions, S3) to expedite the Tracking & Trading portfolio review process.",
                "Integrated Abbyy capabilities for robust automated extraction of document details into structured JSON formats.",
                "Tavisca Project (Deals Modernization & Vulnerability Remediation): Built and maintained highly available microservices for travel promotions (Hotels, Cars, Flights) using ASP.NET Core, incorporating Factory Design Patterns for third-party integrations (Kevel, Content Stack).",
                "Fortified application security by performing comprehensive threat modeling, upgrading vulnerable libraries, and mitigating risks across RESTful services.",
                "Configured Dynatrace for proactive alert monitoring, successfully identifying and resolving production anomalies prior to customer impact."
            ]
        },
        {
            "role": "Software Engineer",
            "company": "iLink Digital Pvt Ltd",
            "location": "Pune, India",
            "dates": "Jul 2019 – Dec 2021",
            "bullets": [
                "Ballistix-Nsyteful: Developed robust client integration features for the Nsyteful application to track and drive sales growth, utilizing ASP.NET Core (v3.1) and MySQL.",
                "Designed and maintained critical sales support functions (promotions, inside sales, customer service), collaborating directly with cross-functional teams to gather requirements.",
                "Executed comprehensive code optimization and refactoring initiatives, resolving active production issues."
            ]
        }
    ],
    "education": [
        {
            "degree": "B.E. in Computer Science & Engineering",
            "institution": "KLE Dr. M.S. Sheshgiri College of Engineering and Technology",
            "dates": "Aug 2015 – Jun 2019"
        }
    ]
}

class ResumeTweaker:
    def __init__(self, config: JobAppConfig):
        self.config = config

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extracts raw text content from the given PDF.
        """
        if not os.path.exists(pdf_path):
            return ""
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            logger.error(f"Error reading resume PDF text: {e}")
            return ""

    def tailor_resume(self, job_title: str, job_company: str, job_desc: str, resume_data: dict = None) -> str:
        """
        Tailors the candidate's resume to match the job description at least 85%.
        Saves the resulting PDF and returns the path to it.
        """
        logger.info(f"Starting resume tailoring for {job_title} at {job_company}...")
        
        # Load constants for API keys and output paths
        from config.constants import GEMINI_API_KEY, MODIFIED_RESUME_PATH
        
        # Base JSON
        if resume_data:
            logger.info("Using custom uploaded resume data as base template for tailoring.")
            tailored_data = json.loads(json.dumps(resume_data))
        else:
            tailored_data = json.loads(json.dumps(NITIN_RESUME_TEMPLATE))
        
        # 1. Attempt Gemini optimization
        gemini_success = False
        if GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                # List of model fallbacks
                models_to_try = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
                response_text = ""
                for model_name in models_to_try:
                    try:
                        logger.info(f"Attempting Gemini tailoring with model: {model_name}")
                        model = genai.GenerativeModel(model_name)
                        
                        prompt = f"""
You are an expert resume writer and recruiter. Your task is to tailor a candidate's resume to match a specific job description. The candidate's tailored resume must achieve at least an 85% match score against the job description while strictly retaining the candidate's core professional facts (companies, roles, dates, locations, and degree must not be fabricated or falsified).

Here is the candidate's structured resume:
{json.dumps(tailored_data, indent=2)}

Here is the Job Description:
Company: {job_company}
Title: {job_title}
Details: {job_desc}

Instructions:
1. Retain the EXACT same keys, section names, ordering, and structure as the original JSON. Do not rename or discard any keys or sections.
2. In the "contact" field (or equivalent contact string), append " | Willing to relocate" to the end if not already present.
3. Tailor the content *within* the existing sections (such as summary, skills, experience, or custom sections) to weave in the keywords, technologies, and methodologies required by the job description. Do NOT change the visual structure or phrasing format. Only make highly organic keyword additions/tweaks inside the existing text or bullet lists.
4. Keep the bullet points and text realistic, professional, and matching the candidate's actual credentials. Do not fabricate roles, dates, or companies.
5. Return ONLY a valid JSON object matching the input structure. Do not wrap it in markdown code blocks or backticks.
"""
                        
                        # Generate content forcing JSON output
                        response = model.generate_content(
                            prompt,
                            generation_config={"response_mime_type": "application/json"}
                        )
                        response_text = response.text.strip()
                        # Verify we can load it
                        parsed_gemini = json.loads(response_text)
                        if isinstance(parsed_gemini, dict) and "name" in parsed_gemini:
                            tailored_data = parsed_gemini
                            gemini_success = True
                            logger.info(f"Gemini tailoring succeeded with model {model_name}!")
                            break
                    except Exception as ex:
                        logger.warning(f"Failed with model {model_name}: {ex}")
                        ex_str = str(ex).lower()
                        if "429" in ex_str or "quota" in ex_str or "exhausted" in ex_str:
                            logger.warning("Gemini API quota exceeded or rate limit hit. Aborting further model attempts.")
                            break
                        continue
            except Exception as e:
                logger.warning(f"Failed to run Gemini optimization: {e}. Falling back to rule-based parser.")
        
        # 2. Local heuristic rule-based optimization if Gemini failed or key not set
        if not gemini_success:
            logger.info("Executing rule-based resume tailoring fallback...")
            tailored_data = self._tailor_locally(tailored_data, job_title, job_desc, job_company)
            
        # 3. Output Path setup
        out_path = MODIFIED_RESUME_PATH
        if not out_path:
            out_path = str(Path(__file__).parent.parent / "data" / "Modified_Resume.pdf")
            
        # Generate the tailored PDF using reportlab
        self.generate_pdf_from_json(tailored_data, out_path)
        logger.info(f"Tailored resume generated at: {out_path}")
        
        # 4. Hash modification buster
        from src.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator("", out_path)
        doc_gen.regenerate_with_hash_modifier()
        logger.info("Cryptographic hash buster applied to tailored resume PDF successfully.")
        # Store tailored data as attribute for retrieval/diffs
        self.last_tailored_data = tailored_data
        
        return out_path

    def _tailor_locally(self, data: dict, job_title: str, job_desc: str, job_company: str = "") -> dict:
        """
        Fallback keyword matching algorithm to optimize skills and summary
        safely inspecting dictionary keys dynamically to support arbitrary custom resume layouts.
        """
        desc_lower = job_desc.lower() if job_desc else ""
        title_lower = job_title.lower() if job_title else ""
        
        # 1. Safely add relocation info
        contact_key = None
        for k in data.keys():
            if k.lower() in ["contact", "contact_info", "personal_info", "address", "info"]:
                contact_key = k
                break
        if contact_key:
            if isinstance(data[contact_key], str) and "Willing to relocate" not in data[contact_key]:
                data[contact_key] += " | Willing to relocate"
        else:
            if "contact" in data and isinstance(data["contact"], str):
                if "Willing to relocate" not in data["contact"]:
                    data["contact"] += " | Willing to relocate"
                    
        # 2. Safely update job title
        if job_title:
            if "title" in data:
                data["title"] = f"Sr. Software Engineer | {job_title}"
            else:
                title_key = None
                for k in data.keys():
                    if k.lower() in ["title", "headline", "role"]:
                        title_key = k
                        break
                if title_key:
                    data[title_key] = f"Sr. Professional | {job_title}"

        # 3. Match keywords
        keywords_map = {
            "Languages & Frameworks": [
                ("python", "Python"), ("javascript", "JavaScript"), ("typescript", "TypeScript"),
                ("react", "React.js"), ("node", "Node.js"), ("express", "Express.js"),
                ("c#", "C#"), (".net", ".NET Core"), ("asp.net", "ASP.NET Core"),
                ("angular", "Angular"), ("vue", "Vue.js"), ("golang", "Go/Golang"),
                ("redux", "Redux"), ("next.js", "Next.js")
            ],
            "Cloud & Architecture": [
                ("aws", "AWS"), ("lambda", "AWS Lambda"), ("step functions", "AWS Step Functions"),
                ("s3", "AWS S3"), ("microservices", "Microservices"), ("restful api", "RESTful APIs"),
                ("docker", "Docker"), ("kubernetes", "Kubernetes"), ("azure", "Azure"),
                ("gcp", "GCP"), ("serverless", "Serverless Architecture")
            ],
            "Databases": [
                ("sql server", "MS SQL Server"), ("mysql", "MySQL"), ("postgres", "PostgreSQL"),
                ("mongodb", "MongoDB"), ("redis", "Redis"), ("dynamodb", "DynamoDB")
            ],
            "Testing & CI/CD": [
                ("xunit", "xUnit"), ("moq", "Moq"), ("sonarqube", "SonarQube"),
                ("checkmarx", "Checkmarx"), ("jenkins", "Jenkins"), ("git", "Git"),
                ("github actions", "GitHub Actions"), ("cicd", "CI/CD Pipelines")
            ],
            "Tools & Monitoring": [
                ("dynatrace", "Dynatrace"), ("kibana", "Kibana"), ("splunk", "Splunk"),
                ("accessibility", "Accessibility Tools (ARC, JAWS, NVDA)"), ("wcag", "WCAG compliance")
            ],
            "Methodologies": [
                ("agile", "Agile"), ("scrum", "Scrum"), ("threat modeling", "Threat Modeling"),
                ("solid", "SOLID Principles"), ("sdlc", "SDLC")
            ]
        }
        
        matched_skills = []
        for category, mappings in keywords_map.items():
            for key, display in mappings:
                if key in desc_lower or key in title_lower:
                    matched_skills.append(display)
                    
        matched_skills = list(set(matched_skills))
        
        # 4. Safely optimize skills section
        skills_key = None
        for k in data.keys():
            if any(term in k.lower() for term in ["skill", "competenc", "technolog", "expertis"]):
                skills_key = k
                break
                
        if skills_key:
            skills_val = data[skills_key]
            if isinstance(skills_val, dict):
                # Standard dictionary: look up keys or append to first key
                for cat in list(skills_val.keys()):
                    target_mappings = []
                    for k_cat, mappings in keywords_map.items():
                        if k_cat.lower() in cat.lower() or cat.lower() in k_cat.lower():
                            target_mappings = mappings
                            break
                    if target_mappings:
                        cat_matched = []
                        for key, display in target_mappings:
                            if key in desc_lower or key in title_lower:
                                cat_matched.append(display)
                        current_vals = [v.strip().lower() for v in str(skills_val[cat]).split(",")]
                        additions = [s for s in cat_matched if s.lower() not in current_vals]
                        if additions:
                            skills_val[cat] = str(skills_val[cat]) + ", " + ", ".join(additions)
                    else:
                        current_vals = [v.strip().lower() for v in str(skills_val[cat]).split(",")]
                        additions = [s for s in matched_skills if s.lower() not in current_vals][:3]
                        if additions:
                            skills_val[cat] = str(skills_val[cat]) + ", " + ", ".join(additions)
            elif isinstance(skills_val, str):
                current_vals = [v.strip().lower() for v in skills_val.split(",")]
                additions = [s for s in matched_skills if s.lower() not in current_vals][:5]
                if additions:
                    data[skills_key] = skills_val + ", " + ", ".join(additions)
            elif isinstance(skills_val, list):
                # List of skills
                current_vals = [v.strip().lower() for v in skills_val]
                for s in matched_skills:
                    if s.lower() not in current_vals:
                        skills_val.append(s)
        else:
            # skills key not found; if skills is in keys, use it
            if "skills" in data and isinstance(data["skills"], dict):
                for cat in list(data["skills"].keys()):
                    target_mappings = []
                    for k_cat, mappings in keywords_map.items():
                        if k_cat.lower() in cat.lower() or cat.lower() in k_cat.lower():
                            target_mappings = mappings
                            break
                    if target_mappings:
                        cat_matched = []
                        for key, display in target_mappings:
                            if key in desc_lower or key in title_lower:
                                cat_matched.append(display)
                        current_vals = [v.strip().lower() for v in str(data["skills"][cat]).split(",")]
                        additions = [s for s in cat_matched if s.lower() not in current_vals]
                        if additions:
                            data["skills"][cat] = str(data["skills"][cat]) + ", " + ", ".join(additions)
                    else:
                        current_vals = [v.strip().lower() for v in str(data["skills"][cat]).split(",")]
                        additions = [s for s in matched_skills if s.lower() not in current_vals][:3]
                        if additions:
                            data["skills"][cat] = str(data["skills"][cat]) + ", " + ", ".join(additions)
                        
        # 5. Safely optimize Summary section
        summary_key = None
        for k in data.keys():
            if any(term in k.lower() for term in ["summary", "profile", "about", "intro"]):
                summary_key = k
                break
        if summary_key and isinstance(data[summary_key], str):
            company_segment = f" at {job_company}" if job_company else ""
            if matched_skills:
                top_skills = ", ".join(matched_skills[:4])
                data[summary_key] = f"Results-driven professional with 7+ years of experience. Proficient in {top_skills}, with deep expertise and transferable skills aligned with the needs at {company_segment or 'your organization'}. Willing to relocate."
        elif "summary" in data and isinstance(data["summary"], str):
            company_segment = f" at {job_company}" if job_company else ""
            if matched_skills:
                top_skills = ", ".join(matched_skills[:4])
                data["summary"] = f"Results-driven professional with 7+ years of experience. Proficient in {top_skills}, with deep expertise and transferable skills aligned with the needs at {company_segment or 'your organization'}. Willing to relocate."
                
        # 6. Safely optimize Experience bullet points
        exp_key = None
        for k in data.keys():
            if any(term in k.lower() for term in ["experience", "employment", "history", "work"]):
                exp_key = k
                break
                
        if exp_key and isinstance(data[exp_key], list):
            # Iterate through jobs
            for i, job in enumerate(data[exp_key]):
                if not isinstance(job, dict):
                    continue
                # Look for bullets or description
                bullets_key = None
                for b_k in job.keys():
                    if b_k.lower() in ["bullets", "details", "achievements", "description"]:
                        bullets_key = b_k
                        break
                if bullets_key:
                    bullets_val = job[bullets_key]
                    if isinstance(bullets_val, list) and bullets_val:
                        if matched_skills:
                            tech_to_inject = matched_skills[i % len(matched_skills)]
                            bullets_val[0] = f"Integrated key systems and methodologies using {tech_to_inject} to improve efficiency, performance, and overall outcomes."
        elif "experience" in data and isinstance(data["experience"], list):
            for i, job in enumerate(data["experience"]):
                if isinstance(job, dict) and "bullets" in job and isinstance(job["bullets"], list) and job["bullets"]:
                    if matched_skills:
                        tech_to_inject = matched_skills[i % len(matched_skills)]
                        job["bullets"][0] = f"Integrated key systems and methodologies using {tech_to_inject} to improve efficiency, performance, and overall outcomes."
                        
        return data

    def generate_pdf_from_json(self, data: dict, output_pdf_path: str):
        """
        Compiles the resume JSON into a styled, ATS-compliant PDF using ReportLab flowables.
        """
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        
        margin = 36 # 0.5 inch margins
        doc = SimpleDocTemplate(
            output_pdf_path,
            pagesize=letter,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin
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
        contact_val = data.get("contact", "")
        if isinstance(contact_val, dict):
            contact_str = " | ".join(str(v) for v in contact_val.values() if v)
        else:
            contact_str = str(contact_val)
        story.append(Paragraph(contact_str, style_contact))
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
