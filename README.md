# 🎙️ AI Podcast Editor

An AI-powered, multi-speaker video podcast editing suite built with React, TypeScript, Vite, FastAPI, faster-whisper, and FFmpeg.

---

## 📁 Comprehensive Directory Structure

```text
podcast-editor/
├── frontend/                     # React + Vite + TypeScript UI codebase
│   ├── src/
│   │   ├── components/           # Modular UI Wizard Panels
│   │   │   ├── VideoUploader.tsx      # Step 1: Multi-video drag-and-drop uploader
│   │   │   ├── TranscriptionPanel.tsx # Step 2: Async AI transcription & job progress
│   │   │   ├── SpeakerSwitcher.tsx    # Step 3: Interactive timeline editor & speaker switching
│   │   │   └── ExportPanel.tsx       # Step 4: Video MP4 & subtitle exporter (.srt / .vtt)
│   │   ├── pages/
│   │   │   └── Index.tsx         # Main wizard orchestrator & persistent state container
│   │   ├── utils/
│   │   │   └── videoProcessor.ts # Data structures & timeline interfaces
│   │   ├── App.tsx               # App routes & query provider setup
│   │   └── main.tsx              # React DOM mounting point
│   ├── public/                   # Web application static assets
│   ├── package.json              # Frontend scripts & dependencies
│   └── vite.config.ts            # Vite dev server configuration
├── backend/                      # Python FastAPI server & AI processing engine
│   ├── main.py                   # Async job manager, Whisper model, & FFmpeg exporter
│   ├── requirements.txt          # Python dependencies (fastapi, faster-whisper, etc.)
│   ├── uploads/                  # Raw uploaded video storage
│   ├── audio/                    # Extracted 16kHz mono WAV audio tracks
│   ├── transcripts/              # AI transcript JSON cache
│   └── exports/                  # Rendered MP4 videos & SRT/VTT subtitle files
├── samples/                      # Sample test video recordings
├── package.json                  # Root runner for concurrent server execution
└── README.md                     # Complete system documentation
```

---

## 🚀 Key Architectural Features

### 💻 Frontend Architecture
- 🧙‍♂️ **4-Step Wizard**: Seamless progression through **Upload** $\rightarrow$ **Transcribe** $\rightarrow$ **Edit & Switch** $\rightarrow$ **Export**.
- 🔄 **Lifted Parent State**: Centralized state in `Index.tsx` ensures clip reordering, speaker tags, and segment deletions persist flawlessly across all wizard steps.
- 💾 **Session Autosave**: Automatic browser `localStorage` synchronization (`ai_podcast_editor_session`) restores your exact timeline on page refresh.
- ⏱️ **Word-Level Precision**: Word-level start/end timestamps enable high-precision editing and karaoke-style subtitle alignment.

### 🐍 Backend AI & Video Pipeline
- ⚡ **Asynchronous Background Jobs**: Offloads CPU/GPU heavy transcription and video rendering to non-blocking background workers (`BackgroundTasks`).
- 🤖 **Faster-Whisper Medium Model**: High-capacity 769M parameter speech recognition model for accurate multi-speaker transcription.
- 🔇 **Silero Voice Activity Detection (VAD)**: Built-in VAD filtering (`vad_filter=True`) suppresses silent intervals and ambient noise hallucinations.
- 🎬 **Native FFmpeg Render Engine**: Trims video clips with stream precision and concats them via FFmpeg demuxing into production-ready **MP4** files.
- 📝 **Dual Subtitle Generators**: Native generation of formatted `.srt` (SubRip) and `.vtt` (WebVTT) subtitle files with speaker attribution tags (`[Speaker 1]`).

---

## 📡 Backend API Reference

| Endpoint | Method | Description | Payload / Parameters |
| :--- | :--- | :--- | :--- |
| `/transcribe/` | `POST` | Uploads video file & triggers background transcription job | `file` (UploadFile), `speaker` (string), `language` (string) |
| `/jobs/{job_id}` | `GET` | Polls live status, percentage progress, & messages for background jobs | `job_id` (URL path parameter) |
| `/export/` | `POST` | Triggers background FFmpeg video clip trim and concat rendering | `segments` (array), `includeSubtitles` (boolean), `format` (string) |
| `/export_subtitles/` | `POST` | Generates downloadable `.srt` or `.vtt` subtitle file from timeline | `segments` (array), `format` (`srt` or `vtt`) |
| `/download_export/{file}` | `GET` | Streams rendered MP4 video or subtitle file for download | `file_name` (URL path parameter) |

---

## 🛠️ Quick Start (Single Command)

### Prerequisites
1. **Node.js**: `>= 18.0.0`
2. **Python**: `>= 3.10`
3. **FFmpeg**: Must be installed and accessible on system PATH.

### Installation & Execution

From the project root folder, simply execute:

```bash
npm run dev
```
*(or `npm start`)*

This single command automatically starts both servers concurrently:
- 🟢 **FastAPI Backend**: [http://localhost:8000](http://localhost:8000)
- 🟢 **React Frontend**: [http://localhost:8080](http://localhost:8080)

---

## ⚙️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Lucide Icons, shadcn/ui, Radix UI.
- **Backend**: Python 3.12, FastAPI, Uvicorn, faster-whisper, CTranslate2, FFmpeg-python, Pydantic.