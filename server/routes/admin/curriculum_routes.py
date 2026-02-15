from flask import jsonify
from config.db_config import db
from . import admin_bp

subjects_col = db["subjects"]

#Get Curriculum
@admin_bp.route("/api/admin/curriculum", methods=["GET"])
def get_curriculums():
    try:
        curr_list = subjects_col.distinct("curriculum")
        curr_list = sorted([str(c).strip() for c in curr_list if c])
        return jsonify({"curriculums": curr_list}), 200
    
    except Exception as e:
        return jsonify({"error": "Failed to load curriculum list"}), 500