from services.humanized_response import generate_humanized_response
from services.rag_engine import retrieve_cbt_context
from services.safety import evaluate_safety
from services.synthesis import detect_contradiction
from services.text_analysis import analyze_text
from services.vision_analysis import analyze_facial


def run_pipeline(
    text: str,
    image_base64: str | None = None,
    session_history: list | None = None,
    conversation_messages: list | None = None,
    user_name: str | None = None,
) -> dict:
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

    humanized = generate_humanized_response(
        text=text,
        text_emotion=text_result["text_emotion"],
        facial_emotion=vision_result["dominant_emotion"],
        distortion=text_result["cognitive_distortion"],
        contradiction=contradiction,
        safety=safety,
        rag_context=rag_context,
        conversation_messages=conversation_messages or [],
        emotion_history=session_history or [],
        user_name=user_name,
        action_units=vision_result["action_units"],
        sentiment_label=text_result["sentiment_label"],
        confidence_score=text_result["confidence_score"],
    )

    return {
        "textEmotion": text_result["text_emotion"],
        "facialEmotion": vision_result["dominant_emotion"],
        "actionUnits": vision_result["action_units"],
        "cognitiveDistortion": text_result["cognitive_distortion"],
        "contradictionDetected": contradiction["contradiction_detected"],
        "contradictionType": contradiction.get("contradiction_type"),
        "contradictionMessage": contradiction["contradiction_message"],
        "detectedEmotions": contradiction.get("detected_emotions", {}),
        "emotionSummary": humanized.get("emotion_summary", ""),
        "riskLevel": safety["risk_level"],
        "severityScore": safety["severity_score"],
        "safetyTriggered": safety["safety_triggered"],
        "safetyStatus": safety["safety_status"],
        "botResponse": humanized["response"],
        "quickReplies": humanized["follow_up_suggestions"],
        "aiSuggestion": humanized["technique_used"],
        "retrievedSourceId": rag_context["source_id"],
        "retrievedSourceIds": rag_context.get("source_ids", []),
        "sentimentLabel": text_result["sentiment_label"],
        "confidenceScore": text_result["confidence_score"],
        "visionEngine": vision_result.get("engine", "None"),
    }
