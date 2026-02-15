from flask import request, jsonify
from datetime import datetime, date
from config.db_config import db
from flask_jwt_extended import jwt_required
from . import admin_bp
import os

subjects_col = db["subjects"]
semesters_col = db["semesters"]

#Helpers
def today_str_utc():
    return datetime.utcnow().strftime("%Y-%m-%d")

def to_date_str(dt):
    if not dt:
        return None
    if isinstance(dt, datetime): 
        return dt.strftime("%Y-%m-%d")
    if isinstance(dt, date):
        return dt.strftime("%Y-%m-%d")
    return str(dt)[:10]

def serialize_subject(s):
    return{
        "_id": str(s["_id"]),
        "subject_code": s.get("subject_code"),
        "subject_title": s.get("subject_title"),
        "course": s.get("course"),
        "year_level": s.get("year_level"),
        "semester": s.get("semester"),
        "curriculum": s.get("curriculum")
    }

def normalize_semester(name: str):
    name = name.lower().strip()
    if "1st" in name:
        return "1st Sem"
    if "2nd" in name:
        return "2nd Sem"
    if "summer" in name:
        return "Summer"
    return name.title()

#Get Current Semester
@admin_bp.route("/api/admin/semester/current", methods=["GET"])
@jwt_required()
def get_current_semester():
    try:
        sem = semesters_col.find_one()
        if not sem:
            return jsonify({"error": "No semester found"}), 404
        
        sem["_id"] = str(sem["_id"])
        return jsonify(sem), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#Update Semester
@admin_bp.route("/api/admin/semester", methods=["PUT"])
def update_single_semester():
    try:
        data = request.get_json() or {}
        required = ["semester_name", "start_date", "end_date"]
        if not all(data.get(f) for f in required):
            return jsonify({"error": "Missing required fields"}), 400
        
        normalized_semester = normalize_semester(data["semester_name"])

        start_year = int(data["start_date"][:4])
        start_month = int(data["start_date"][5:7])
        school_year = f"{start_year - 1}-{start_year}" if start_month <= 7 else f"{start_year}-{start_year + 1}"

        update_data = {
            "semester_name": normalized_semester,
            "school_year": school_year,
            "start_date": data["start_date"],
            "end_date": data["end_date"],
            "is_active": True,
        }

        semesters_col.update_one({}, {"$set": update_data})
        sem = semesters_col.find_one()
        sem["_id"] = str(sem["_id"])

        return jsonify({ "message": "Semester updated successfully", "semester": sem }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#Activate Semester
@admin_bp.route("/api/admin/semester/activate", methods=["PUT"])
def activate_single_semester():
    try:
        sem = semesters_col.find_one()
        if not sem:
            return jsonify({"error": "No semester exists"}), 404
        
        normalized_sem = normalize_semester(sem["semester_name"])
        semesters_col.update_one({"_id": sem["_id"]}, {"$set": {"semester_name": normalized_sem, "is_active": True}})

        result = subjects_col.update_many(
            {"semester": {"$regex": f"^{normalized_sem}$", "$options": "i"}},
            {"$set": {"school_year": sem["school_year"]}}
        )

        updated_sem = semesters_col.find_one({"_id": sem["_id"]})
        updated_sem["_id"] = str(updated_sem["_id"])

        return jsonify({ 
            "message": "Semester activated successfully",
            "subjects_updated": result.modified_count,
            "active_semester": updated_sem
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
