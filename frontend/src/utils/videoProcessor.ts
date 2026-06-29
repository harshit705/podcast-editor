
import { VideoFile, TranscriptSegment } from '@/pages/Index';

export interface PodcastSegment {
  id: string;
  videoId: string;
  speaker: string;
  transcript: TranscriptSegment;
  startTime: number;
  endTime: number;
  videoStartTime: number;
  videoEndTime: number;
}

export class VideoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async createPodcastVideo(videos: VideoFile[], segments: PodcastSegment[]): Promise<Blob> {
    console.log('Starting podcast video creation...');
    
    // Set canvas dimensions
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    
    // Create video stream from canvas
    const stream = this.canvas.captureStream(30);
    
    // Add audio track
    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();
    
    // Setup media recorder
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks()
    ]);
    
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });
    
    this.recordedChunks = [];
    
    return new Promise(async (resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        resolve(blob);
      };

      this.mediaRecorder.onerror = reject;

      // Start recording
      this.mediaRecorder.start();

      try {
        // Process each segment
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const video = videos.find(v => v.id === segment.videoId);
          
          if (video) {
            await this.renderSegment(video, segment, audioContext, audioDestination);
          }
        }

        // Stop recording
        this.mediaRecorder.stop();
        audioContext.close();
        
      } catch (error) {
        this.mediaRecorder.stop();
        audioContext.close();
        reject(error);
      }
    });
  }

  private async renderSegment(
    video: VideoFile, 
    segment: PodcastSegment, 
    audioContext: AudioContext,
    audioDestination: MediaStreamAudioDestinationNode
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.src = video.url;
      
      videoElement.onloadedmetadata = () => {
        // Set video time to segment start
        videoElement.currentTime = segment.transcript.startTime;
        
        // Setup audio source
        const audioSource = audioContext.createMediaElementSource(videoElement);
        audioSource.connect(audioDestination);
        
        videoElement.ontimeupdate = () => {
          // Draw video frame
          this.ctx.fillStyle = '#000';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          
          // Draw video
          const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
          const canvasAspect = this.canvas.width / this.canvas.height;
          
          let drawWidth, drawHeight, drawX, drawY;
          
          if (videoAspect > canvasAspect) {
            drawWidth = this.canvas.width;
            drawHeight = this.canvas.width / videoAspect;
            drawX = 0;
            drawY = (this.canvas.height - drawHeight) / 2;
          } else {
            drawHeight = this.canvas.height;
            drawWidth = this.canvas.height * videoAspect;
            drawX = (this.canvas.width - drawWidth) / 2;
            drawY = 0;
          }
          
          this.ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
          
          // Draw subtitle
          this.drawSubtitle(segment.transcript.text, segment.transcript.speaker);
          
          // Check if segment is complete
          if (videoElement.currentTime >= segment.transcript.endTime) {
            videoElement.pause();
            resolve();
          }
        };
        
        videoElement.onerror = reject;
        videoElement.play();
      };
    });
  }

  private drawSubtitle(text: string, speaker: string): void {
    const padding = 40;
    const maxWidth = this.canvas.width - (padding * 2);
    
    // Setup text style
    this.ctx.font = '32px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    
    // Draw background
    const textMetrics = this.ctx.measureText(text);
    const textHeight = 40;
    const bgHeight = textHeight + 20;
    const bgY = this.canvas.height - bgHeight - 20;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(padding, bgY, this.canvas.width - (padding * 2), bgHeight);
    
    // Draw speaker name
    this.ctx.font = '24px Arial';
    this.ctx.fillStyle = '#9333ea';
    this.ctx.fillText(speaker, this.canvas.width / 2, bgY + 25);
    
    // Draw subtitle text
    this.ctx.font = '32px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height - 30);
  }

  async convertToMP4(webmBlob: Blob): Promise<Blob> {
    // For now, return the WebM blob
    // In a real implementation, you might use FFmpeg.wasm to convert to MP4
    console.log('Converting to MP4 format...');
    return webmBlob;
  }
}

export const videoProcessor = new VideoProcessor();
