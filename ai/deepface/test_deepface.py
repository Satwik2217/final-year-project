from deepface import DeepFace

result = DeepFace.analyze(
    "test.jpg",
    actions=['emotion'],
    models_path="ai/deepface/weights"
)
print(result)
