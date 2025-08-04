import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Briefcase, CheckSquare } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer';
import { TimerProjectModal } from '@/components/TimerProjectModal';
import { DailySummary } from '@/components/DailySummary';
import { MaterialsModal } from '@/components/MaterialsModal';

export default function Timer() {
  const [showModal, setShowModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  
  const {
    activeTimer,
    isLoadingTimer,
    currentDuration,
    formatDuration,
    startTimer,
    stopTimer,
    isStarting,
    isStopping,
  } = useTimer();

  const handleStartNewTimer = () => {
    setShowModal(true);
  };

  const handleStopAndSwitch = () => {
    if (activeTimer) {
      const taskId = activeTimer.task_id;
      stopTimer(activeTimer.id);
      
      // Check if this task has materials by setting up the task ID and showing materials modal
      if (taskId) {
        setCompletedTaskId(taskId);
        setShowMaterialsModal(true);
      } else {
        // No task or no materials, go directly to project selection
        setTimeout(() => setShowModal(true), 500);
      }
    }
  };

  const handleStartTimer = (projectId: string, taskId?: string, description?: string) => {
    startTimer({ projectId, taskId, description });
    setShowModal(false);
  };

  const handleMaterialsSaved = () => {
    setShowMaterialsModal(false);
    setCompletedTaskId(null);
    setShowModal(true);
  };

  const handleMaterialsSkipped = () => {
    setShowMaterialsModal(false);
    setCompletedTaskId(null);
    setShowModal(true);
  };

  if (isLoadingTimer) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Timer</h1>
          <Card>
            <CardContent className="p-8">
              <div className="text-center">Loading...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Timer</h1>

        {/* Active Timer Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Timer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimer ? (
              <div className="space-y-4">
                {/* Timer Display */}
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-primary">
                    {formatDuration(currentDuration)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Started at {new Date(activeTimer.start_at).toLocaleTimeString()}
                  </div>
                </div>

                {/* Project & Task Info */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeTimer.projects && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {activeTimer.projects.name}
                    </Badge>
                  )}
                  {activeTimer.tasks && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      {activeTimer.tasks.title}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                {activeTimer.description && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground italic">
                      "{activeTimer.description}"
                    </p>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => stopTimer(activeTimer.id)}
                    disabled={isStopping}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Timer
                  </Button>
                  <Button
                    onClick={handleStopAndSwitch}
                    disabled={isStopping}
                    variant="default"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    End & Switch
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Timer</h3>
                <p className="text-muted-foreground mb-4">
                  Start tracking your time on a project
                </p>
                <Button onClick={handleStartNewTimer} disabled={isStarting}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Summary */}
        <DailySummary />

        {/* Project Selection Modal */}
        <TimerProjectModal
          open={showModal}
          onOpenChange={setShowModal}
          onConfirm={handleStartTimer}
          isLoading={isStarting}
        />
        
        {/* Materials Modal */}
        <MaterialsModal
          open={showMaterialsModal}
          onOpenChange={(open) => {
            if (!open) {
              handleMaterialsSkipped();
            }
          }}
          taskId={completedTaskId}
          onSave={handleMaterialsSaved}
        />
      </div>
    </div>
  );
}