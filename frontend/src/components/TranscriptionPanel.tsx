import React, { useState } from 'react';
import { Mic, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { VideoFile, TranscriptSegment } from '@/pages/Index';
import { toast } from '@/hooks/use-toast';

interface TranscriptionPanelProps {
  videos: VideoFile[];
  setVideos: React.Dispatch<React.SetStateAction<VideoFile[]>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ 
  videos, 
  setVideos, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [progress, setProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const pollJobUntilComplete = async (jobId: str): Promise<any> => {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await fetch(`http://localhost:8000/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job status');
      const data = await res.json();
      
      setProgress(data.progress || 0);
      setStatusMessage(data.message || 'Processing...');
      
      if (data.status === 'completed') {
        return data.result;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || data.message || 'Transcription job failed');
      }
    }
  };

  const transcribeVideo = async (video: VideoFile) => {
    setCurrentVideo(video.file.name);
    setStatusMessage('Uploading video to background transcription worker...');
    
    const formData = new FormData();
    formData.append('file', video.file);
    if (video.speaker) {
      formData.append('speaker', video.speaker);
    }

    const res = await fetch('http://localhost:8000/transcribe/', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: 'Transcription failed' }));
      throw new Error(errData.detail || 'Server transcription error');
    }

    const { jobId } = await res.json();
    const result = await pollJobUntilComplete(jobId);

    const segments: TranscriptSegment[] = result.segments.map((s: any) => ({
      id: s.id,
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
      speaker: s.speaker,
      confidence: s.confidence,
      words: s.words
    }));

    setVideos(prev => prev.map(v => 
      v.id === video.id 
        ? { 
            ...v, 
            backendVideoId: result.videoId,
            duration: result.duration || v.duration,
            transcript: segments 
          } 
        : v
    ));
  };

  const startTranscription = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (!video.transcript) {
          await transcribeVideo(video);
        }
      }
      
      toast({
        title: "Async Transcription Complete",
        description: "All videos have been successfully processed in background!",
      });
    } catch (error: any) {
      console.error('Batch transcription error:', error);
      toast({
        title: "Transcription Failed",
        description: error.message || "Could not connect to backend server.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setCurrentVideo('');
      setStatusMessage('');
    }
  };

  const allTranscribed = videos.every(v => v.transcript && v.transcript.length > 0);

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {videos.map((video) => (
          <Card key={video.id} className="p-4 bg-white/50 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                video.transcript ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {video.transcript ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Mic className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-800 truncate">{video.file.name}</h4>
                <p className="text-sm text-gray-500">
                  {video.transcript 
                    ? `${video.transcript.length} segments` 
                    : 'Pending transcription'
                  }
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Transcription Controls */}
      {!allTranscribed && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
          <div className="text-center space-y-4">
            <div className="p-4 bg-white rounded-full w-fit mx-auto">
              <Mic className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Asynchronous AI Transcription
              </h3>
              <p className="text-gray-600 mb-4">
                Transcribe your videos via background jobs with real-time status reporting
              </p>
            </div>
            
            {isProcessing ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-2 text-purple-600">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-semibold">Processing: {currentVideo}</span>
                  </div>
                  <span className="text-sm text-gray-600">{statusMessage}</span>
                </div>
                <Progress value={progress} className="max-w-md mx-auto" />
                <p className="text-sm text-gray-500">
                  {Math.round(progress)}% complete
                </p>
              </div>
            ) : (
              <Button 
                onClick={startTranscription}
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                Start AI Transcription
              </Button>
            )}
          </div>
        </Card>
      )}

      {videos.some(v => v.transcript) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Transcription Results</h3>
          {videos.filter(v => v.transcript).map((video) => (
            <Card key={video.id} className="p-4 bg-white/50 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <h4 className="font-medium text-gray-800">{video.speaker}</h4>
                <span className="text-sm text-gray-500">({video.file.name})</span>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {video.transcript?.map((segment) => (
                  <div key={segment.id} className="p-2 bg-white/50 rounded text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-700">{segment.text}</p>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {segment.startTime}s - {segment.endTime}s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
