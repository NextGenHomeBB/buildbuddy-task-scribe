import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Play, Square, Timer, Database, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TimeSheet {
  id: string
  user_id: string
  work_date: string
  hours: number
  project_id: string | null
  note: string | null
  created_at: string
}

export function ShiftTracker() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isShiftActive, setIsShiftActive] = useState(false)
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [todayHours, setTodayHours] = useState(0)
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error'>('synced')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

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
      setElapsedTime(elapsed)
    }
  }, [])

  // Auto-sync every 30 seconds during active shift
  useEffect(() => {
    let syncInterval: NodeJS.Timeout
    
    if (isShiftActive && activeShiftId) {
      syncInterval = setInterval(() => {
        syncToDatabase()
      }, 30000) // 30 seconds
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval)
    }
  }, [isShiftActive, activeShiftId])

  // Update elapsed time every second when shift is active
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (isShiftActive && shiftStartTime) {
      interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - shiftStartTime.getTime()) / 1000)
        setElapsedTime(elapsed)
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
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('time_sheets')
      .select('hours')
      .eq('user_id', user.id)
      .eq('work_date', today)

    if (error) {
      console.error('Error loading today hours:', error)
      return
    }

    const total = data.reduce((sum, sheet) => sum + (sheet.hours || 0), 0)
    setTodayHours(total)
  }

  const syncToDatabase = async () => {
    if (!user || !shiftStartTime) return

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
      
      toast({
        title: 'Synced Successfully',
        description: 'Active shift synced to database',
      })
    } catch (error) {
      console.error('Error syncing shift:', error)
      setSyncStatus('error')
      
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync shift to database',
        variant: 'destructive',
      })
    }
  }

  const clearShiftData = () => {
    setIsShiftActive(false)
    setShiftStartTime(null)
    setElapsedTime(0)
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
    setElapsedTime(0)
    
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
    if (!shiftStartTime || !user) return

    const endTime = new Date()
    const hoursWorked = (endTime.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60)
    const today = new Date().toISOString().split('T')[0]

    try {
      // Save to time_sheets
      const { error } = await supabase
        .from('time_sheets')
        .insert({
          user_id: user.id,
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
      setElapsedTime(0)
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

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)} hours`
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5" />
          Shift Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Shift Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Current Shift:</span>
          </div>
          <Badge variant={isShiftActive ? "default" : "secondary"}>
            {isShiftActive ? "Active" : "Not Started"}
          </Badge>
        </div>

        {/* Elapsed Time Display */}
        {isShiftActive && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-mono font-semibold text-primary">
              {formatTime(elapsedTime)}
            </div>
            <div className="text-sm text-muted-foreground">
              Started at {shiftStartTime?.toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Today's Total Hours */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total hours today:</span>
          <span className="font-semibold">{formatHours(todayHours + (elapsedTime / 3600))}</span>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isShiftActive ? (
            <Button onClick={startShift} className="flex-1 flex items-center gap-2">
              <Play className="h-4 w-4" />
              Start Shift
            </Button>
          ) : (
            <Button onClick={stopShift} variant="destructive" className="flex-1 flex items-center gap-2">
              <Square className="h-4 w-4" />
              End Shift
            </Button>
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
                Sync to Database
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
      </CardContent>
    </Card>
  )
}