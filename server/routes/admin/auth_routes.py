from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
from config.db_config import db
from models.admin_model import find_admin_by_email, find_admin_by_user_id, create_admin
from . import admin_bp

admins_col = db["admins"]

#Admin Register
@admin_bp.route("/api/admin/register", methods=["POST"])
def register_admin():
    data = request.get_json() or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    user_id = (data.get("user_id") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    program = (data.get("program") or "").strip().upper() 

    if not all([first_name, last_name, user_id, email, password, program]):
        return jsonify({"error": "Missing required fields"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if program not in ["BSINFOTECH", "BSCS"]:
        return jsonify({"error": "Invalid program. Only BSINFOTECH or BSCS allowed."}), 400

    if find_admin_by_user_id(user_id):
        return jsonify({"error": "User ID already exists"}), 409

    if find_admin_by_email(email):
        return jsonify({"error": "Email already exists"}), 409
    
    hashed_password = generate_password_hash(password)
    full_name = f"{first_name} {last_name}".strip()

    admin_data = {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "user_id": user_id,
        "email": email,
        "password": hashed_password,
        "program": program, 
        "created_at": datetime.utcnow(),
    }

    create_admin(admin_data)

    return jsonify({"message": f"Admin for {program} registered successfully"}), 201

#Admin Login
@admin_bp.route("/api/admin/login", methods=["POST"])
def login_admin():
    data = request.get_json() or {}
    user_id = (data.get("user_id") or "").strip()
    password = data.get("password") or ""

    admin = admins_col.find_one({"user_id": user_id})
    if not admin:
        return jsonify({"error": "Invalid User ID"}), 401
    
    if not check_password_hash(admin["password"], password):
        return jsonify({"error": "Incorrect password"}), 401
    
    program = admin.get("program")

    token = create_access_token(
        identity=user_id,
        additional_claims={
            "role": "admin",
            "program": program
        },
        expires_delta=timedelta(hours=12),
    )

    return jsonify(
        {
            "token": token,
            "message": "Login successful",
            "admin": {
                "user_id": admin.get("user_id"),
                "first_name": admin.get("first_name"),
                "last_name": admin.get("last_name"),
                "program": program,
            },
        }
    ), 200

#Admin Profile (for Student Register Face)
@admin_bp.route("/api/admin/profile", methods=["GET"])
@jwt_required()
def get_admin_profile():
    claims = get_jwt()
    admin_id = claims.get("sub")
    program = claims.get("program")

    admin_doc = admins_col.find_one({"user_id": admin_id})
    if not admin_doc:
        return jsonify({"error": "Admin not found"}), 404
    
    return jsonify({
        "user_id": admin_doc.get("user_id"),
        "first_name": admin_doc.get("first_name"),
        "last_name": admin_doc.get("last_name"),
        "email": admin_doc.get("email"),
        "program": admin_doc.get("program", program or "Unknown Program")
    }), 200

