from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from bson import ObjectId
from datetime import datetime
import pandas as pd
import re
import pdfplumber
from io import BytesIO
from . import admin_bp
from config.db_config import db

students_col = db["students"]
instructors_col = db["instructors"]
classes_col = db["classes"]
attendance_logs_col = db["attendance_logs"]
subjects_col = db["subjects"]
semesters_col = db["semesters"]

#helper:
def _admin_program():
    claims = get_jwt()
    return claims.get("program", "").upper()

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

def calculate_attendance_rate(class_id: str):
    stats = list(attendance_logs_col.aggregate([
        {"$match": {"class_id": class_id}},
        {"$unwind": "$students"},
        {"$group": {"_id": "$students.status", "count": {"$sum": 1}}}
    ]))

    total_logs = sum(s["count"] for s in stats)
    present_count = sum(s["count"] for s in stats if s["_id"] == "Present")
    late_count = sum(s["count"] for s in stats if s["_id"] == "Late")
    absent_count = sum(s["count"] for s in stats if s["_id"] == "Absent")
    attendance_rate = round(((present_count + late_count) / total_logs) * 100, 2) if total_logs > 0 else 0

    return attendance_rate, {"present": present_count, "late": late_count, "absent": absent_count, "total": total_logs}

#Get All Classes
@admin_bp.route("/api/admin/classes", methods=["GET"])
@jwt_required()
def get_all_classes():
    admin_program = _admin_program()
    active_sem = semesters_col.find_one({"is_active": True})
    if not active_sem:
        return jsonify({"error": "No active semester found"}), 400
    
    classes = list(classes_col.find({
        "course": {"$regex": f"^{admin_program}$", "$options": "i"},
        "semester": active_sem["semester_name"],
        "school_year": active_sem["school_year"]
    }).sort("created_at", -1))

    output = []
    for cls in classes:
        class_id = str(cls["_id"])
        attendance_rate, breakdown = calculate_attendance_rate(class_id)
        cls_data = serialize_class(cls)
        cls_data["attendance_rate"] = attendance_rate
        cls_data["attendance_breakdown"] = breakdown
        output.append(cls_data)

    return jsonify(output), 200

#Create Class
@admin_bp.route("/api/admin/create-class", methods=["POST"])
@jwt_required()
def create_class():
    admin_program = _admin_program() 
    data = request.get_json() or {}
    required_fields = [
        "subject_code",
        "subject_title",
        "course",
        "year_level",
        "section",
        "instructor_id",
    ]

    if not all(data.get(field) for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    if data["course"].upper() != admin_program:
        return jsonify({"error": "You are not allowed to create a class for another program"}), 403
    
    active_sem = semesters_col.find_one({"is_active": True})
    if not active_sem:
        return jsonify({"error": "No active semester found. Please set an active semester first."}), 400
    
    instructor = instructors_col.find_one({"instructor_id": data["instructor_id"]})
    if not instructor:
        return jsonify({"error": "Instructor not found"}), 404
    
    new_class = {
        "subject_code": data["subject_code"],
        "subject_title": data["subject_title"],
        "course": data["course"],
        "year_level": data["year_level"],
        "semester": active_sem["semester_name"],
        "school_year": active_sem["school_year"],
        "section": data["section"],
        "schedule_blocks": data.get("schedule_blocks", []),
        "instructor_id": instructor["instructor_id"],
        "instructor_first_name": instructor["first_name"],
        "instructor_last_name": instructor["last_name"],
        "students": [],
        "is_attendance_active": False,
        "attendance_start_time": None,
        "attendance_end_time": None,
        "created_at": datetime.utcnow(),
    }

    result = classes_col.insert_one(new_class)
    cls = classes_col.find_one({"_id": result.inserted_id})

    return jsonify({ "created_class": serialize_class(cls), "message": "Class Created Successfully" }), 200

#Update Class
@admin_bp.route("/api/admin/update-class/<id>", methods=["PUT"])
@jwt_required()
def update_class(id):
    admin_program = _admin_program()
    data = request.get_json() or {}

    cls = classes_col.find_one({"_id": ObjectId(id)})
    if not cls:
        return jsonify({"error": "Class not found"}), 404
    
    if cls["course"].upper() != admin_program:
        return jsonify({"error": "You are not allowed to modify another program's class"}), 403
    
    update_data = {}

    for field in ["section", "semester", "schedule_blocks"]:
        if field in data:
            update_data[field] = data[field]

    if "instructor_id" in data and data["instructor_id"]:
        instructor = instructors_col.find_one({"instructor_id": data["instructor_id"]})
        if not instructor:
            return jsonify({"error": "Instructor not found"}), 404
        
        update_data["instructor_id"] = instructor["instructor_id"]
        update_data["instructor_first_name"] = instructor["first_name"]
        update_data["instructor_last_name"] = instructor["last_name"]

    if not update_data:
        return jsonify({"error": "No valid fields provided"}), 400
    
    try:
        result = classes_col.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )
    except Exception as e:
        return jsonify({"error": "Invalid class ID"}), 400
    
    if result.matched_count == 0:
        return jsonify({"error": "Class not found"}), 404
    
    return jsonify({"message": "Class updated successfully"}), 200

#Delete Class
@admin_bp.route("/api/admin/delete-class/<id>", methods=["DELETE"])
@jwt_required()
def delete_class(id):
    admin_program = _admin_program()

    try:
        class_id = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid class ID format"}), 400
    
    cls = classes_col.find_one({"_id": class_id})
    if not cls:
        return jsonify({"error": "Class not found"}), 404
    
    if cls["course"].upper() != admin_program:
        return jsonify({"error": "Forbidden: You cannot delete another program’s class"}), 403
    
    try:
        result = classes_col.delete_one({"_id": class_id})
        if result.deleted_count == 0:
            return jsonify({"error": "Failed to delete class"}), 500
        
        return jsonify({"message": f"Class '{cls.get('name', id)}' deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
    
#Upload Student List via PDF (University Format)
@admin_bp.route("/api/admin/<class_id>/upload-students", methods=["POST"])
@jwt_required()
def upload_students_to_class(class_id):
    try:
        admin = get_jwt()
        admin_program = admin.get("program", "").upper()

        cls = classes_col.find_one({"_id": ObjectId(class_id)})
        if not cls:
            return jsonify({"error": "Class not found"}), 404
        
        if cls["course"].upper() != admin_program:
            return jsonify({ "error": "Forbidden — You cannot upload students to another program's class" }), 403
        
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400
        
        file_bytes = BytesIO(file.read())

        with pdfplumber.open(file_bytes) as pdf:
            full_text = "\n".join([ page.extract_text() or "" for page in pdf.pages ])

        lines = full_text.split("\n")

        header_line = next(line for line in lines if "Class List (" in line)
        inside = re.search(r"\((.*?)\)", header_line).group(1)

        school_year, semester_raw = [x.strip() for x in inside.split("/")]

        semester_map = {
            "First Semester": "1st Sem",
            "Second Semester": "2nd Sem",
            "Summer": "Mid Year"
        }
        semester = semester_map.get(semester_raw, semester_raw)
        header_idx = next(i for i, l in enumerate(lines) if "Class List (" in l)
        instructor_raw = lines[header_idx + 1].strip().title()
        name_parts = instructor_raw.split(" ")
        instructor_last_name = name_parts[-1]
        instructor_first_name = " ".join(name_parts[:-1])
        instructor_doc = instructors_col.find_one({ "first_name": instructor_first_name, "last_name": instructor_last_name })

        if not instructor_doc:
            return jsonify({"error": f"Instructor '{instructor_raw}' not found"}), 404
        
        instructor_id = instructor_doc["instructor_id"]

        class_code = None
        for line in lines:
            for line in lines:
                if "Class:" in line:
                    m = re.search(r"Class:\s*([A-Za-z0-9]+)", line)
                    if m:
                        class_code = m.group(1) 
                    break

        course_section = None
        for line in lines:
            if "Class:" in line and "::" in line:
                parts = [p.strip() for p in line.split("::")]
                if len(parts) > 1:
                    course_section = parts[1] 
                break

        if not course_section:
            return jsonify({"error": "Unable to extract course & section"}), 400
        
        course, section = course_section.rsplit(" ", 1)

        if course.upper() != admin_program:
            return jsonify({ "error": f"Course '{course}' does NOT match your program '{admin_program}'" }), 403
        
        subject_code = None
        for line in lines:
            if "Class:" in line and "::" in line:
                parts = [p.strip() for p in line.split("::")]
                if len(parts) > 2:
                    subject_code = parts[2]
                break

        if not subject_code:
            return jsonify({"error": "Unable to extract subject code"}), 400
        
        subject_doc = subjects_col.find_one({"subject_code": subject_code})
        if not subject_doc:
            return jsonify({"error": f"Subject '{subject_code}' not found"}), 404
        
        subject_title = subject_doc["subject_title"]
        year_level = subject_doc["year_level"]
        student_ids = re.findall(r"\b\d{2}-\d-\d-\d{4}\b", full_text)
        if not student_ids:
            return jsonify({"error": "No student IDs found in PDF"}), 400
        
        students_list = []
        skipped_ids = []

        for sid in student_ids:
            stu = students_col.find_one({"student_id": sid})
            if not stu:
                skipped_ids.append(sid)
                continue

            students_list.append({
                "student_id": sid,
                "first_name": stu.get("First_Name", "").strip(),
                "last_name": stu.get("Last_Name", "").strip(),
                "course": stu.get("Course") or course,
                "section": stu.get("Section") or section
            })

        classes_col.update_one(
            {"_id": ObjectId(class_id)},
            {"$set": {
            "class_code": class_code,
            "subject_code": subject_code,
            "subject_title": subject_title,
            "course": course,
            "section": section,
            "year_level": year_level,
            "semester": semester,
            "school_year": school_year,
            "instructor_id": instructor_id,
            "instructor_first_name": instructor_first_name,
            "instructor_last_name": instructor_last_name,
            "students": students_list,
            "schedule_blocks": []
            }}
        )

        return jsonify({
            "message": f"{len(students_list)} students uploaded successfully",
            "uploaded_count": len(students_list),
            "skipped_count": len(skipped_ids),
            "skipped_ids": skipped_ids,
            "class_code": class_code,
            "subject_code": subject_code,
            "subject_title": subject_title,
            "course": course,
            "section": section,
            "school_year": school_year,
            "semester": semester,
            "instructor": f"{instructor_first_name} {instructor_last_name}"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#Preview Class List PDF
@admin_bp.route("/api/admin/class/preview-pdf", methods=["POST"])
@jwt_required()
def preview_class_pdf():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400
        
        file_bytes = BytesIO(file.read())
        with pdfplumber.open(file_bytes) as pdf:
            full_text = "\n".join([ page.extract_text() or "" for page in pdf.pages ])

        lines = full_text.split("\n")
        header_line = next(line for line in lines if "Class List (" in line)
        inside = re.search(r"\((.*?)\)", header_line).group(1)
        school_year, semester_raw = [x.strip() for x in inside.split("/")]
        semester_map = {
            "First Semester": "1st Sem",
            "Second Semester": "2nd Sem",
            "Summer": "Mid Year"
        }
        semester = semester_map.get(semester_raw, semester_raw)
        header_idx = next(i for i, l in enumerate(lines) if "Class List (" in l)
        instructor_raw = lines[header_idx + 1].strip().title()
        name_parts = instructor_raw.split(" ")
        instructor_last_name = name_parts[-1]
        instructor_first_name = " ".join(name_parts[:-1])
        instructor_doc = instructors_col.find_one({
            "first_name": instructor_first_name,
            "last_name": instructor_last_name
        })
        instructor_id = instructor_doc["instructor_id"] if instructor_doc else None

        class_line = next((l for l in lines if l.startswith("Class:")), None)
        if not class_line:
            return jsonify({"error": "Cannot find class line"}), 400
        
        parts = [p.strip() for p in class_line.split("::")]
        m = re.search(r"Class:\s*([A-Za-z0-9]+)", parts[0])
        class_code = m.group(1) if m else None
        course_section = parts[1]  
        course, section = course_section.rsplit(" ", 1)
        subject_code = parts[2]
        subject_doc = subjects_col.find_one({"subject_code": subject_code})
        subject_title = subject_doc["subject_title"] if subject_doc else None
        year_level = subject_doc["year_level"] if subject_doc else None
        student_ids = re.findall(r"\b\d{2}-\d-\d-\d{4}\b", full_text)
        valid_students = []
        skipped_students = []

        for sid in student_ids:
            stu = students_col.find_one({"student_id": sid})
            if stu:
                valid_students.append({
                    "student_id": sid,
                    "first_name": stu.get("First_Name", "").strip(),
                    "last_name": stu.get("Last_Name", "").strip()
                })
            else:
                skipped_students.append(sid)

        return jsonify({
            "preview": True,
            "class_code": class_code,
            "course": course,
            "section": section,
            "school_year": school_year,
            "semester": semester,
            "subject_code": subject_code,
            "subject_title": subject_title,
            "year_level": year_level,
            "instructor_first_name": instructor_first_name,
            "instructor_last_name": instructor_last_name,
            "instructor_id": instructor_id,
            "student_ids": student_ids,
            "valid_students": valid_students,
            "skipped_students": skipped_students,
            "schedule_blocks": []
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500