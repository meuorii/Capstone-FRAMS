import cv2
import base64
import numpy as np
import time
import traceback
from scipy.spatial.distance import cosine
from collections import defaultdict
from utils.model_loader import get_face_model
from utils.anti_spoofing import check_real_or_spoof  # ✅ Anti-spoof check

# ============================================================
# CONFIGURATION
# ============================================================
MATCH_THRESHOLD = 0.55       # ✅ Strict but reliable for ArcFace
PAD_RATIO = 0.0              # ✅ Match Jupyter crop (no extra padding)
MAX_IMG_DIM = 480            # ✅ Speed optimization

# Load ArcFace + RetinaFace once globally
face_model = get_face_model()

# ============================================================
# UTILITIES
# ============================================================
def _expand_and_clip_bbox(bbox, w, h, pad_ratio=0.25):
    """Expand bounding box slightly, clip within frame bounds."""
    if bbox is None or len(bbox) != 4:
        return 0, 0, w - 1, h - 1

    x1, y1, x2, y2 = [int(v) for v in bbox]
    bw, bh = (x2 - x1), (y2 - y1)
    if bw <= 0 or bh <= 0:
        return 0, 0, w - 1, h - 1

    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    side = max(bw, bh) * (1.0 + pad_ratio)
    nx1, ny1 = int(round(cx - side / 2)), int(round(cy - side / 2))
    nx2, ny2 = int(round(cx + side / 2)), int(round(cy + side / 2))
    nx1 = max(0, nx1)
    ny1 = max(0, ny1)
    nx2 = min(w - 1, nx2)
    ny2 = min(h - 1, ny2)
    return nx1, ny1, nx2, ny2


def _pick_primary_face(faces, img_w, img_h):
    """Pick the highest-confidence (or largest) detected face."""
    if not faces:
        return None
    faces = [f for f in faces if getattr(f, "det_score", 0) > 0.5]
    if not faces:
        return None

    def area(b):
        x1, y1, x2, y2 = [int(v) for v in b]
        return max(0, x2 - x1) * max(0, y2 - y1)

    def key(f):
        score = getattr(f, "det_score", 0)
        return score * 1e6 + area(getattr(f, "bbox", [0, 0, img_w, img_h]))

    return max(faces, key=key)


# ============================================================
# FACE MATCHING (ArcFace)
# ============================================================
def find_matching_user(live_embedding, registered_faces, threshold=MATCH_THRESHOLD):
    """Compare live embedding to all registered embeddings."""
    user_scores = defaultdict(list)

    live_embedding = np.array(live_embedding, dtype=np.float32)
    live_embedding /= np.linalg.norm(live_embedding)

    for entry in registered_faces:
        vec = np.array(entry["embedding"], dtype=np.float32)
        vec /= np.linalg.norm(vec)
        score = cosine(live_embedding, vec)
        user_scores[entry["user_id"]].append(score)

    if not user_scores:
        print("❌ No registered users to compare.")
        return None, None

    avg_scores = [(uid, np.mean(scores)) for uid, scores in user_scores.items()]
    avg_scores.sort(key=lambda x: x[1])  # smaller distance = more similar

    print("🔍 Top Match Candidates:")
    for uid, s in avg_scores[:3]:
        print(f"  → {uid} | Avg Cosine Distance: {s:.4f}")

    best_user, best_score = avg_scores[0]

    # Ambiguity check
    if len(avg_scores) > 1:
        second_user, second_score = avg_scores[1]
        diff = abs(second_score - best_score)
        if diff < 0.05:
            print(f"⚠️ Ambiguous match between {best_user} and {second_user} "
                  f"(Δ={diff:.4f}) → rejecting both")
            return None, None
    
    margin = 0.2
    if best_score <= threshold + margin:
        print(f"✅ Borderline accepted: {best_user} (distance={best_score:.4f} ≤ {threshold+margin:.2f})")
        return best_user, best_score
    else:
        print(f"🚫 Rejected match: {best_user} (distance={best_score:.4f} > {threshold+margin:.2f})")
        return None, None


# ============================================================
# MAIN RECOGNITION PIPELINE
# ============================================================
def recognize_face(data):
    """Recognize face using ArcFace + ConvNeXt anti-spoofing (robust version)."""
    try:
        base64_image = data.get("image")
        registered_faces = data.get("registered_faces", [])

        if not base64_image or "," not in base64_image:
            return {"success": False, "error": "Invalid image input"}

        # Decode base64 → OpenCV BGR image
        try:
            img_bytes = base64.b64decode(base64_image.split(",")[1])
            img_bgr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img_bgr is None:
                return {"success": False, "error": "Failed to decode image"}
        except Exception as e:
            print("❌ Image decoding error:", e)
            return {"success": False, "error": "Invalid base64 image"}

        # Resize if too large
        H, W = img_bgr.shape[:2]
        if max(H, W) > MAX_IMG_DIM:
            scale = MAX_IMG_DIM / max(H, W)
            img_bgr = cv2.resize(img_bgr, (int(W * scale), int(H * scale)))

        # ✅ Convert BGR → RGB
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # ---- NEW: Adaptive brightness correction ----
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        if brightness < 60 or brightness > 150:
            print(f"💡 Adjusting lighting (brightness={brightness:.1f}) using CLAHE...")
            lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            img_bgr = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # ---- STEP 1: Detect faces ----
        start = time.time()
        faces = face_model.get(img_rgb)
        print(f"🕒 Detection took {time.time() - start:.2f}s")

        # Retry if no faces found (use CLAHE)
        if not faces:
            print("⚠️ No face detected → applying CLAHE enhancement & retrying...")
            lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            enhanced = cv2.merge((l, a, b))
            img_bgr = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            faces = face_model.get(img_rgb)

        if not faces:
            print("❌ Still no face detected after enhancement.")
            return {"success": False, "error": "No face detected"}

        f = _pick_primary_face(faces, img_rgb.shape[1], img_rgb.shape[0])
        if not f or not hasattr(f, "bbox"):
            return {"success": False, "error": "No valid face bbox"}

        x1, y1, x2, y2 = _expand_and_clip_bbox(
            getattr(f, "bbox"), img_rgb.shape[1], img_rgb.shape[0], pad_ratio=PAD_RATIO
        )
        face_crop = img_bgr[y1:y2, x1:x2]

        if face_crop.size == 0 or face_crop.shape[0] < 40 or face_crop.shape[1] < 40:
            print("⚠️ Invalid face crop, retrying with tighter box...")
            x1, y1, x2, y2 = _expand_and_clip_bbox(getattr(f, "bbox"), img_rgb.shape[1], img_rgb.shape[0], pad_ratio=0)
            face_crop = img_bgr[y1:y2, x1:x2]
            if face_crop.size == 0:
                return {"success": False, "error": "Face crop invalid"}

        print(f"✅ Face detected (score={getattr(f, 'det_score', 0):.3f}) bbox={getattr(f, 'bbox', None)}")

        # ---- STEP 2: Anti-spoofing ----
        is_real, confidence, probs = check_real_or_spoof(face_crop, threshold=0.65)
        print(f"🛡️ Anti-spoof → real={probs['real']:.3f}, spoof={probs['spoof']:.3f}, th=0.50", flush=True)

        if not is_real:
            return {"success": False, "error": "Spoof detected"}
        
        # ---- STEP 3: Ensure embedding is available ----
        if not hasattr(f, "embedding") or f.embedding is None:
            print("⚙️ No embedding found → forcing re-extraction...")
            faces_with_emb = face_model.get(img_rgb)
            if faces_with_emb and hasattr(faces_with_emb[0], "embedding"):
                f.embedding = faces_with_emb[0].embedding
            else:
                return {"success": False, "error": "Failed to extract embedding"}

        live_embedding = np.array(f.embedding, dtype=np.float32)
        live_embedding /= np.linalg.norm(live_embedding)
        print(f"🧠 Live Embedding Norm: {np.linalg.norm(live_embedding):.4f}")

        if not registered_faces:
            return {"success": False, "error": "No registered faces available"}

        # ---- STEP 4: Match ----
        user_id, score = find_matching_user(live_embedding, registered_faces)
        if not user_id:
            return {"success": False, "error": "Face not recognized"}

        print(f"🎯 Recognized {user_id} | distance={score:.4f} | anti-spoof={confidence:.2f}")
        return {
            "success": True,
            "student_id": user_id,
            "match_score": round(score, 4),
            "anti_spoof_confidence": confidence,
            "message": "Face recognized successfully!"
        }

    except Exception:
        print("❌ ERROR in recognize_face():", traceback.format_exc())
        return {"success": False, "error": "Internal server error"}
