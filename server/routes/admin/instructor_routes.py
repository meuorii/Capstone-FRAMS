from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from config.db_config import db
from bson import ObjectId
from . import admin_bp

instructors_col = db["instructors"]
classes_col = db["classes"]

#Helpers
def serialize_class(cls):
    students = cls.get("students", [])
    return {
        "_id": str(cls.get("_id")),
        "subject_code": cls.get("subject_code"),
        "subject_title": cls.get("subject_title"),
        "course": cls.get("course"),
        "year_level": cls.get("year_level"),
        "semester": cls.get("semester"),
        "school_year": cls.get("school_year"),
        "section": cls.get("section"),
        "instructor_id": cls.get("instructor_id"),
        "instructor_first_name": cls.get("instructor_first_name"),
        "instructor_last_name": cls.get("instructor_last_name"),
        "schedule_blocks": cls.get("schedule_blocks", []),
        "student_count": len(students),
        "students": students,
        "created_at": cls.get("created_at"),
    }

#Get All Instructors
@admin_bp.route("/api/admin/instructors", methods=["GET"])
def get_all_instructors():
    instructors = list(instructors_col.find().sort("first_name", 1))
    formatted = []

    for instr in instructors:
        embeddings = instr.get("embeddings", {})
        formatted.append(
            {
                "_id": str(instr.get("_id")),
                "instructor_id": instr.get("instructor_id"),
                "first_name": instr.get("first_name"),
                "last_name": instr.get("last_name"),
                "email": instr.get("email"),
                "registered": instr.get("registered", False),
                "embeddings": list(embeddings.keys()) if embeddings else [],
            }
        )

    return jsonify(formatted), 200

#Get Instructorr Classes
@admin_bp.route("/api/admin/instructors/<instructor_id>/classes", methods=["GET"])
@jwt_required()
def get_classes_by_instructor(instructor_id):
    claims = get_jwt()
    admin_program = claims.get("program", "").upper()

    classes = list(classes_col.find({
        "instructor_id": instructor_id,
        "course": {"$regex": f"^{admin_program}$", "$options": "i"}
    }))

    serialize = [serialize_class(cls) for cls in classes]

    return jsonify({ "assigned_class": serialize, "message": "Successfull Get Instructor Classes" })

#Assign Instructors to Classes
@admin_bp.route("/api/admin/classes/<class_id>/assign-instructor", methods=["PUT"])
@jwt_required()
def assign_instructor_to_class(class_id):
    try:
        admin_program = get_jwt().get("program", "").upper()
        try:
            cls = classes_col.find_one({"_id": ObjectId(class_id)})
        except Exception:
            return jsonify({"error": "Invalid class ID"}), 400
        
        if not cls:
            return jsonify({"error": "Class not found"}), 404
        
        if cls.get("course", "").upper() != admin_program:
            return jsonify({ "error": "Forbidden: You cannot assign instructors to another program’s class" }), 403
        
        data = request.get_json() or {}
        instructor_id = data.get("instructor_id")
        if not instructor_id:
            return jsonify({"error": "Instructor ID is required"}), 400
        
        instructor = instructors_col.find_one({"instructor_id": instructor_id})
        if not instructor:
            return jsonify({"error": "Instructor not found"}), 404
        
        update_data = {
            "instructor_id": instructor.get("instructor_id"),
            "instructor_first_name": instructor.get("first_name", "N/A"),
            "instructor_last_name": instructor.get("last_name", "N/A"),
        }

        classes_col.update_one(
            {"_id": ObjectId(class_id)},
            {"$set": update_data}
        )

        return jsonify({
            "message": "Instructor assigned successfully",
            "class_id": class_id,
            "instructor": {
                "instructor_id": update_data["instructor_id"],
                "first_name": update_data["instructor_first_name"],
                "last_name": update_data["instructor_last_name"]
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
    
#Get Free Class to Assign Instructor
@admin_bp.route("/api/admin/classes/free", methods=["GET"])
@jwt_required()
def get_free_class():
     admin_program = get_jwt().get("program", "").upper()
     if not admin_program:
         return jsonify([]), 200
     
     free_classes = list(classes_col.find({
         "course": {"$regex": f"^{admin_program}$", "$options": "i"},
         "$or": [
             {"instructor_id": {"$exists": False}},
             {"instructor_id": ""},
             {"instructor_id": None}
         ]
     }).sort("created_at", -1))

     return jsonify([serialize_class(cls) for cls in free_classes]), 200