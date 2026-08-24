import os
import sys
import secrets

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESUME_DIR = os.path.join(DATA_DIR, "resumes")
DB_PATH = os.path.join(DATA_DIR, "besure.db")

_dev_mode = os.environ.get("FLASK_DEBUG", "0") == "1" or "--debug" in sys.argv

SECRET_KEY = os.environ.get("SECRET_KEY")
ADMIN_PASSWORD = os.environ.get("BESURE_ADMIN_PASSWORD")

if not SECRET_KEY:
    if _dev_mode:
        SECRET_KEY = "dev-secret-key-not-for-production"
    else:
        sys.exit("Set SECRET_KEY env var before running in production.")

if not ADMIN_PASSWORD:
    if _dev_mode:
        ADMIN_PASSWORD = "changeme"
    else:
        sys.exit("Set BESURE_ADMIN_PASSWORD env var before running in production.")

MAX_RESUME_SIZE_MB = 10
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
