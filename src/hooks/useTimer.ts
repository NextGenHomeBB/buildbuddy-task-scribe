import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { enqueueMutation } from '@/lib/offlineQueue';

export interface TimeLog {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  start_at: string;
  end_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  project_id: string;
}

export const useTimer = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current running timer
  const { data: activeTimer, isLoading: isLoadingTimer } = useQuery({
    queryKey: ['active-timer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_logs')
        .select(`
          *,
          projects:project_id(id, name),
          tasks:task_id(id, title)
        `)
        .is('end_at', null)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Get projects for selection
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data as Project[];
    },
  });

  // Get tasks for selected project
  const getTasksForProject = (projectId: string) => {
    return useQuery({
      queryKey: ['tasks', projectId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('project_id', projectId)
          .order('title');

        if (error) throw error;
        return data as Task[];
      },
      enabled: !!projectId,
    });
  };

  // Get today's time logs
  const { data: todayLogs = [] } = useQuery({
    queryKey: ['today-logs'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('time_logs')
        .select(`
          *,
          projects:project_id(id, name),
          tasks:task_id(id, title)
        `)
        .gte('start_at', `${today}T00:00:00.000Z`)
        .lt('start_at', `${today}T23:59:59.999Z`)
        .order('start_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async ({ projectId, taskId, description, shiftId }: {
      projectId: string;
      taskId?: string;
      description?: string;
      shiftId?: string;
    }) => {
      // Check for existing active timer
      const { data: existingTimer } = await supabase
        .from('time_logs')
        .select('id')
        .is('end_at', null)
        .maybeSingle();

      if (existingTimer) {
        throw new Error('You already have an active timer running');
      }

      const { data, error } = await supabase
        .from('time_logs')
        .insert({
          user_id: user?.id!,
          org_id: currentOrgId,
          project_id: projectId,
          task_id: taskId || null,
          description: description || null,
          start_at: new Date().toISOString(),
          shift_id: shiftId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      toast({
        title: "Timer started",
        description: "Your time tracking has begun",
      });
    },
    onError: (error: Error) => {
      // Queue for offline sync
      enqueueMutation({
        table: 'time_logs',
        recordId: 'new',
        patch: {
          user_id: (supabase.auth.getUser()).then(u => u.data.user?.id),
          start_at: new Date().toISOString(),
        }
      });

      toast({
        title: "Error starting timer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      const { data, error } = await supabase
        .from('time_logs')
        .update({ end_at: new Date().toISOString() })
        .eq('id', timerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      toast({
        title: "Timer stopped",
        description: "Your time has been logged",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error stopping timer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate duration for active timer
  const [currentDuration, setCurrentDuration] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
      setCurrentDuration(0);
      return;
    }

    const updateDuration = () => {
      const start = new Date(activeTimer.start_at);
      const now = new Date();
      const duration = Math.floor((now.getTime() - start.getTime()) / 1000);
      setCurrentDuration(duration);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate daily summary
  const dailySummary = {
    totalHours: todayLogs.reduce((total, log) => {
      if (!log.end_at) return total;
      const start = new Date(log.start_at);
      const end = new Date(log.end_at);
      return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0),
    projectBreakdown: todayLogs.reduce((acc, log) => {
      if (!log.end_at || !log.projects) return acc;
      
      const projectName = log.projects.name;
      const start = new Date(log.start_at);
      const end = new Date(log.end_at);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (!acc[projectName]) {
        acc[projectName] = { hours: 0, isOT: false };
      }
      acc[projectName].hours += hours;
      
      return acc;
    }, {} as Record<string, { hours: number; isOT: boolean }>),
  };

  // Mark overtime (8+ hours)
  const totalHours = dailySummary.totalHours;
  const regularHours = Math.min(totalHours, 8);
  const overtimeHours = Math.max(totalHours - 8, 0);

  return {
    activeTimer,
    isLoadingTimer,
    projects,
    todayLogs,
    currentDuration,
    formatDuration,
    startTimer: startTimerMutation.mutate,
    stopTimer: stopTimerMutation.mutate,
    isStarting: startTimerMutation.isPending,
    isStopping: stopTimerMutation.isPending,
    getTasksForProject,
    dailySummary: {
      ...dailySummary,
      regularHours,
      overtimeHours,
      totalHours,
    },
  };
};