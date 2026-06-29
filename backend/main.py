import os
import glob
import uuid
import shutil
import subprocess
import threading
import time
from typing import List, Optional, Dict, Any

# Ensure ffmpeg installed via winget or elsewhere is on PATH
ffmpeg_found = shutil.which("ffmpeg")
if not ffmpeg_found:
    search_pattern = os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\**\ffmpeg.exe")
    matches = glob.glob(search_pattern, recursive=True)
    if matches:
        ffmpeg_dir = os.path.dirname(matches[0])
        os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ["PATH"]
        print(f"Added FFmpeg to PATH: {ffmpeg_dir}")

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
import ffmpeg

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
AUDIO_DIR = "audio"
TRANSCRIPT_DIR = "transcripts"
EXPORT_DIR = "exports"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# Global job status store
jobs: Dict[str, Dict[str, Any]] = {}

# Load high-accuracy Whisper medium model once
print("Loading Whisper medium model...")
model = WhisperModel("medium", device="cpu", compute_type="int8")
print("Whisper medium model loaded successfully.")

class WordInfo(BaseModel):
    word: str
    start: float
    end: float

class SegmentRequest(BaseModel):
    id: str
    videoId: str
    speaker: str
    text: str
    startTime: float
    endTime: float
    videoStartTime: float
    videoEndTime: float
    words: Optional[List[WordInfo]] = None

class ExportRequest(BaseModel):
    segments: List[SegmentRequest]
    includeSubtitles: bool = True
    format: str = "mp4"

class SubtitleExportRequest(BaseModel):
    segments: List[SegmentRequest]
    format: str = "srt"

@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

def run_transcribe_task(job_id: str, video_path: str, video_id: str, filename: str, speaker: Optional[str], language: Optional[str]):
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = 15
        jobs[job_id]["message"] = "Extracting audio with FFmpeg..."

        audio_filename = f"{video_id}.wav"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)
        
        (
            ffmpeg
            .input(video_path)
            .output(audio_path, acodec='pcm_s16le', ac=1, ar='16000')
            .overwrite_output()
            .run(quiet=True)
        )

        jobs[job_id]["progress"] = 40
        jobs[job_id]["message"] = "Transcribing audio with Whisper medium model..."

        transcribe_args = {
            "beam_size": 5,
            "vad_filter": True,
            "word_timestamps": True,
            "condition_on_previous_text": False
        }
        if language:
            transcribe_args["language"] = language

        segments_generator, info = model.transcribe(audio_path, **transcribe_args)
        
        parsed_segments = []
        seg_idx = 0
        speaker_name = speaker or "Speaker 1"
        
        for segment in segments_generator:
            text_clean = segment.text.strip()
            if not text_clean:
                continue
                
            words_list = []
            if hasattr(segment, 'words') and segment.words:
                for w in segment.words:
                    words_list.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 2),
                        "end": round(w.end, 2)
                    })

            parsed_segments.append({
                "id": f"{video_id}-{seg_idx}",
                "text": text_clean,
                "startTime": round(segment.start, 2),
                "endTime": round(segment.end, 2),
                "speaker": speaker_name,
                "confidence": round(float(segment.avg_logprob), 2) if hasattr(segment, 'avg_logprob') else 0.9,
                "words": words_list
            })
            seg_idx += 1

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["message"] = "Transcription completed successfully"
        jobs[job_id]["result"] = {
            "videoId": video_id,
            "filename": filename,
            "duration": round(info.duration, 2) if hasattr(info, 'duration') else 0,
            "segments": parsed_segments
        }

    except Exception as e:
        print(f"Async transcription error: {str(e)}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["message"] = f"Transcription failed: {str(e)}"

@app.post("/transcribe/")
async def transcribe_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    speaker: Optional[str] = Form(None),
    language: Optional[str] = Form("en")
):
    try:
        video_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1] or ".mp4"
        video_filename = f"{video_id}{file_extension}"
        video_path = os.path.join(UPLOAD_DIR, video_filename)
        
        with open(video_path, "wb") as f:
            content = await file.read()
            f.write(content)

        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "id": job_id,
            "type": "transcribe",
            "status": "pending",
            "progress": 5,
            "message": "File uploaded. Starting background transcription job...",
            "result": None,
            "error": None
        }

        background_tasks.add_task(run_transcribe_task, job_id, video_path, video_id, file.filename, speaker, language)
        return {"jobId": job_id}

    except Exception as e:
        print(f"Transcription upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def run_export_task(job_id: str, req: ExportRequest):
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = 10
        jobs[job_id]["message"] = "Preparing segment clips..."

        export_id = str(uuid.uuid4())
        output_filename = f"podcast_{export_id}.mp4"
        output_path = os.path.join(EXPORT_DIR, output_filename)
        
        temp_clips = []
        total_segs = len(req.segments)
        
        for idx, seg in enumerate(req.segments):
            matching_files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(seg.videoId)]
            if not matching_files:
                continue
            
            source_video = os.path.join(UPLOAD_DIR, matching_files[0])
            clip_path = os.path.join(EXPORT_DIR, f"temp_{export_id}_{idx}.mp4")
            temp_clips.append(clip_path)
            
            duration = max(0.1, seg.videoEndTime - seg.videoStartTime)
            
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(seg.videoStartTime),
                "-i", source_video,
                "-t", str(duration),
                "-c:v", "libx264", "-c:a", "aac",
                "-strict", "-2",
                clip_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            
            # Update progress dynamically
            clip_prog = 10 + int(((idx + 1) / total_segs) * 70)
            jobs[job_id]["progress"] = clip_prog
            jobs[job_id]["message"] = f"Rendered clip {idx+1} of {total_segs}..."

        if not temp_clips:
            raise HTTPException(status_code=400, detail="Failed to process video clips")

        jobs[job_id]["progress"] = 85
        jobs[job_id]["message"] = "Concatenating video timeline with FFmpeg..."

        concat_list_path = os.path.join(EXPORT_DIR, f"concat_{export_id}.txt")
        with open(concat_list_path, "w", encoding="utf-8") as f:
            for clip in temp_clips:
                clean_path = clip.replace("\\", "/")
                f.write(f"file '{clean_path}'\n")

        concat_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path,
            "-c", "copy",
            output_path
        ]
        subprocess.run(concat_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        for clip in temp_clips:
            if os.path.exists(clip):
                os.remove(clip)
        if os.path.exists(concat_list_path):
            os.remove(concat_list_path)

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["message"] = "Export completed successfully"
        jobs[job_id]["result"] = {"downloadUrl": f"http://localhost:8000/download_export/{output_filename}"}

    except Exception as e:
        print(f"Async export error: {str(e)}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["message"] = f"Export failed: {str(e)}"

@app.post("/export/")
async def export_podcast(req: ExportRequest, background_tasks: BackgroundTasks):
    try:
        if not req.segments:
            raise HTTPException(status_code=400, detail="No segments provided for export")

        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "id": job_id,
            "type": "export",
            "status": "pending",
            "progress": 5,
            "message": "Starting video encoding job...",
            "result": None,
            "error": None
        }

        background_tasks.add_task(run_export_task, job_id, req)
        return {"jobId": job_id}

    except Exception as e:
        print(f"Export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def format_timestamp_srt(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds % 1) * 1000))
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds % 1) * 1000))
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

@app.post("/export_subtitles/")
async def export_subtitles(req: SubtitleExportRequest):
    try:
        if not req.segments:
            raise HTTPException(status_code=400, detail="No segments provided for subtitle export")

        export_id = str(uuid.uuid4())
        ext = req.format.lower()
        if ext not in ["srt", "vtt"]:
            ext = "srt"
            
        output_filename = f"subtitles_{export_id}.{ext}"
        output_path = os.path.join(EXPORT_DIR, output_filename)
        
        with open(output_path, "w", encoding="utf-8") as f:
            if ext == "vtt":
                f.write("WEBVTT\n\n")
                
            for idx, seg in enumerate(req.segments, start=1):
                start_str = format_timestamp_srt(seg.startTime) if ext == "srt" else format_timestamp_vtt(seg.startTime)
                end_str = format_timestamp_srt(seg.endTime) if ext == "srt" else format_timestamp_vtt(seg.endTime)
                
                if ext == "srt":
                    f.write(f"{idx}\n")
                    f.write(f"{start_str} --> {end_str}\n")
                    f.write(f"[{seg.speaker}] {seg.text}\n\n")
                else:
                    f.write(f"{start_str} --> {end_str}\n")
                    f.write(f"<v {seg.speaker}>{seg.text}\n\n")

        return {"downloadUrl": f"http://localhost:8000/download_export/{output_filename}"}
    except Exception as e:
        print(f"Subtitle export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download_export/{file_name}")
def download_export(file_name: str):
    file_path = os.path.join(EXPORT_DIR, file_name)
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Exported file not found"})
    return FileResponse(file_path, media_type='application/octet-stream', filename=file_name)