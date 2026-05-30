from services.rag_engine import generate_grounded_response, retrieve_cbt_context
from services.safety import evaluate_safety
from services.synthesis import detect_contradiction
from services.text_analysis import analyze_text
from services.vision_analysis import analyze_facial


def run_pipeline(text: str, image_base64: str | None = None, session_history: list | None = None) -> dict:
    text_result = analyze_text(text)
    vision_result = analyze_facial(image_base64)
    safety = evaluate_safety(text, text_result["text_emotion"], vision_result["dominant_emotion"])
    contradiction = detect_contradiction(text, text_result["text_emotion"], vision_result["dominant_emotion"])

    rag_context = retrieve_cbt_context(
        text=text,
        distortion=text_result["cognitive_distortion"],
        contradiction=contradiction["contradiction_detected"],
        safety_triggered=safety["safety_triggered"],
    )

    bot_response = generate_grounded_response(
        text=text,
        text_emotion=text_result["text_emotion"],
        facial_emotion=vision_result["dominant_emotion"],
        distortion=text_result["cognitive_distortion"],
        contradiction=contradiction,
        safety=safety,
        rag_context=rag_context,
    )

    history_note = ""
    if session_history:
        recent = session_history[-3:]
        moods = [entry.get("textEmotion") for entry in recent if entry.get("textEmotion")]
        if moods:
            history_note = f" Longitudinal context: recent emotional states include {', '.join(moods)}."

    if history_note and not safety["safety_triggered"]:
        bot_response += history_note

    return {
        "textEmotion": text_result["text_emotion"],
        "facialEmotion": vision_result["dominant_emotion"],
        "actionUnits": vision_result["action_units"],
        "cognitiveDistortion": text_result["cognitive_distortion"],
        "contradictionDetected": contradiction["contradiction_detected"],
        "contradictionMessage": contradiction["contradiction_message"],
        "riskLevel": safety["risk_level"],
        "severityScore": safety["severity_score"],
        "safetyTriggered": safety["safety_triggered"],
        "safetyStatus": safety["safety_status"],
        "botResponse": bot_response,
        "aiSuggestion": rag_context["technique"],
        "retrievedSourceId": rag_context["source_id"],
        "sentimentLabel": text_result["sentiment_label"],
        "confidenceScore": text_result["confidence_score"],
        "visionEngine": vision_result.get("engine", "None"),
    }
