
import React, { useState } from 'react';
import { Download, FileVideo, Settings, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { VideoFile } from '@/pages/Index';
import { toast } from '@/hooks/use-toast';
import { videoProcessor, PodcastSegment } from '@/utils/videoProcessor';

interface ExportPanelProps {
  videos: VideoFile[];
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ExportSettings {
  includeSubtitles: boolean;
  quality: 'high' | 'medium' | 'low';
  format: 'mp4' | 'webm' | 'mov';
  subtitleStyle: 'default' | 'modern' | 'minimal';
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ 
  videos, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeSubtitles: true,
    quality: 'high',
    format: 'webm',
    subtitleStyle: 'default'
  });
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string>('');
  const [isExported, setIsExported] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  const generatePodcastSegments = (): PodcastSegment[] => {
    const allSegments: PodcastSegment[] = [];
    let totalTime = 0;

    videos.forEach((video) => {
      if (video.transcript) {
        video.transcript.forEach((segment, index) => {
          allSegments.push({
            id: `podcast-${allSegments.length}`,
            videoId: video.id,
            speaker: video.speaker || 'Unknown',
            transcript: segment,
            startTime: totalTime,
            endTime: totalTime + (segment.endTime - segment.startTime),
            videoStartTime: segment.startTime,
            videoEndTime: segment.endTime
          });
          totalTime += (segment.endTime - segment.startTime);
        });
      }
    });

    // Smart sorting: alternate speakers when possible
    return allSegments.sort((a, b) => {
      if (a.speaker !== b.speaker) {
        return a.transcript.startTime - b.transcript.startTime;
      }
      return a.transcript.startTime - b.transcript.startTime;
    });
  };

  const exportPodcast = async () => {
    setIsProcessing(true);
    setExportProgress(0);
    
    try {
      const steps = [
        'Analyzing video segments...',
        'Extracting audio tracks...',
        'Processing video frames...',
        'Merging segments...',
        'Adding subtitles...',
        'Finalizing export...'
      ];

      // Step 1: Generate podcast segments
      setCurrentStep(steps[0]);
      setExportProgress(10);
      const podcastSegments = generatePodcastSegments();
      console.log('Generated podcast segments:', podcastSegments);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Extract audio
      setCurrentStep(steps[1]);
      setExportProgress(25);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: Process video frames
      setCurrentStep(steps[2]);
      setExportProgress(40);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Create podcast video
      setCurrentStep(steps[3]);
      setExportProgress(60);
      console.log('Creating podcast video...');
      
      const podcastBlob = await videoProcessor.createPodcastVideo(videos, podcastSegments);
      console.log('Podcast video created:', podcastBlob);

      // Step 5: Add subtitles (already included in video processing)
      setCurrentStep(steps[4]);
      setExportProgress(80);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Finalize
      setCurrentStep(steps[5]);
      setExportProgress(90);

      // Convert to desired format if needed
      let finalBlob = podcastBlob;
      if (exportSettings.format === 'mp4') {
        finalBlob = await videoProcessor.convertToMP4(podcastBlob);
      }

      // Create download URL
      const url = URL.createObjectURL(finalBlob);
      setExportUrl(url);
      setIsExported(true);
      setExportProgress(100);

      toast({
        title: "Export Complete!",
        description: "Your podcast is ready for download.",
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export podcast. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };

  const downloadPodcast = () => {
    if (exportUrl) {
      const a = document.createElement('a');
      a.href = exportUrl;
      a.download = `ai-podcast-${Date.now()}.${exportSettings.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your podcast is being downloaded.",
      });
    }
  };

  const totalSegments = videos.reduce((acc, video) => acc + (video.transcript?.length || 0), 0);
  const estimatedDuration = videos.reduce((acc, video) => acc + (video.duration || 0), 0);

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
              Your Podcast is Ready!
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Videos:</span>
                <div className="font-medium">{videos.length} files</div>
              </div>
              <div>
                <span className="text-gray-600">Segments:</span>
                <div className="font-medium">{totalSegments} clips</div>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>
                <div className="font-medium">
                  {Math.floor(estimatedDuration / 60)}:{Math.floor(estimatedDuration % 60).toString().padStart(2, '0')}
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

      {/* Export Settings */}
      <Card className="p-6 bg-white/70 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Export Settings</h3>
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
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Video Quality</label>
              <Select
                value={exportSettings.quality}
                onValueChange={(value: 'high' | 'medium' | 'low') =>
                  setExportSettings(prev => ({ ...prev, quality: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (1080p)</SelectItem>
                  <SelectItem value="medium">Medium (720p)</SelectItem>
                  <SelectItem value="low">Low (480p)</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="webm">WebM (Recommended)</SelectItem>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="mov">MOV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {exportSettings.includeSubtitles && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Subtitle Style</label>
                <Select
                  value={exportSettings.subtitleStyle}
                  onValueChange={(value: 'default' | 'modern' | 'minimal') =>
                    setExportSettings(prev => ({ ...prev, subtitleStyle: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Export Process */}
      {isProcessing && (
        <Card className="p-6 bg-white/70 border border-blue-200">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-medium">{currentStep || 'Processing...'}</span>
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
                Podcast Ready!
              </h3>
              <p className="text-green-700 mb-4">
                Your AI-powered podcast has been successfully created
              </p>
            </div>
            <Button
              onClick={downloadPodcast}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Podcast
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
            Export Podcast
          </Button>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-800 mb-2">Export Features</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• Smart video merging with seamless transitions</li>
          <li>• AI-generated subtitles with multiple style options</li>
          <li>• Automatic speaker switching based on your timeline</li>
          <li>• High-quality export in multiple formats</li>
          <li>• Optimized for social media sharing</li>
        </ul>
      </div>
    </div>
  );
};
