from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import requests
import os

# loads openai api key from .env file
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") 
client = OpenAI(api_key=OPENAI_API_KEY)

# stores previous transcript to send openai as  context
transcripts_list = []

def update_transcripts_list(new_transcript):
    transcripts_list.append(new_transcript)
    if len(transcripts_list) > 2:
        transcripts_list.pop(0)  
        

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)

# route to get audio files and send to openai for transcription
@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe():
    audio_file = request.files["file"]

    temp_path = f"/tmp/{audio_file.filename}"
    audio_file.save(temp_path)

    try:
        with open(temp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="gpt-4o-transcribe",  
                file=f
            )
        update_transcripts_list(transcript.text)
        return jsonify({ "text": transcript.text })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    
# route to send transcript and user intent to openai so it analyzes whether the user has completed their intent
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    transcript = data.get("transcript", "")
    intent = data.get("intent", "")

    system_prompt = f"""You're monitoring a conversation. The user's declared their intent to say this in the conversation: "{intent}".
Based on the transcript below, did the user express their intent clearly and directly?

Transcript: "{transcript}"

Answer with a single word: yes or no."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o", 
            messages=[
                {"role": "system", "content": system_prompt}
            ]
        )
        result = response.choices[0].message.content.strip().lower()
        if result not in ["yes", "no"]:
            result = "unclear"

        return jsonify({ "result": result })

    except Exception as e:
        return jsonify({ "error": str(e) }), 500
    
@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

