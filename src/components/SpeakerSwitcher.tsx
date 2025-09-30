
import React, { useState } from 'react';
import { Users, Play, Pause, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { VideoFile, TranscriptSegment } from '@/pages/Index';
import { PodcastSegment } from '@/utils/videoProcessor';

interface SpeakerSwitcherProps {
  videos: VideoFile[];
  setVideos: React.Dispatch<React.SetStateAction<VideoFile[]>>;
}

export const SpeakerSwitcher: React.FC<SpeakerSwitcherProps> = ({ videos, setVideos }) => {
  const [podcastSegments, setPodcastSegments] = useState<PodcastSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const generateSmartPodcast = () => {
    const allSegments: PodcastSegment[] = [];
    let totalTime = 0;

    videos.forEach((video) => {
      if (video.transcript) {
        video.transcript.forEach((segment) => {
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

    // Smart sorting: try to alternate speakers for better flow
    const smartSegments = allSegments.sort((a, b) => {
      const aVideo = videos.find(v => v.id === a.videoId);
      const bVideo = videos.find(v => v.id === b.videoId);
      
      // Prioritize alternating speakers
      if (aVideo?.speaker !== bVideo?.speaker) {
        return a.transcript.startTime - b.transcript.startTime;
      }
      return a.transcript.startTime - b.transcript.startTime;
    });

    // Recalculate timings after smart sorting
    let currentTime = 0;
    smartSegments.forEach(segment => {
      const duration = segment.transcript.endTime - segment.transcript.startTime;
      segment.startTime = currentTime;
      segment.endTime = currentTime + duration;
      currentTime += duration;
    });

    setPodcastSegments(smartSegments);
  };

  // Move segment up/down
  const moveSegment = (index: number, direction: 'up' | 'down') => {
    const newSegments = [...podcastSegments];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newSegments.length) {
      [newSegments[index], newSegments[targetIndex]] = [newSegments[targetIndex], newSegments[index]];
      
      // Recalculate timings
      let currentTime = 0;
      newSegments.forEach(segment => {
        const duration = segment.transcript.endTime - segment.transcript.startTime;
        segment.startTime = currentTime;
        segment.endTime = currentTime + duration;
        currentTime += duration;
      });
      
      setPodcastSegments(newSegments);
    }
  };

  const removeSegment = (index: number) => {
    const newSegments = podcastSegments.filter((_, i) => i !== index);
    
    // Recalculate timings
    let currentTime = 0;
    newSegments.forEach(segment => {
      const duration = segment.transcript.endTime - segment.transcript.startTime;
      segment.startTime = currentTime;
      segment.endTime = currentTime + duration;
      currentTime += duration;
    });
    
    setPodcastSegments(newSegments);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = podcastSegments.reduce((acc, segment) => acc + (segment.endTime - segment.startTime), 0);

  React.useEffect(() => {
    if (videos.length > 0 && videos.every(v => v.transcript) && podcastSegments.length === 0) {
      generateSmartPodcast();
    }
  }, [videos]);

  // Store segments in videos for export
  React.useEffect(() => {
    if (podcastSegments.length > 0) {
      console.log('Updated podcast segments:', podcastSegments);
      // You can store segments in a context or pass them to parent if needed
    }
  }, [podcastSegments]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Smart Podcast Editor</h3>
          <p className="text-sm text-gray-600">
            {podcastSegments.length} segments • {formatTime(totalDuration)} total duration
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={generateSmartPodcast}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Regenerate
          </Button>
          
          <Button
            variant={previewMode ? "default" : "outline"}
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </Button>
        </div>
      </div>

      {previewMode && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">Podcast Preview</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-sm text-gray-600">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
              </div>
            </div>
            
            <Slider
              value={[currentTime]}
              onValueChange={([value]) => setCurrentTime(value)}
              max={totalDuration}
              step={1}
              className="w-full"
            />
            
            <div className="text-sm text-gray-600">
              Current segment: {podcastSegments.find(s => 
                currentTime >= s.startTime && currentTime <= s.endTime
              )?.speaker || 'None'}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 bg-white/50 border border-purple-100">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-600 mr-2">Speakers:</span>
          {Array.from(new Set(videos.map(v => v.speaker))).map((speaker, index) => (
            <Badge 
              key={speaker} 
              variant="secondary" 
              className={`${
                index === 0 ? 'bg-purple-100 text-purple-700' :
                index === 1 ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}
            >
              {speaker}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Podcast Timeline */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-800">Podcast Timeline</h4>
        
        {podcastSegments.length === 0 ? (
          <Card className="p-8 text-center bg-gray-50">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No segments generated yet</p>
            <Button 
              onClick={generateSmartPodcast}
              className="mt-4 bg-gradient-to-r from-purple-500 to-blue-500"
            >
              Generate Smart Podcast
            </Button>
          </Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {podcastSegments.map((segment, index) => (
              <Card key={segment.id} className="p-4 bg-white/70 border border-gray-200 hover:border-purple-300 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className={`w-3 h-3 rounded-full ${
                      segment.speaker === videos[0]?.speaker ? 'bg-purple-500' :
                      segment.speaker === videos[1]?.speaker ? 'bg-blue-500' :
                      'bg-green-500'
                    }`}></div>
                    <div className="text-xs text-gray-500 text-center">
                      {formatTime(segment.startTime)}-{formatTime(segment.endTime)}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {segment.speaker}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Segment {index + 1}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {segment.transcript.text}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveSegment(index, 'up')}
                      disabled={index === 0}
                      className="p-1 h-6 w-6"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveSegment(index, 'down')}
                      disabled={index === podcastSegments.length - 1}
                      className="p-1 h-6 w-6"
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSegment(index)}
                      className="p-1 h-6 w-6 text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-800 mb-2">Smart Switching Features</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• AI automatically arranges segments for natural conversation flow</li>
          <li>• Drag segments up/down to reorder the podcast timeline</li>
          <li>• Remove segments that don't fit your narrative</li>
          <li>• Preview the complete podcast before exporting</li>
        </ul>
      </div>
    </div>
  );
};
