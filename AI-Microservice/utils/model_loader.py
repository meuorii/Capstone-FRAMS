from insightface.app import FaceAnalysis
import numpy as np
import traceback
import onnxruntime as ort 

available_providers = ort.get_available_providers()
gpu_available = 'CUDAExecutionProvider' in available_providers
print("Initializing InsightFace model (buffalo_l)...")
print(f"Available ONNX providers: {available_providers}")
print(f"GPU available: {gpu_available}")

try:
    providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if gpu_available else ['CPUExecutionProvider']
    face_model = FaceAnalysis(name="buffalo_l", providers=providers)
    face_model.prepare(ctx_id=0 if gpu_available else -1, det_size=(320, 320)) 
    print(f" InsightFace model loaded successfully "
          f"({'GPU' if gpu_available else 'CPU'} mode, buffalo_l, det_size=320x320)")
    dummy_img = np.zeros((112, 112, 3), dtype=np.uint8)
    _ = face_model.get(dummy_img)
    print("Warm-up complete — model ready for fast inference!")

except Exception as e:
    print("Failed to load InsightFace model:", e)
    traceback.print_exc()
    face_model = None


def get_face_model():
    return face_model