import torch
import insightface
from insightface.app import FaceAnalysis

app = FaceAnalysis(name='buffalo_m', providers=['CUDAExecutionProvider'])
app.prepare(ctx_id=0)

torch.save(app.models['recognition'].model.state_dict(), "backbone_ir50_buffalo.pth")
print("✅ Buffalo_M weights extracted to: backbone_ir50_buffalo.pth")