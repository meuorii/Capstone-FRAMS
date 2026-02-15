from flask import Blueprint

admin_bp = Blueprint("admin_bp", __name__)

from . import auth_routes
from . import overview_routes