import cv2
import numpy as np
from scipy.spatial.distance import cosine
from collections import defaultdict
from utils.model_loader import get_face_model

face_model = get_face_model()

mp_face_detection = __import__('mediapipe').solutions.face_detection
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.7)

def crop_face_from_image(image):
    rgb_img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = face_detection.process(rgb_img)
    if not result.detections:
        return None

    detection = result.detections[0]
    bbox = detection.location_data.relative_bounding_box
    h, w, _ = image.shape
    x1 = int(max(0, bbox.xmin * w - 10))
    y1 = int(max(0, bbox.ymin * h - 10))
    x2 = int(min(w, (bbox.xmin + bbox.width) * w + 10))
    y2 = int(min(h, (bbox.ymin + bbox.height) * h + 10))

    return image[y1:y2, x1:x2] if x2 > x1 and y2 > y1 else None


# --------------------------
def get_face_embedding(image):
    if face_model is None:
        print("Face model not loaded.")
        return None

    try:
        # Convert to RGB and ensure brightness normalization
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img_rgb = cv2.convertScaleAbs(img_rgb, alpha=1.2, beta=15)  # brighten slightly

        # 🧠 Try detection first
        faces = face_model.get(img_rgb)

        if faces and hasattr(faces[0], 'embedding'):
            embedding = np.array(faces[0].embedding, dtype=np.float32)
            norm = np.linalg.norm(embedding)
            if norm < 1e-3:
                print(f"Detected near-zero embedding (norm={norm:.4f})", flush=True)
            else:
                print(f"Embedding extracted (len={len(embedding)}, norm={norm:.4f})", flush=True)
            embedding /= norm + 1e-6
            return embedding

        print("No face detected — using direct resize fallback.", flush=True)
        resized = cv2.resize(img_rgb, (112, 112))
        resized = resized.astype(np.float32)
        embedding = face_model.models["recognition"].get_feat(resized)
        embedding = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        if norm < 1e-3:
            print(f"Fallback near-zero embedding (norm={norm:.4f})", flush=True)
        else:
            print(f"Fallback embedding extracted (112x112, norm={norm:.4f})", flush=True)
        embedding /= norm + 1e-6
        return embedding

    except Exception as e:
        print("Embedding extraction failed:", e, flush=True)
        return None

def recognize_face(input_embedding, registered_faces, threshold=0.38):
    best_match = None
    min_distance = float('inf')

    for student in registered_faces:
        stored_embedding = np.array(student.get("embedding", []), dtype=float)
        if stored_embedding.size == 0 or len(stored_embedding) != len(input_embedding):
            continue

        stored_embedding /= np.linalg.norm(stored_embedding)
        distance = cosine(input_embedding, stored_embedding)

        if distance < threshold and distance < min_distance:
            min_distance = distance
            best_match = student

    if best_match:
        print(f"Matched with {best_match.get('first_name', '')} "
              f"(distance={min_distance:.4f})")
    else:
        print("No match found.")
    return best_match


def recognize_face_multi_angle(input_embedding, registered_faces, threshold=0.38):
    best_match = None
    min_distance = float('inf')

    for student in registered_faces:
        embeddings_dict = student.get("embeddings", {})
        for angle, stored_embedding in embeddings_dict.items():
            if not stored_embedding or len(stored_embedding) != len(input_embedding):
                continue

            stored_embedding = np.array(stored_embedding, dtype=float)
            stored_embedding /= np.linalg.norm(stored_embedding)
            distance = cosine(input_embedding, stored_embedding)

            if distance < threshold and distance < min_distance:
                min_distance = distance
                best_match = student

    if best_match:
        print(f"Multi-angle match: {best_match.get('first_name', '')} "
              f"(distance={min_distance:.4f})")
    else:
        print("No multi-angle match found.")
    return best_match


# --------------------------
#  5. Angle-Aware Matching (for login)
# --------------------------
def find_matching_user(live_embedding, embeddings, threshold=0.38, target_angle=None):
    user_scores = defaultdict(list)
    live_embedding = live_embedding / np.linalg.norm(live_embedding)  # ⚡ normalize input

    for entry in embeddings:
        if target_angle and entry["angle"] != target_angle:
            continue
        vec = np.array(entry["embedding"], dtype=float)
        vec = vec / np.linalg.norm(vec)
        score = cosine(live_embedding, vec)
        user_scores[entry["user_id"]].append(score)

    if not user_scores:
        print("No embeddings found to compare.")
        return None, None

    avg_scores = [(user, np.mean(scores)) for user, scores in user_scores.items()]
    avg_scores.sort(key=lambda x: x[1])  # smaller distance = closer match

    print("Top Match Candidates:")
    for user_id, score in avg_scores[:5]:
        print(f"  → {user_id} | Avg Distance: {score:.4f}")

    if avg_scores and avg_scores[0][1] < threshold:
        best_user, best_score = avg_scores[0]
        print(f"Final Match: {best_user} (distance={best_score:.4f})")
        return best_user, best_score
    else:
        print("Best match rejected.")
        return None, None
    
# --------------------------
# ⚙️ 6. Multi-Face Detection (for attendance)
# --------------------------
def detect_faces(image):
    if face_model is None:
        print("Face model not loaded.")
        return []

    try:
        rgb_img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        faces = face_model.get(rgb_img)

        detections = []
        for face in faces:
            if not hasattr(face, "bbox") or not hasattr(face, "embedding"):
                continue

            x1, y1, x2, y2 = map(int, face.bbox)
            emb = np.array(face.embedding, dtype=np.float32)
            emb /= np.linalg.norm(emb) + 1e-6  # normalize

            detections.append({
                "bbox": [x1, y1, x2, y2],
                "embedding": emb
            })

        print(f"Detected {len(detections)} face(s) in frame.")
        return detections

    except Exception as e:
        print("detect_faces() failed:", e)
        return []
    
def get_crop_embedding(image):
    if face_model is None:
        print("❌ Face model not loaded.")
        return None

    try:
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        img_rgb = cv2.flip(img_rgb, 1)

        try:
            bboxes, landmarks = face_model.models["detection"].detect(img_rgb)
            if bboxes is not None and len(bboxes) > 0:
                aligned = face_model.models["detection"].align_crop(img_rgb, landmarks[0])
                resized = cv2.resize(aligned, (112, 112))
            else:
                # fallback: center crop only
                resized = cv2.resize(img_rgb, (112, 112))
        except Exception:
            resized = cv2.resize(img_rgb, (112, 112))

        emb = face_model.models["recognition"].get_feat(resized)
        emb = np.array(emb, dtype=np.float32)

        norm = np.linalg.norm(emb) + 1e-6
        if norm < 1e-3:
            print("Near-zero norm embedding (black crop or failed alignment)")
            return None

        emb /= norm
        print(f"Crop embedding extracted (shape={emb.shape}, norm={norm:.4f})")
        return emb

    except Exception as e:
        print("Crop embedding extraction failed:", e)
        return None

