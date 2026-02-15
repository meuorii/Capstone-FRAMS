from flask import Blueprint

admin_bp = Blueprint("admin_bp", __name__)

from . import auth_routes
from . import overview_routes
from . import student_routes
from . import subject_routes
from . import semester_routes
from . import curriculum_routes
from . import class_routes