from flask import Blueprint

# Ensure the name and url_prefix match your index.py expectations
admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/admin")

# Use relative imports (single dot) for sibling files
from . import auth_routes
from . import overview_routes
from . import student_routes
from . import subject_routes
from . import semester_routes
from . import curriculum_routes
from . import class_routes
from . import instructor_routes
from . import attendance_reports_routes