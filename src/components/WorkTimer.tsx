import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useTimer } from '@/hooks/useTimer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, Play, Square, Timer, Database, Trash2, Wifi, WifiOff, Briefcase, CheckSquare } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { TimerProjectModal } from '@/components/TimerProjectModal'
import { MaterialsModal } from '@/components/MaterialsModal'

export function WorkTimer() {
  const { user } = useAuth()
  const { currentOrgId } = useOrganization()
  const { toast } = useToast()
  
  // Shift state
  const [isShiftActive, setIsShiftActive] = useState(false)
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null)
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)
  const [shiftElapsedTime, setShiftElapsedTime] = useState(0)
  const [todayHours, setTodayHours] = useState(0)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error'>('synced')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  
  // Project timer state
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showMaterialsModal, setShowMaterialsModal] = useState(false)
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null)
  
  const {
    activeTimer,
    isLoadingTimer,
    currentDuration,
    formatDuration,
    startTimer,
    stopTimer,
    isStarting,
    isStopping,
  } = useTimer()

  // Load shift state from localStorage on mount
  useEffect(() => {
    const savedShiftData = localStorage.getItem('activeShift')
    if (savedShiftData) {
      const { startTime, activeShiftId } = JSON.parse(savedShiftData)
      const shiftStart = new Date(startTime)
      setShiftStartTime(shiftStart)
      setIsShiftActive(true)
      setActiveShiftId(activeShiftId || null)
      
      // Calculate elapsed time
      const now = new Date()
      const elapsed = Math.floor((now.getTime() - shiftStart.getTime()) / 1000)
      setShiftElapsedTime(elapsed)
    }
  }, [])

  // Auto-sync every 30 seconds during active shift
  useEffect(() => {
    let syncInterval: NodeJS.Timeout
    
    if (isShiftActive && activeShiftId) {
      syncInterval = setInterval(() => {
        syncToDatabase()
      }, 30000)
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval)
    }
  }, [isShiftActive, activeShiftId])

  // Update shift elapsed time every second when shift is active
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (isShiftActive && shiftStartTime) {
      interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - shiftStartTime.getTime()) / 1000)
        setShiftElapsedTime(elapsed)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isShiftActive, shiftStartTime])

  // Load today's total hours on component mount
  useEffect(() => {
    if (user) {
      loadTodayHours()
    }
  }, [user])

  const loadTodayHours = async () => {
    if (!user || !currentOrgId) return

    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('time_sheets')
      .select('hours')
      .eq('user_id', user.id)
      .eq('org_id', currentOrgId)
      .eq('work_date', today)

    if (error) {
      console.error('Error loading today hours:', error)
      return
    }

    const total = data.reduce((sum, sheet) => sum + (sheet.hours || 0), 0)
    setTodayHours(total)
  }

  const syncToDatabase = async () => {
    if (!user || !shiftStartTime || !currentOrgId) return

    setSyncStatus('pending')
    
    try {
      if (activeShiftId) {
        // Update existing active shift
        const { error } = await supabase
          .from('active_shifts')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('id', activeShiftId)

        if (error) throw error
      } else {
        // Create new active shift record
        const { data, error } = await supabase
          .from('active_shifts')
          .insert({
            worker_id: user.id,
            org_id: currentOrgId,
            shift_start: shiftStartTime.toISOString(),
            shift_type: 'regular'
          })
          .select()
          .single()

        if (error) throw error
        
        setActiveShiftId(data.id)
        
        // Update localStorage with shift ID
        localStorage.setItem('activeShift', JSON.stringify({
          startTime: shiftStartTime.toISOString(),
          activeShiftId: data.id
        }))
      }

      setSyncStatus('synced')
      setLastSyncTime(new Date())
      
    } catch (error) {
      console.error('Error syncing shift:', error)
      setSyncStatus('error')
    }
  }

  const clearShiftData = () => {
    setIsShiftActive(false)
    setShiftStartTime(null)
    setShiftElapsedTime(0)
    setActiveShiftId(null)
    setSyncStatus('synced')
    setLastSyncTime(null)
    
    // Clear localStorage
    localStorage.removeItem('activeShift')
    
    toast({
      title: 'Shift Data Cleared',
      description: 'Local shift data has been cleared',
    })
  }

  const startShift = async () => {
    const now = new Date()
    setShiftStartTime(now)
    setIsShiftActive(true)
    setShiftElapsedTime(0)
    
    // Save to localStorage initially
    localStorage.setItem('activeShift', JSON.stringify({
      startTime: now.toISOString()
    }))
    
    toast({
      title: 'Shift Started',
      description: `Started at ${now.toLocaleTimeString()}`,
    })

    // Auto-sync to database
    setTimeout(() => syncToDatabase(), 1000)
  }

  const stopShift = async () => {
    if (!shiftStartTime || !user || !currentOrgId) return

    const endTime = new Date()
    const hoursWorked = (endTime.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60)
    const today = new Date().toISOString().split('T')[0]

    try {
      // Stop any active project timer first
      if (activeTimer) {
        await stopTimer(activeTimer.id)
      }

      // Save to time_sheets
      const { error } = await supabase
        .from('time_sheets')
        .insert({
          user_id: user.id,
          org_id: currentOrgId,
          work_date: today,
          hours: hoursWorked,
          note: `Shift: ${shiftStartTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`
        })

      if (error) throw error

      // Clean up active shift record if exists
      if (activeShiftId) {
        await supabase
          .from('active_shifts')
          .delete()
          .eq('id', activeShiftId)
      }

      setIsShiftActive(false)
      setShiftStartTime(null)
      setShiftElapsedTime(0)
      setActiveShiftId(null)
      setSyncStatus('synced')
      setLastSyncTime(null)
      
      // Clear localStorage
      localStorage.removeItem('activeShift')
      
      // Reload today's hours
      await loadTodayHours()

      toast({
        title: 'Shift Completed',
        description: `Worked ${formatHours(hoursWorked)} today`,
      })
    } catch (error) {
      console.error('Error saving shift:', error)
      toast({
        title: 'Error',
        description: 'Failed to save shift data',
        variant: 'destructive',
      })
    }
  }

  const handleStartProject = () => {
    if (!isShiftActive) {
      toast({
        title: 'No Active Shift',
        description: 'Please start your shift before tracking project time',
        variant: 'destructive',
      })
      return
    }
    setShowProjectModal(true)
  }

  const handleStopAndSwitch = () => {
    if (activeTimer) {
      const taskId = activeTimer.task_id
      stopTimer(activeTimer.id)
      
      // Check if this task has materials by setting up the task ID and showing materials modal
      if (taskId) {
        setCompletedTaskId(taskId)
        setShowMaterialsModal(true)
      } else {
        // No task or no materials, go directly to project selection
        setTimeout(() => setShowProjectModal(true), 500)
      }
    }
  }

  const handleStartTimer = async (projectId: string, taskId?: string, description?: string) => {
    if (!activeShiftId) {
      toast({
        title: 'No Active Shift',
        description: 'Please ensure your shift is properly synced',
        variant: 'destructive',
      })
      return
    }

    // Pass shift_id to the timer
    await startTimer({ projectId, taskId, description, shiftId: activeShiftId })
    setShowProjectModal(false)
  }

  const handleMaterialsSaved = () => {
    setShowMaterialsModal(false)
    setCompletedTaskId(null)
    setShowProjectModal(true)
  }

  const handleMaterialsSkipped = () => {
    setShowMaterialsModal(false)
    setCompletedTaskId(null)
    setShowProjectModal(true)
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)} hours`
  }

  if (isLoadingTimer) {
    return (
      <Card className="w-full">
        <CardContent className="p-8">
          <div className="text-center">Loading timer...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5" />
          Work Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Shift Status:</span>
          </div>
          <Badge variant={isShiftActive ? "default" : "secondary"}>
            {isShiftActive ? "Active" : "Not Started"}
          </Badge>
        </div>

        {/* Timer Display */}
        {isShiftActive && (
          <div className="text-center p-4 bg-muted rounded-lg space-y-2">
            <div className="text-2xl font-mono font-semibold text-primary">
              {formatTime(shiftElapsedTime)}
            </div>
            <div className="text-sm text-muted-foreground">
              Shift started at {shiftStartTime?.toLocaleTimeString()}
            </div>
            
            {/* Project Timer Section */}
            {activeTimer && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-lg font-mono font-medium text-accent-foreground">
                  Project: {formatDuration(currentDuration)}
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
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
                {activeTimer.description && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    "{activeTimer.description}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Today's Total Hours */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total hours today:</span>
          <span className="font-semibold">{formatHours(todayHours + (shiftElapsedTime / 3600))}</span>
        </div>

        {/* Control Buttons */}
        <div className="space-y-2">
          {/* Shift Controls */}
          {!isShiftActive ? (
            <Button 
              onClick={startShift} 
              className="w-full flex items-center gap-2"
              data-testid="start-shift-button"
            >
              <Play className="h-4 w-4" />
              Clock In
            </Button>
          ) : (
            <div className="space-y-2">
              {/* Project Timer Controls */}
              {!activeTimer ? (
                <Button 
                  onClick={handleStartProject}
                  className="w-full flex items-center gap-2"
                  disabled={isStarting}
                >
                  <Play className="h-4 w-4" />
                  Start Project Timer
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => stopTimer(activeTimer.id)}
                    disabled={isStopping}
                    variant="outline"
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Project
                  </Button>
                  <Button
                    onClick={handleStopAndSwitch}
                    disabled={isStopping}
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Switch Project
                  </Button>
                </div>
              )}
              
              {/* Shift End */}
              <Button 
                onClick={stopShift} 
                variant="destructive" 
                className="w-full flex items-center gap-2"
                data-testid="end-shift-button"
              >
                <Square className="h-4 w-4" />
                Clock Out
              </Button>
            </div>
          )}
        </div>

        {/* Sync Controls (visible during active shift) */}
        {isShiftActive && (
          <div className="space-y-3">
            {/* Sync Status */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {syncStatus === 'synced' && <Wifi className="h-3 w-3 text-green-500" />}
                {syncStatus === 'pending' && <Database className="h-3 w-3 animate-pulse text-yellow-500" />}
                {syncStatus === 'error' && <WifiOff className="h-3 w-3 text-red-500" />}
                <span>
                  {syncStatus === 'synced' && 'Synced'}
                  {syncStatus === 'pending' && 'Syncing...'}
                  {syncStatus === 'error' && 'Sync Failed'}
                </span>
              </div>
              {lastSyncTime && (
                <span>Last sync: {lastSyncTime.toLocaleTimeString()}</span>
              )}
            </div>

            {/* Sync and Clear Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={syncToDatabase} 
                variant="outline" 
                size="sm" 
                className="flex-1 flex items-center gap-2"
                disabled={syncStatus === 'pending'}
              >
                <Database className="h-3 w-3" />
                Sync
              </Button>
              <Button 
                onClick={clearShiftData} 
                variant="outline" 
                size="sm" 
                className="flex-1 flex items-center gap-2"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Modals */}
        <TimerProjectModal
          open={showProjectModal}
          onOpenChange={setShowProjectModal}
          onConfirm={handleStartTimer}
          isLoading={isStarting}
        />
        
        <MaterialsModal
          open={showMaterialsModal}
          onOpenChange={(open) => {
            if (!open) {
              handleMaterialsSkipped()
            }
          }}
          taskId={completedTaskId}
          onSave={handleMaterialsSaved}
        />
      </CardContent>
    </Card>
  )
}