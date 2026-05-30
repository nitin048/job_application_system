import sys
import logging
from pathlib import Path

# Add backend and src to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from src.providers.linkedin_provider import LinkedInProvider
from src.config_loader import load_config

# Set up logging to stdout
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Create a mock config
yaml_path = Path(__file__).parent.parent / "config" / "searches.yaml"
config = load_config(yaml_path)

# Update config search parameters for the test
config.search_parameters.positions = ["Software Engineer"]
config.search_parameters.locations = ["Pune"]

provider = LinkedInProvider(config)
print("Running search_jobs...")
results = provider.search_jobs("Software Engineer", "Pune")
print(f"Scrape completed. Returned {len(results)} jobs.")
for r in results[:3]:
    print(f"- Job: {r['title']} at {r['company']} in {r['location']}")
