import React, { useState } from 'react';
import { Download, FileVideo, Settings, CheckCircle, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { VideoFile } from '@/pages/Index';
import { toast } from '@/hooks/use-toast';
import { PodcastSegment } from '@/utils/videoProcessor';

interface ExportPanelProps {
  videos: VideoFile[];
  podcastSegments: PodcastSegment[];
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ExportSettings {
  includeSubtitles: boolean;
  quality: 'high' | 'medium' | 'low';
  format: 'mp4' | 'webm' | 'mov';
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ 
  videos, 
  podcastSegments,
  isProcessing, 
  setIsProcessing 
}) => {
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeSubtitles: true,
    quality: 'high',
    format: 'mp4'
  });
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string>('');
  const [isExported, setIsExported] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  const pollExportJob = async (jobId: string): Promise<any> => {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await fetch(`http://localhost:8000/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job status');
      const data = await res.json();
      
      setExportProgress(data.progress || 0);
      setCurrentStep(data.message || 'Rendering...');
      
      if (data.status === 'completed') {
        return data.result;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || data.message || 'Export job failed');
      }
    }
  };

  const exportPodcast = async () => {
    if (podcastSegments.length === 0) {
      toast({
        title: "Cannot Export",
        description: "No edited podcast segments found in timeline.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setExportProgress(5);
    setCurrentStep('Submitting video encoding job...');
    
    try {
      const payload = {
        segments: podcastSegments.map(seg => ({
          id: seg.id,
          videoId: seg.videoId,
          speaker: seg.speaker,
          text: seg.transcript.text,
          startTime: seg.startTime,
          endTime: seg.endTime,
          videoStartTime: seg.videoStartTime,
          videoEndTime: seg.videoEndTime
        })),
        includeSubtitles: exportSettings.includeSubtitles,
        format: exportSettings.format
      };

      const res = await fetch('http://localhost:8000/export/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(errData.detail || 'Failed to trigger background export');
      }

      const { jobId } = await res.json();
      const result = await pollExportJob(jobId);

      setExportUrl(result.downloadUrl);
      setIsExported(true);
      setExportProgress(100);

      toast({
        title: "Async Export Complete!",
        description: "Your podcast MP4 video has been encoded and is ready for download.",
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export podcast.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };

  const exportSubtitles = async (format: 'srt' | 'vtt') => {
    try {
      const payload = {
        segments: podcastSegments.map(seg => ({
          id: seg.id,
          videoId: seg.videoId,
          speaker: seg.speaker,
          text: seg.transcript.text,
          startTime: seg.startTime,
          endTime: seg.endTime,
          videoStartTime: seg.videoStartTime,
          videoEndTime: seg.videoEndTime
        })),
        format
      };

      const res = await fetch('http://localhost:8000/export_subtitles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Subtitle generation failed');

      const data = await res.json();
      window.open(data.downloadUrl, '_blank');
      
      toast({
        title: "Subtitles Downloaded",
        description: `Exported timeline subtitles in .${format.toUpperCase()} format.`,
      });
    } catch (err: any) {
      toast({
        title: "Subtitle Export Error",
        description: err.message || "Could not generate subtitles.",
        variant: "destructive"
      });
    }
  };

  const downloadPodcast = () => {
    if (exportUrl) {
      window.open(exportUrl, '_blank');
      toast({
        title: "Download Started",
        description: "Your podcast download has been triggered.",
      });
    }
  };

  const totalDuration = podcastSegments.reduce((acc, segment) => acc + (segment.endTime - segment.startTime), 0);

  return (
    <div className="space-y-6">
      {/* Export Preview */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-full">
            <FileVideo className="h-8 w-8 text-purple-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Your Podcast is Ready for Async Export!
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Source Videos:</span>
                <div className="font-medium">{videos.length} files</div>
              </div>
              <div>
                <span className="text-gray-600">Timeline Clips:</span>
                <div className="font-medium">{podcastSegments.length} clips</div>
              </div>
              <div>
                <span className="text-gray-600">Edited Duration:</span>
                <div className="font-medium">
                  {Math.floor(totalDuration / 60)}:{Math.floor(totalDuration % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Speakers:</span>
                <div className="font-medium">{new Set(videos.map(v => v.speaker)).size}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Subtitle Export Action Bar */}
      {podcastSegments.length > 0 && (
        <Card className="p-4 bg-white/60 border border-purple-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <div>
              <h4 className="font-medium text-gray-800 text-sm">Export Subtitles</h4>
              <p className="text-xs text-gray-500">Download formatted subtitle files for YouTube or media players</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSubtitles('srt')}>
              Download .SRT
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSubtitles('vtt')}>
              Download .VTT
            </Button>
          </div>
        </Card>
      )}

      {/* Export Settings */}
      <Card className="p-6 bg-white/70 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Video Export Settings</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Include Subtitles</label>
              <Switch
                checked={exportSettings.includeSubtitles}
                onCheckedChange={(checked) => 
                  setExportSettings(prev => ({ ...prev, includeSubtitles: checked }))
                }
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Export Format</label>
              <Select
                value={exportSettings.format}
                onValueChange={(value: 'mp4' | 'webm' | 'mov') =>
                  setExportSettings(prev => ({ ...prev, format: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4 (Recommended)</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                  <SelectItem value="mov">MOV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Export Process */}
      {isProcessing && (
        <Card className="p-6 bg-white/70 border border-blue-200">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-medium">{currentStep || 'Processing background job...'}</span>
            </div>
            <Progress value={exportProgress} className="max-w-md mx-auto" />
            <p className="text-sm text-gray-600">
              {Math.round(exportProgress)}% complete
            </p>
          </div>
        </Card>
      )}

      {/* Export Success */}
      {isExported && (
        <Card className="p-6 bg-green-50 border border-green-200">
          <div className="text-center space-y-4">
            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-800 mb-2">
                Podcast MP4 Encoded!
              </h3>
              <p className="text-green-700 mb-4">
                Your AI-powered podcast has been seamlessly processed by backend background workers
              </p>
            </div>
            <Button
              onClick={downloadPodcast}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Podcast Video MP4
            </Button>
          </div>
        </Card>
      )}

      {!isProcessing && !isExported && (
        <div className="text-center">
          <Button
            onClick={exportPodcast}
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <FileVideo className="h-5 w-5 mr-2" />
            Start Async Video Export
          </Button>
        </div>
      )}
    </div>
  );
};
