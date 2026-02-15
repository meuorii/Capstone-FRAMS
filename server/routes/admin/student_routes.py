from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime
from bson import ObjectId
from config.db_config import db
from . import admin_bp

students_col = db["students"]
attendance_logs_col = db["attendance_logs"]

def _admin_program():
    claims = get_jwt()
    return claims.get("program", "").upper()

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
    