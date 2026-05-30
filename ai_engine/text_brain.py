import sys
import json
import os

# 1. Quiet down any background warning messages from the AI libraries
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from transformers import pipeline

def analyze_text(user_input):
    # REMOVED: The human print statement that was breaking Node.js
    
    # 2. Load the transformer model framework quietly
    nlp_engine = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
    
    # 3. Feed the text into the neural network
    model_prediction = nlp_engine(user_input)[0]
    
    # 4. Clinical CBT Cognitive Distortion classification
    detected_distortion = "None"
    lower_text = user_input.lower()
    
    if "always" in lower_text or "never" in lower_text or "nothing" in lower_text:
        detected_distortion = "Overgeneralization / All-or-Nothing Thinking"
    
    # 5. Pack the mathematical results into a clean dictionary
    output_result = {
        "text_received": user_input,
        "sentiment_label": model_prediction["label"],
        "confidence_score": round(model_prediction["score"], 3),
        "cognitive_distortion": detected_distortion
    }
    
    return json.dumps(output_result)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_phrase = sys.argv[1]
    else:
        test_phrase = "I always feel like everything goes wrong."
        
    final_output = analyze_text(test_phrase)
    
    # CRUCIAL: Print ONLY the raw JSON string data. No headers, no extra text lines!
    print(final_output)