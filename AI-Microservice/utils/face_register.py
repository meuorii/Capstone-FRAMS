import logging
import cv2
import base64
import numpy as np
import mediapipe as mp
from datetime import datetime
from utils.model_loader import get_face_model

face_model = get_face_model()

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True)

def get_face_angle(landmarks, w, h):
    try:
        nose = landmarks[1]
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        mouth = landmarks[13]
        nose_y = nose.y * h
        eye_mid_y = ((left_eye.y + right_eye.y) / 2) * h
        mouth_y = mouth.y * h

        eye_dist = right_eye.x - left_eye.x
        nose_pos = (nose.x - left_eye.x) / (eye_dist + 1e-6)
        up_down_ratio = abs(nose_y - eye_mid_y) / (abs(mouth_y - nose_y) + 1e-6)

        if nose_pos > 0.65: 
            return "right"
        elif nose_pos < 0.35:
            return "left"
        elif up_down_ratio > 1.6:
            return "down"
        elif up_down_ratio < 0.55:
            return "up"
        return "front"
    except Exception as e:
        logging.warning(f"Angle detection failed: {str(e)}")
        return "front"

def register_face_auto(data):
    try:
        student_id = data.get("student_id")
        base64_image = data.get("image")
        angle_from_frontend = data.get("angle")

        # --- Input validation ---
        if not student_id or not base64_image:
            return {"success": False, "error": "Missing student_id or image"}

        if not base64_image.startswith("data:image"):
            return {"success": False, "error": "Invalid image format"}

        # --- Decode image ---
        try:
            img_bytes = base64.b64decode(base64_image.split(",")[1])
            img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return {"success": False, "error": "Image decoding failed"}
        except Exception as e:
            logging.warning(f"Base64 decoding error: {str(e)}")
            return {"success": False, "error": "Invalid image format"}

        # --- FaceMesh: detect face and get angle ---
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        angle = (angle_from_frontend or "unknown").lower()

        if results.multi_face_landmarks:
            h, w = img.shape[:2]
            landmarks = results.multi_face_landmarks[0].landmark
            detected_angle = get_face_angle(landmarks, w, h).lower()
            if angle == "unknown":
                angle = detected_angle
        elif not angle_from_frontend:
            logging.warning(f"[{student_id}] No face detected by FaceMesh and no frontend angle provided.")
            return {"success": False, "error": "No face detected", "angle": "unknown"}

        logging.info(f"[{student_id}] Detected angle: {angle}")

        # --- Per-angle image enhancement ---
        if angle in ("down", "right"):
            logging.info(f"[{student_id}] Enhancing image for {angle.upper()} angle...")
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.3, beta=25)
            img = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

        # --- ArcFace model check ---
        if face_model is None:
            logging.error("Face model is not initialized.")
            return {"success": False, "error": "Face model not initialized"}

        # --- ArcFace: extract embedding ---
        # Use original image for detection as it's more accurate than 112x112 resize
        faces = face_model.get(img) 

        # Fix 3: Return success=False on no detection — clear failure signal
        if not faces:
            logging.warning(f"[{student_id}] ArcFace found no faces for angle: {angle}. Image may be blurry or out of frame.")
            return {
                "success": False,
                "error": f"No face detected by model for angle: {angle}",
                "angle": angle,
            }

        if not hasattr(faces[0], "embedding"):
            logging.warning(f"[{student_id}] ArcFace returned no embedding for angle: {angle}.")
            return {
                "success": False,
                "error": f"Could not extract embedding for angle: {angle}",
                "angle": angle,
            }

        # --- Normalize embedding ---
        embedding = np.array(faces[0].embedding, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        if norm == 0:
            logging.warning(f"[{student_id}] Zero-norm embedding for angle: {angle}.")
            return {
                "success": False,
                "error": f"Invalid embedding (zero norm) for angle: {angle}",
                "angle": angle,
            }

        embedding = embedding / norm
        logging.info(f"[{student_id}] | Angle: {angle} | Embedding norm: {np.linalg.norm(embedding):.4f}")

        return {
            "success": True,
            "message": f"Face registered successfully for {student_id} (angle: {angle})",
            "student_id": student_id,
            "angle": angle,
            "embeddings": {angle: embedding.tolist()},
            "created_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logging.error(f"[register_face_auto] Exception for student_id={data.get('student_id')}: {str(e)}")
        return {"success": False, "error": "Internal server error"}


def register_instructor_face(data):
    try:
        instructor_id = data.get("instructor_id")
        base64_image = data.get("image")
        angle_from_frontend = data.get("angle")

        if not instructor_id or not base64_image:
            return {"success": False, "error": "Missing instructor_id or image"}

        img_bytes = base64.b64decode(base64_image.split(",")[1])
        img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return {"success": False, "error": "Image decoding failed"}

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        angle = (angle_from_frontend or "unknown").lower()

        if results.multi_face_landmarks:
            h, w = img.shape[:2]
            landmarks = results.multi_face_landmarks[0].landmark
            detected_angle = get_face_angle(landmarks, w, h).lower()
            if angle == "unknown":
                angle = detected_angle
        elif not angle_from_frontend:
            logging.warning("No face detected by FaceMesh and no frontend angle provided.")
            return {"success": False, "error": "No face detected"}

        logging.info(f"Detected angle: {angle}")

        faces = face_model.get(img)
        if not faces:
            logging.warning(f"No faces detected by ArcFace model for {angle}. Image might be blurry or out of frame.")
            return {"success": False, "warning": f"Weak capture for {angle}. No embedding generated."}

        if not hasattr(faces[0], "embedding"):
            logging.warning(f"No valid embedding extracted for {angle}.")
            return {"success": False, "warning": f"Weak embedding for {angle}"}

        embedding = np.array(faces[0].embedding, dtype=np.float32)
        embedding = embedding / np.linalg.norm(embedding)

        return {
            "success": True,
            "instructor_id": instructor_id,
            "angle": angle,
            "embeddings": {angle: embedding.tolist()},
            "created_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logging.error(f"register_instructor_face() Exception: {str(e)}")
        return {"success": False, "error": "Internal server error"}