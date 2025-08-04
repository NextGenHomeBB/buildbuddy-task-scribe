import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTimer } from '@/hooks/useTimer';

interface TimerProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectId: string, taskId?: string, description?: string) => void;
  isLoading?: boolean;
}

export const TimerProjectModal = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading 
}: TimerProjectModalProps) => {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const { projects } = useTimer();
  const { data: tasks = [] } = useTimer().getTasksForProject(selectedProject);

  const handleConfirm = () => {
    if (!selectedProject) return;
    
    onConfirm(
      selectedProject, 
      selectedTask || undefined, 
      description || undefined
    );
    
    // Reset form
    setSelectedProject('');
    setSelectedTask('');
    setDescription('');
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedTask(''); // Reset task selection when project changes
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Project & Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProject && (
            <div className="space-y-2">
              <Label htmlFor="task">Task (Optional)</Label>
              <Select value={selectedTask} onValueChange={setSelectedTask}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What are you working on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedProject || isLoading}
            >
              Start Timer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};