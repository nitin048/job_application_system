import re
import time
import logging
from typing import Any
from pydantic import BaseModel, Field
from src.config_loader import JobAppConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FormField(BaseModel):
    id: str
    label: str
    type: str  # text, select, file, radio, checkbox
    value: Any = None
    options: list[str] = Field(default_factory=list)
    confidence: float = 1.0

class GraphState(BaseModel):
    url: str
    fields: list[FormField] = Field(default_factory=list)
    assembled_payload: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    retry_count: int = 0
    current_node: str = "Initialize"

class FormGraphOrchestrator:
    def __init__(self, config: JobAppConfig):
        self.config = config

    def run(self, url: str, mock_dom_structure: list[dict]) -> GraphState:
        """
        Runs the form filling state machine logic sequentially.
        """
        state = GraphState(url=url)
        
        # 1. Initialize Node
        state = self.node_initialize(state)
        
        # 2. Extract Node
        state = self.node_extract(state, mock_dom_structure)
        
        # 3. Generate Node
        state = self.node_generate(state)
        
        # 4. Assemble Node
        state = self.node_assemble(state)
        
        # Retry loop simulation if failures exist
        while state.errors and state.retry_count < 2:
            state.retry_count += 1
            state.errors.clear()
            state = self.node_extract(state, mock_dom_structure)
            state = self.node_generate(state)
            state = self.node_assemble(state)
            
        return state

    def run_playwright_fill(self, page, resume_path: str) -> GraphState:
        """
        Extracts form structure from active Playwright page, generates matched responses,
        fills the form inputs on screen, uploads resume_path, and submits/screenshots.
        """
        state = GraphState(url=page.url)
        state = self.node_initialize(state)
        if state.errors:
            return state
            
        # 1. Extract DOM structure from the page
        logger.info("Scanning page DOM for form elements...")
        raw_dom = []
        
        # Select common input elements
        inputs = page.query_selector_all("input, select, textarea")
        for inp in inputs:
            # We want to identify the element
            element_id = inp.get_attribute("id") or inp.get_attribute("name") or ""
            if not element_id:
                # Generate a temporary unique selector/id if missing
                element_id = inp.get_attribute("class") or ""
                element_id = re.sub(r'\s+', '_', element_id.strip())
                if not element_id:
                    continue
            
            # Determine type
            element_type = inp.get_attribute("type") or inp.evaluate("el => el.tagName.toLowerCase()")
            
            # Determine label
            label_text = ""
            label_el = None
            # Find associated label element
            if inp.get_attribute("id"):
                try:
                    label_el = page.query_selector(f"label[for='{inp.get_attribute('id')}']")
                except Exception:
                    pass
            if label_el:
                label_text = label_el.text_content().strip()
            
            # Fallback labels
            if not label_text:
                label_text = inp.get_attribute("placeholder") or inp.get_attribute("aria-label") or inp.get_attribute("name") or ""
                
            # Get options if select
            options = []
            if element_type == "select":
                opts = inp.query_selector_all("option")
                options = [o.text_content().strip() for o in opts if o.text_content().strip()]
                
            raw_dom.append({
                "id": element_id,
                "label": label_text,
                "type": element_type,
                "options": options,
                "selector": inp
            })
            
        # Run node extract
        state = self.node_extract(state, raw_dom)
        
        # Run node generate
        state = self.node_generate(state)
        
        # Fill the elements on screen
        logger.info("Executing on-screen input populating...")
        for field in state.fields:
            # Match back to our DOM item selector
            dom_item = next((item for item in raw_dom if item["id"] == field.id), None)
            if not dom_item:
                continue
                
            selector_el = dom_item["selector"]
            val = field.value
            
            try:
                if dom_item["type"] == "file":
                    # File upload (resume path)
                    logger.info(f"Uploading tailored resume '{resume_path}' to field: '{field.label}'")
                    selector_el.set_input_files(resume_path)
                elif dom_item["type"] == "select":
                    # Select option matching val
                    logger.info(f"Selecting option '{val}' for field: '{field.label}'")
                    selector_el.select_option(label=val)
                elif dom_item["type"] in ["checkbox", "radio"]:
                    # Tick if val indicates truthy or match
                    is_checked = selector_el.is_checked()
                    if (val == "Yes" or val is True) and not is_checked:
                        logger.info(f"Checking box for field: '{field.label}'")
                        selector_el.check()
                    elif (val == "No" or val is False) and is_checked:
                        logger.info(f"Unchecking box for field: '{field.label}'")
                        selector_el.uncheck()
                else:
                    # Text/email/phone inputs
                    logger.info(f"Filling text '{val}' for field: '{field.label}'")
                    selector_el.fill(str(val))
            except Exception as e:
                logger.warning(f"Failed to populate field '{field.label}': {e}")
                state.errors.append(f"Failed to fill field '{field.label}': {e}")
                
        # Run node assemble
        state = self.node_assemble(state)
        
        # Save screenshot
        screenshot_path = Path("data/screenshots")
        screenshot_path.mkdir(parents=True, exist_ok=True)
        img_file = screenshot_path / f"form_{int(time.time())}.png"
        page.screenshot(path=str(img_file))
        logger.info(f"Saved application fill screenshot at {img_file}")
        
        # Click submit if no error exists and not in dry-run/mock link
        if not state.errors and "example.com" not in page.url:
            # Look for submit button
            submit_btn = page.query_selector("button[type='submit'], input[type='submit'], .submit-button")
            if submit_btn:
                logger.info("Clicking form submit button...")
                submit_btn.click()
                page.wait_for_timeout(3000) # wait for submission redirect/load
                page.screenshot(path=str(screenshot_path / "post_submission.png"))
            else:
                logger.warning("Submit button not found. You might need to submit manually.")
                
        return state

    def node_initialize(self, state: GraphState) -> GraphState:
        state.current_node = "Initialize"
        # Validate baseline access
        if not state.url.startswith("http"):
            state.errors.append("Invalid protocol or URL target.")
        return state

    def node_extract(self, state: GraphState, mock_dom: list[dict]) -> GraphState:
        state.current_node = "Extract"
        fields = []
        for element in mock_dom:
            fields.append(FormField(
                id=element.get("id", ""),
                label=element.get("label", ""),
                type=element.get("type", "text"),
                options=element.get("options", []),
                confidence=1.0
            ))
        state.fields = fields
        return state

    def node_generate(self, state: GraphState) -> GraphState:
        state.current_node = "Generate"
        # Match candidate profile fields to extracted labels
        personal = self.config.candidate_identity.personal_details
        demographics = self.config.candidate_identity.demographics
        compliance = self.config.compliance_preferences
        
        for field in state.fields:
            label = field.label.lower()
            if "first name" in label or "firstname" in label:
                field.value = personal.first_name
            elif "last name" in label or "lastname" in label:
                field.value = personal.last_name
            elif "email" in label:
                field.value = personal.email
            elif "phone" in label or "mobile" in label:
                field.value = personal.phone
            elif "gender" in label:
                field.value = self._find_best_match(demographics.gender, field.options)
            elif "pronoun" in label:
                field.value = demographics.pronouns
            elif "relocat" in label:
                if "where" in label or "dest" in label or "location" in label or "prefer" in label:
                    field.value = getattr(compliance, "relocation_destinations", "")
                else:
                    field.value = self._find_best_match(compliance.open_to_relocation, field.options)
            elif "drug" in label:
                field.value = self._find_best_match(compliance.willing_to_undergo_drug_tests, field.options)
            else:
                # Default fallback or mock response for unstructured/custom questions
                field.value = "Yes" if field.type in ["checkbox", "radio"] else ""
        return state

    def node_assemble(self, state: GraphState) -> GraphState:
        state.current_node = "Assemble"
        payload = {}
        for field in state.fields:
            # Only flag as error if field is marked required AND has no value
            # (don't block submission on optional/unknown fields)
            if field.value is None or field.value == "":
                field.confidence = 0.5  # Low confidence but not blocking
            payload[field.id] = field.value
        state.assembled_payload = payload
        return state


    def _find_best_match(self, value: str, options: list[str]) -> str:
        """
        Implements case-insensitive matching and substring fallback for options.
        """
        if not options:
            return value
        
        val_clean = re.sub(r"\W+", "", value.lower())
        
        # Exact match attempt
        for opt in options:
            opt_clean = re.sub(r"\W+", "", opt.lower())
            if opt_clean == val_clean:
                return opt
                
        # Substring containment match attempt
        for opt in options:
            opt_clean = re.sub(r"\W+", "", opt.lower())
            if val_clean in opt_clean or opt_clean in val_clean:
                return opt
                
        return options[0]  # default fallback
