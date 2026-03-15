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
        up_down_ratio = (nose_y - eye_mid_y) / (mouth_y - nose_y + 1e-6)
        if nose_pos < 0.35:
            return "right"
        elif nose_pos > 0.75:
            return "left"
        elif up_down_ratio > 1.4:
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
        if not student_id or not base64_image:
            return {"success": False, "error": "Missing student_id or image"}

        if not base64_image.startswith("data:image"):
            return {"success": False, "error": "Invalid image format"}

        try:
            img_bytes = base64.b64decode(base64_image.split(",")[1])
            img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return {"success": False, "error": "Image decoding failed"}
        except Exception as e:
            logging.warning(f"Base64 decoding error: {str(e)}")
            return {"success": False, "error": "Invalid image format"}
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            logging.warning("No face detected by FaceMesh.")
            return {"success": False, "error": "No face detected"}
        
        h, w = img.shape[:2]
        landmarks = results.multi_face_landmarks[0].landmark
        angle = angle_from_frontend or get_face_angle(landmarks, w, h)
        logging.info(f"Detected angle: {angle}")
        if angle.lower() == "down":
            logging.info("Enhancing image for better DOWN-angle detection...")
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.3, beta=25)
            img = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
            y_start = int(h * 0.15)
            y_end = int(h * 0.85)
            img = img[y_start:y_end, :]
            logging.info("Image enhanced for DOWN angle.")
        if angle.lower() == "right":
            logging.info("Enhancing image for better RIGHT-angle detection...")
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            enhanced = cv2.convertScaleAbs(enhanced, alpha=1.3, beta=25)
            img = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
            logging.info("Image enhanced for RIGHT angle.")
        if face_model is None:
            return {"success": False, "error": "Face model not initialized"}

        img = cv2.resize(img, (112, 112))
        faces = face_model.get(img)
        if not faces:
            logging.warning(f"No faces detected by ArcFace model for {angle}. Image might be blurry or out of frame.")
            return {
                "success": True,
                "warning": f"Weak capture for {angle}. No embedding generated.",
                "student_id": student_id,
                "angle": angle,
                "embeddings": {},
            }

        if not hasattr(faces[0], "embedding"):
            logging.warning(f"No valid embedding extracted for {angle}.")
            return {
                "success": True,
                "warning": f"Weak embedding for {angle}",
                "student_id": student_id,
                "angle": angle,
                "embeddings": {},
            }

        embedding = np.array(faces[0].embedding, dtype=np.float32)
        embedding = embedding / np.linalg.norm(embedding)
        logging.info(f"{student_id} | Angle: {angle} | Embedding Norm: {np.linalg.norm(embedding):.4f}")

        return {
            "success": True,
            "message": f"Face registered successfully for {student_id} (angle: {angle})",
            "student_id": student_id,
            "angle": angle,
            "embeddings": {angle: embedding.tolist()},
            "created_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logging.error(f"register_face_auto() Exception: {str(e)}")
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
        if not results.multi_face_landmarks:
            logging.warning("No face detected by FaceMesh.")
            return {"success": False, "error": "No face detected"}

        h, w = img.shape[:2]
        landmarks = results.multi_face_landmarks[0].landmark
        angle = angle_from_frontend or get_face_angle(landmarks, w, h)
        logging.info(f"Detected angle: {angle}")

        img = cv2.resize(img, (112, 112))
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