
import React, { useState } from 'react';
import { FileVideo, Upload, Mic, Captions, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VideoUploader } from '@/components/VideoUploader';
import { TranscriptionPanel } from '@/components/TranscriptionPanel';
import { SpeakerSwitcher } from '@/components/SpeakerSwitcher';
import { ExportPanel } from '@/components/ExportPanel';

export interface VideoFile {
  id: string;
  file: File;
  url: string;
  duration?: number;
  transcript?: TranscriptSegment[];
  speaker?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker: string;
  confidence: number;
}

const Index = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'transcribe' | 'edit' | 'export'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  const steps = [
    { id: 'upload', title: 'Upload Videos', icon: Upload, description: 'Upload 1-10 video files' },
    { id: 'transcribe', title: 'Transcribe', icon: Mic, description: 'AI transcription & speaker detection' },
    { id: 'edit', title: 'Edit & Switch', icon: Captions, description: 'Smart speaker switching' },
    { id: 'export', title: 'Export', icon: Download, description: 'Download final podcast' }
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return videos.length >= 2 && videos.length <= 3;
      case 'transcribe':
        return videos.every(v => v.transcript && v.transcript.length > 0);
      case 'edit':
        return true;
      case 'export':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const stepOrder = ['upload', 'transcribe', 'edit', 'export'] as const;
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const stepOrder = ['upload', 'transcribe', 'edit', 'export'] as const;
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <FileVideo className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Podcast Editor
              </h1>
              <p className="text-sm text-gray-600">Free AI-powered video podcast creation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4 bg-white/70 backdrop-blur-sm rounded-full p-2 shadow-lg">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              const StepIcon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg' 
                      : isCompleted 
                      ? 'bg-green-100 text-green-700' 
                      : 'text-gray-500'
                  }`}>
                    <StepIcon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {steps.find(s => s.id === currentStep)?.title}
              </CardTitle>
              <CardDescription className="text-lg text-gray-600">
                {steps.find(s => s.id === currentStep)?.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="px-8 pb-8">
              {currentStep === 'upload' && (
                <VideoUploader 
                  videos={videos} 
                  setVideos={setVideos} 
                  isProcessing={isProcessing}
                />
              )}
              
              {currentStep === 'transcribe' && (
                <TranscriptionPanel 
                  videos={videos} 
                  setVideos={setVideos}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              )}
              
              {currentStep === 'edit' && (
                <SpeakerSwitcher 
                  videos={videos} 
                  setVideos={setVideos}
                />
              )}
              
              {currentStep === 'export' && (
                <ExportPanel 
                  videos={videos}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 'upload'}
              className="px-8"
            >
              Previous
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Step {steps.findIndex(s => s.id === currentStep) + 1} of {steps.length}
              </p>
            </div>

            <Button 
              onClick={nextStep}
              disabled={!canProceed() || isProcessing}
              className="px-8 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {currentStep === 'export' ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
