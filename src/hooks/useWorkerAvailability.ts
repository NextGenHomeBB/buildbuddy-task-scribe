import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export interface WorkerAvailability {
  id: string
  worker_id: string
  day_of_week: number
  is_available: boolean
  start_time: string | null
  end_time: string | null
  max_hours: number | null
  created_at: string
  updated_at: string
}

export interface AvailabilityDay {
  day_of_week: number
  is_available: boolean
  start_time: string
  end_time: string
  max_hours: number
}

const DEFAULT_AVAILABILITY: AvailabilityDay[] = [
  { day_of_week: 0, is_available: false, start_time: '08:00', end_time: '17:00', max_hours: 8 }, // Sunday
  { day_of_week: 1, is_available: true, start_time: '08:00', end_time: '17:00', max_hours: 8 },  // Monday
  { day_of_week: 2, is_available: true, start_time: '08:00', end_time: '17:00', max_hours: 8 },  // Tuesday
  { day_of_week: 3, is_available: true, start_time: '08:00', end_time: '17:00', max_hours: 8 },  // Wednesday
  { day_of_week: 4, is_available: true, start_time: '08:00', end_time: '17:00', max_hours: 8 },  // Thursday
  { day_of_week: 5, is_available: true, start_time: '08:00', end_time: '17:00', max_hours: 8 },  // Friday
  { day_of_week: 6, is_available: false, start_time: '08:00', end_time: '17:00', max_hours: 8 }, // Saturday
]

export function useWorkerAvailability() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [availability, setAvailability] = useState<AvailabilityDay[]>(DEFAULT_AVAILABILITY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load availability from database
  useEffect(() => {
    const loadAvailability = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('worker_availability')
          .select('*')
          .eq('worker_id', user.id)
          .order('day_of_week')

        if (error) throw error

        if (data && data.length > 0) {
          // Convert database format to local format
          const loadedAvailability = DEFAULT_AVAILABILITY.map(defaultDay => {
            const dbDay = data.find(d => d.day_of_week === defaultDay.day_of_week)
            if (dbDay) {
              return {
                day_of_week: dbDay.day_of_week,
                is_available: dbDay.is_available,
                start_time: dbDay.start_time || defaultDay.start_time,
                end_time: dbDay.end_time || defaultDay.end_time,
                max_hours: dbDay.max_hours || defaultDay.max_hours,
              }
            }
            return defaultDay
          })
          setAvailability(loadedAvailability)
        }
      } catch (error) {
        console.error('Error loading availability:', error)
        toast({
          title: 'Error',
          description: 'Failed to load availability settings',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadAvailability()
  }, [user, toast])

  const updateDayAvailability = (dayOfWeek: number, updates: Partial<AvailabilityDay>) => {
    setAvailability(prev => 
      prev.map(day => 
        day.day_of_week === dayOfWeek 
          ? { ...day, ...updates }
          : day
      )
    )
  }

  const saveAvailability = async () => {
    if (!user) return false

    setIsSaving(true)
    try {
      // Prepare data for upsert
      const upsertData = availability.map(day => ({
        worker_id: user.id,
        day_of_week: day.day_of_week,
        is_available: day.is_available,
        start_time: day.is_available ? day.start_time : null,
        end_time: day.is_available ? day.end_time : null,
        max_hours: day.is_available ? day.max_hours : null,
      }))

      const { error } = await supabase
        .from('worker_availability')
        .upsert(upsertData, {
          onConflict: 'worker_id,day_of_week'
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Availability settings saved successfully',
      })
      return true
    } catch (error) {
      console.error('Error saving availability:', error)
      toast({
        title: 'Error',
        description: 'Failed to save availability settings',
        variant: 'destructive',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefaults = () => {
    setAvailability([...DEFAULT_AVAILABILITY])
  }

  const getTotalWeeklyHours = () => {
    return availability
      .filter(day => day.is_available)
      .reduce((total, day) => total + (day.max_hours || 0), 0)
  }

  return {
    availability,
    isLoading,
    isSaving,
    updateDayAvailability,
    saveAvailability,
    resetToDefaults,
    getTotalWeeklyHours,
  }
}