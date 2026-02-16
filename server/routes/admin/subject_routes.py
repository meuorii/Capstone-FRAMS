from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from config.db_config import db
from bson import ObjectId
from . import admin_bp

subjects_col = db["subjects"]
semesters_col = db["semesters"]

#Helpers
def serialize_subject(subject):
    return {
        "_id": str(subject.get("_id")),
        "subject_code": subject.get("subject_code"),
        "subject_title": subject.get("subject_title"),
        "course": subject.get("course"),
        "year_level": subject.get("year_level"),
        "semester": subject.get("semester"),
        "curriculum": subject.get("curriculum"),
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

def _admin_program():
    claims = get_jwt()
    return claims.get("program", "").upper()

#Get Subjects
@admin_bp.route("/api/admin/subjects", methods=["GET"])
def get_subjects():
    subjects = list(subjects_col.find().sort("created_at", -1))
    return jsonify([serialize_subject(s) for s in subjects])

#Create Subject
@admin_bp.route("/api/admin/subjects", methods=["POST"])
def create_subject():
    data = request.get_json() or {}
    required_fields = [
        "subject_code",
        "subject_title",
        "course",
        "year_level",
        "semester",
        "curriculum"
    ]

    if not all(data.get(field) for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    subject_doc = {
        "subject_code": data["subject_code"],
        "subject_title": data["subject_title"],
        "course": data["course"],
        "year_level": data["year_level"],
        "semester": data["semester"],
        "curriculum": data["curriculum"],
        "created_at": datetime.utcnow(),
    }

    result = subjects_col.insert_one(subject_doc)
    new_subject = subjects_col.find_one({"_id": result.inserted_id})
    if new_subject:
        new_subject["_id"] = str(new_subject["_id"])

    return jsonify({ "subject": new_subject, "message": "Subject Created Successfully "}), 200

#Get Active Subject
@admin_bp.route("/api/admin/subjects/active", methods=["GET"])
@jwt_required()
def get_active_subjects():
    try:
        admin_program = _admin_program()
        if not admin_program:
            return jsonify({"error": "Admin program not found in token"}), 400
        
        active_sem = semesters_col.find_one({"is_active": True})
        if not active_sem:
            return jsonify({"message": "No active semester found"}), 404
        
        normalized_sem = normalize_semester(active_sem["semester_name"])

        subjects = list(subjects_col.find({
            "semester": normalized_sem,
            "course": {"$regex": f"^{admin_program}$", "$options": "i"}
        }).sort("year_level", 1))

        for subj in subjects:
            subj["_id"] = str(subj["_id"])

        return jsonify({
            "active_semester": {
                "_id": str(active_sem["_id"]),
                "semester_name": active_sem["semester_name"],
                "normalized_semester": normalized_sem,
                "school_year": active_sem["school_year"],
                "program": admin_program
            },
            "subjects": subjects
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Update Subject
@admin_bp.route("/api/admin/subjects/<id>", methods=["PUT"])
def update_subject(id):
    data = request.get_json()
    update_data ={}
    for field in [ "subject_code", "subject_title", "course", "year_level", "semester", "curriculum" ]:
        if field in data:
            update_data[field] = data[field]

    result = subjects_col.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count == 0:
        return jsonify({"error": "Subject not found"}), 404
    
    updated_subject = subjects_col.find_one({"_id": ObjectId(id)})
    updated_subject["_id"] = str(updated_subject["_id"])
    return jsonify({ "updated subject": updated_subject, "message": "Subject updated successfully" }), 200

#Delete Subject
@admin_bp.route("/api/admin/subjects/<id>", methods=["DELETE"])
def delete_subject(id):
    result = subjects_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        return jsonify({"error": "Subject not found"}), 404
    
    return jsonify({ "message": "Subject deleted successfully" }), 200
