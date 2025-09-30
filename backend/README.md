# Podcast Editor Backend

This backend provides:
- Video upload endpoint
- Audio extraction from video
- Transcription using faster-whisper (local, free, fast)
- Transcript file download

## Setup

1. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Make sure ffmpeg is installed and available in your PATH.
   - [Download ffmpeg](https://ffmpeg.org/download.html)

3. Run the server:

```bash
uvicorn main:app --reload
```

## API Endpoints

### 1. Upload Video
- **POST** `/upload_video/`
- Form-data: `file` (video file)
- Returns: `{ "transcript_file": "transcripts/<id>.txt" }`

### 2. Download Transcript
- **GET** `/download_transcript/{file_name}`
- Returns: `.txt` transcript file

---

**Note:**
- Uses [faster-whisper](https://github.com/SYSTRAN/faster-whisper) for fast, local transcription.
- All processing is local and free. 