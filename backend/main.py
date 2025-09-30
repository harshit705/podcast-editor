import os
import uuid
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from faster_whisper import WhisperModel
import ffmpeg
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend URL for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
AUDIO_DIR = "audio"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

# Load Whisper model once
model = WhisperModel("base", device="cpu", compute_type="int8")

@app.post("/upload_video/")
async def upload_video(file: UploadFile = File(...)):
    # Save uploaded video
    video_id = str(uuid.uuid4())
    video_path = os.path.join(UPLOAD_DIR, f"{video_id}_{file.filename}")
    with open(video_path, "wb") as f:
        f.write(await file.read())

    # Extract audio
    audio_path = os.path.join(AUDIO_DIR, f"{video_id}.wav")
    (
        ffmpeg
        .input(video_path)
        .output(audio_path, acodec='pcm_s16le', ac=1, ar='16000')
        .overwrite_output()
        .run(quiet=True)
    )

    # Transcribe audio
    segments, info = model.transcribe(audio_path)
    transcript = ""
    for segment in segments:
        transcript += segment.text + "\n"

    # Save transcript
    transcript_path = os.path.join(TRANSCRIPT_DIR, f"{video_id}.txt")
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(transcript)

    return {"transcript_file": transcript_path}

@app.get("/download_transcript/{file_name}")
def download_transcript(file_name: str):
    transcript_path = os.path.join(TRANSCRIPT_DIR, file_name)
    if not os.path.exists(transcript_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    return FileResponse(transcript_path, media_type='text/plain', filename=file_name) 