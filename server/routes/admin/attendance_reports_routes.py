from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from config.db_config import db
from bson import ObjectId
from . import admin_bp

attendance_logs_col = db["attendance_logs"]

@admin_bp.route("/api/admin/attendance/logs", methods=["GET"])
@jwt_required()
def get_attendance_logs():
    try: 
        claims = get_jwt()
        admin_program = claims.get("program", "").upper()
        all_sessions = []
        query = {"course": admin_program}
        cursor = attendance_logs_col.find(query).sort("date", -1)

        for doc in cursor:
            session = {
                "_id": str(doc.get("_id")),
                "class_id": str(doc.get("class_id")),
                "date": doc.get("date"),
                "course": doc.get("course", ""),
                "section": doc.get("section", ""),
                "subject_code": doc.get("subject_code", ""),
                "subject_title": doc.get("subject_title", ""),
                "instructor_first_name": doc.get("instructor_first_name", ""),
                "instructor_last_name": doc.get("instructor_last_name", ""),
                "instructor_id": doc.get("instructor_id", ""),
                "semester": doc.get("semester", ""),
                "school_year": doc.get("school_year", ""),
                "created_by": doc.get("created_by", ""),
                "students": doc.get("students", [])
            }
            all_sessions.append(session)

        return jsonify({ "attendance_logs": all_sessions, "message": f"Successfully Fetch all the logs for {admin_program}"})
        
    except Exception:
        return jsonify({"error": "Failed to load attendance logs"}), 500

