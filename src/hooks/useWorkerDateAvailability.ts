import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export interface WorkerDateAvailability {
  id: string
  worker_id: string
  date: string
  is_available: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface DateOverride {
  date: string
  is_available: boolean
  note?: string
}

export function useWorkerDateAvailability() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load date overrides from database
  useEffect(() => {
    const loadDateOverrides = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('worker_date_availability')
          .select('*')
          .eq('worker_id', user.id)
          .order('date')

        if (error) throw error

        if (data) {
          const overrides = data.map(item => ({
            date: item.date,
            is_available: item.is_available,
            note: item.note || undefined,
          }))
          setDateOverrides(overrides)
        }
      } catch (error) {
        console.error('Error loading date overrides:', error)
        toast({
          title: 'Error',
          description: 'Failed to load date overrides',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadDateOverrides()
  }, [user, toast])

  const setDateAvailability = async (date: string, isAvailable: boolean, note?: string) => {
    if (!user) return false

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('worker_date_availability')
        .upsert({
          worker_id: user.id,
          date,
          is_available: isAvailable,
          note: note || null,
        }, {
          onConflict: 'worker_id,date'
        })

      if (error) throw error

      // Update local state
      setDateOverrides(prev => {
        const existingIndex = prev.findIndex(override => override.date === date)
        const newOverride = { date, is_available: isAvailable, note }

        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = newOverride
          return updated
        } else {
          return [...prev, newOverride].sort((a, b) => a.date.localeCompare(b.date))
        }
      })

      toast({
        title: 'Success',
        description: `Date marked as ${isAvailable ? 'available' : 'unavailable'}`,
      })
      return true
    } catch (error) {
      console.error('Error setting date availability:', error)
      toast({
        title: 'Error',
        description: 'Failed to update date availability',
        variant: 'destructive',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const setBulkDateAvailability = async (dates: string[], isAvailable: boolean, note?: string) => {
    if (!user || dates.length === 0) return false

    setIsSaving(true)
    try {
      const upsertData = dates.map(date => ({
        worker_id: user.id,
        date,
        is_available: isAvailable,
        note: note || null,
      }))

      const { error } = await supabase
        .from('worker_date_availability')
        .upsert(upsertData, {
          onConflict: 'worker_id,date'
        })

      if (error) throw error

      // Update local state
      setDateOverrides(prev => {
        const filtered = prev.filter(override => !dates.includes(override.date))
        const newOverrides = dates.map(date => ({ date, is_available: isAvailable, note }))
        return [...filtered, ...newOverrides].sort((a, b) => a.date.localeCompare(b.date))
      })

      return true
    } catch (error) {
      console.error('Error setting bulk date availability:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const clearAllDateOverrides = async () => {
    if (!user) return false

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('worker_date_availability')
        .delete()
        .eq('worker_id', user.id)

      if (error) throw error

      setDateOverrides([])
      
      toast({
        title: 'Success',
        description: 'All date overrides cleared',
      })
      return true
    } catch (error) {
      console.error('Error clearing date overrides:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear date overrides',
        variant: 'destructive',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const removeDateOverride = async (date: string) => {
    if (!user) return false

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('worker_date_availability')
        .delete()
        .eq('worker_id', user.id)
        .eq('date', date)

      if (error) throw error

      // Update local state
      setDateOverrides(prev => prev.filter(override => override.date !== date))

      toast({
        title: 'Success',
        description: 'Date override removed',
      })
      return true
    } catch (error) {
      console.error('Error removing date override:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove date override',
        variant: 'destructive',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const getDateOverride = (date: string): DateOverride | undefined => {
    return dateOverrides.find(override => override.date === date)
  }

  return {
    dateOverrides,
    isLoading,
    isSaving,
    setDateAvailability,
    setBulkDateAvailability,
    removeDateOverride,
    clearAllDateOverrides,
    getDateOverride,
  }
}