from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from bson import ObjectId
from config.db_config import db
from . import admin_bp

students_col = db["students"]
attendance_logs_col = db["attendance_logs"]

#Get All Students
@admin_bp.route("/api/admin/students", methods=["GET"])
@jwt_required()
def get_all_students():
     claims = get_jwt()
     program = claims.get("program")

     course_filter = {}
     if program:
          course_filter["$or"] = [
            {"Course": {"$regex": f"^{program}$", "$options": "i"}},
            {"course": {"$regex": f"^{program}$", "$options": "i"}},
        ]
          
     students = list(
          students_col.find(
               course_filter, {
                    "_id": 0,
                    "student_id": 1,
                    "First_Name": 1,
                    "Last_Name": 1,
                    "Middle_Name": 1,
                    "Course": 1,
                    "Section": 1,
                    "created_at": 1,
               }    
          )
     )

     normalized = []
     for s in students:
          sid = s.get("student_id") 

          pipeline = [
               {"$unwind": "$students"},
               {"$match": {"students.student_id": sid}},
               {
                    "$group": {
                         "_id": "$students.student_id",
                         "present": { "$sum": {"$cond": [{"$eq": ["$students.status", "Present"]}, 1, 0]} },
                         "late": { "$sum": {"$cond": [{"$eq": ["$students.status", "Late"]}, 1, 0]} },
                         "total": { "$sum": 1 }
                    }
               }
          ]
          agg = list(attendance_logs_col.aggregate(pipeline))

          if agg:
               present = agg[0]["present"]
               late = agg[0]["late"]
               total = agg[0]["total"]
               attendance_rate = (round(((present + late) / total) * 100, 2) if total > 0 else None)
          else:
               attendance_rate = None  

          normalized.append(
               {
                    "student_id": s.get("student_id"),
                    "first_name": s.get("First_Name"),
                    "last_name": s.get("Last_Name"),
                    "middle_name": s.get("Middle_Name"),
                    "course": s.get("Course"),
                    "section": s.get("Section"),
                    "created_at": s.get("created_at"),
                    "attendance_rate": attendance_rate,
               }
          )

     return jsonify(normalized), 200

# Get Single Student via student_id
@admin_bp.route("/api/admin/students/<student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
     claims = get_jwt()
     program = claims.get("program")

     query = { "student_id": student_id }
     if program:
          query["$or"] = [
               {"Course": {"$regex": f"^{program}$", "$options": "i"}},
               {"course": {"$regex": f"^{program}$", "$options": "i"}},
          ]

     student = students_col.find_one(query)
     if not student:
          return jsonify({"error": "Student not found or not in your program"}), 404
     
     pipeline = [
          {"$unwind": "$students"},
          {"$match": {"students.student_id": student_id}},
          {
               "$group": {
                    "_id": "$students.student_id",
                    "present": { "$sum": {"$cond": [{"$eq": ["$students.status", "Present"]}, 1, 0]} },
                    "late": { "$sum": {"$cond": [{"$eq": ["$students.status", "Late"]}, 1, 0]} },
                    "total": {"$sum": 1},
               }
          }
     ]
     agg = list(attendance_logs_col.aggregate(pipeline))

     if agg:
          present = agg[0]["present"]
          late = agg[0]["late"]
          total = agg[0]["total"]
          attendance_rate = (round(((present + late) / total) * 100, 2) if total > 0 else None)
     else:
          attendance_rate = None

     return jsonify (
          {
               "student_id": student.get("student_id"),
               "first_name": student.get("First_Name"),
               "last_name": student.get("Last_Name"),
               "middle_name": student.get("Middle_Name"),
               "course": student.get("Course"),
               "section": student.get("Section"),
               "created_at": student.get("created_at"),
               "attendance_rate": attendance_rate,
          }
     ), 200

#Update Student
@admin_bp.route("/api/admin/students/<student_id>", methods=["PUT"])
def update_student(student_id):
     data = request.get_json() or {}
     update_data = {}

     if "first_name" in data:
          update_data["First_Name"] = data["first_name"]
     if "last_name" in data:
          update_data["Last_Name"] = data["last_name"]
     if "middle_name" in data:
          update_data["Middle_Name"] = data["middle_name"]
     if "course" in data:
          update_data["Course"] = data["course"]
     
     if not update_data:
          return jsonify({ "error": "No valid fields provided" }), 400
     
     result = students_col.update_one({"student_id": student_id}, {"$set": update_data})
     if result.matched_count == 0:
          return jsonify({ "error": "Student not found" }), 404
    
     return jsonify({ "message": "Student updated successfully" }), 200

#Delete Student
@admin_bp.route("/api/admin/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
     try:
          result = students_col.delete_one({"student_id": student_id})
          if result.deleted_count == 0:
               return jsonify({"error": "Student not found"}), 404
          
          return jsonify({ "message": f"Student {student_id} deleted successfully." }), 200
     
     except Exception as e:
          return jsonify({ "error": f"Internal server error: {str(e)}" }), 500
     