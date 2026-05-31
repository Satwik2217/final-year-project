from services.neurowell_brain import generate_neurowell_response


def generate_humanized_response(
    text: str,
    text_emotion: str,
    facial_emotion: str,
    distortion: str,
    contradiction: dict,
    safety: dict,
    rag_context: dict,
    conversation_messages: list[dict] | None = None,
    emotion_history: list[dict] | None = None,
    user_name: str | None = None,
    action_units: str = "None",
    sentiment_label: str = "",
    confidence_score: float = 0,
) -> dict:
    return generate_neurowell_response(
        user_text=text,
        text_emotion=text_emotion,
        facial_emotion=facial_emotion,
        action_units=action_units,
        distortion=distortion,
        contradiction=contradiction,
        safety=safety,
        conversation_messages=conversation_messages or [],
        emotion_history=emotion_history or [],
        user_name=user_name,
        rag_context=rag_context,
    )
