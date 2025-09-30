
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileVideo, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VideoFile } from '@/pages/Index';
import { toast } from '@/hooks/use-toast';

interface VideoUploaderProps {
  videos: VideoFile[];
  setVideos: React.Dispatch<React.SetStateAction<VideoFile[]>>;
  isProcessing: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ videos, setVideos, isProcessing }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newVideos = acceptedFiles.map(file => {
      const videoUrl = URL.createObjectURL(file);
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: videoUrl,
        speaker: `Speaker ${videos.length + acceptedFiles.indexOf(file) + 1}`
      };
    });

    if (videos.length + newVideos.length > 10) {
      toast({
        title: "Too many files",
        description: "Maximum 10 video files allowed",
        variant: "destructive"
      });
      return;
    }

    setVideos(prev => [...prev, ...newVideos]);
    
    // Get duration for each video
    newVideos.forEach(video => {
      const videoElement = document.createElement('video');
      videoElement.src = video.url;
      videoElement.onloadedmetadata = () => {
        setVideos(prev => prev.map(v => 
          v.id === video.id ? { ...v, duration: videoElement.duration } : v
        ));
      };
    });
  }, [videos.length, setVideos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    },
    maxFiles: 10 - videos.length,
    disabled: isProcessing
  });

  const removeVideo = (id: string) => {
    setVideos(prev => {
      const videoToRemove = prev.find(v => v.id === id);
      if (videoToRemove) {
        URL.revokeObjectURL(videoToRemove.url);
      }
      return prev.filter(v => v.id !== id);
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [isUploading, setIsUploading] = useState(false);
  const [transcriptFile, setTranscriptFile] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload first video to backend and get transcript
  const handleTranscribe = async () => {
    if (videos.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    setTranscriptFile(null);
    try {
      const formData = new FormData();
      formData.append('file', videos[0].file);
      // Change the URL if your backend runs on a different port
      const res = await fetch('http://localhost:8000/upload_video/', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.transcript_file) {
        // Extract file name from path
        const parts = data.transcript_file.split('/');
        setTranscriptFile(parts[parts.length - 1]);
      } else {
        throw new Error('Transcript not found');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading/transcribing');
    } finally {
      setIsUploading(false);
    }
  };

  // Download transcript file
  const handleDownloadTranscript = () => {
    if (!transcriptFile) return;
    // Change the URL if your backend runs on a different port
    window.open(`http://localhost:8000/download_transcript/${transcriptFile}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {videos.length < 10 && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragActive 
              ? 'border-purple-400 bg-purple-50' 
              : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {isDragActive ? 'Drop videos here...' : 'Upload Video Files'}
          </h3>
          <p className="text-gray-500 mb-4">
            Drag & drop 1-10 video files or click to browse
          </p>
          <Button variant="outline" className="mx-auto">
            Choose Files
          </Button>
          <p className="text-sm text-gray-400 mt-4">
            Supports MP4, MOV, AVI, MKV, WebM • Max 10 files
          </p>
        </div>
      )}

      {/* Uploaded Videos */}
      {videos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">
            Uploaded Videos ({videos.length}/10)
          </h3>
          <div className="grid gap-4">
            {videos.map((video, index) => (
              <Card key={video.id} className="p-4 bg-white/50 border border-purple-100">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <video
                      src={video.url}
                      className="w-24 h-16 object-cover rounded-lg bg-gray-100"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                      <FileVideo className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{video.file.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>{(video.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      {video.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(video.duration)}</span>
                        </div>
                      )}
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {video.speaker}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVideo(video.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Transcribe & Download Buttons */}
      {videos.length > 0 && (
        <div className="flex flex-col gap-4 items-start">
          <Button onClick={handleTranscribe} disabled={isUploading || isProcessing}>
            {isUploading ? 'Transcribing...' : 'Transcribe First Video'}
          </Button>
          {uploadError && <div className="text-red-500 text-sm">{uploadError}</div>}
          {transcriptFile && (
            <Button variant="outline" onClick={handleDownloadTranscript}>
              Download Transcript
            </Button>
          )}
        </div>
      )}

      {/* Instructions */}
      {videos.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-2">Getting Started</h3>
          <ul className="text-blue-700 space-y-1 text-sm">
            <li>• Upload 1-10 video files of different speakers</li>
            <li>• Each video should contain clear audio for transcription</li>
            <li>• AI will automatically detect speakers and generate subtitles</li>
            <li>• You can then smartly switch between speakers to create your podcast</li>
          </ul>
        </div>
      )}
    </div>
  );
};
