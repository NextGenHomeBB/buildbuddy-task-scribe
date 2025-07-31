import React, { useState, useCallback } from 'react'
import { format, addDays, isAfter, isBefore } from 'date-fns'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Check, X, Plus, Minus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateOverride {
  date: string
  is_available: boolean
  note?: string
}

interface AvailabilityDay {
  day_of_week: number
  is_available: boolean
}

interface EnhancedDateAvailabilityProps {
  availability: AvailabilityDay[]
  dateOverrides: DateOverride[]
  onSetDateAvailability: (dates: string[], isAvailable: boolean) => Promise<boolean>
  onRemoveDateOverride: (date: string) => Promise<boolean>
  onClearAllOverrides: () => Promise<boolean>
  isLoading: boolean
  isSaving: boolean
  getDateOverride: (date: string) => DateOverride | undefined
}

type SelectionMode = 'single' | 'multi' | 'range'

export function EnhancedDateAvailability({
  availability,
  dateOverrides,
  onSetDateAvailability,
  onRemoveDateOverride,
  onClearAllOverrides,
  isLoading,
  isSaving,
  getDateOverride
}: EnhancedDateAvailabilityProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const { toast } = useToast()

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return

    if (selectionMode === 'single') {
      setSelectedDates([date])
    } else if (selectionMode === 'multi') {
      setSelectedDates(prev => {
        const dateString = format(date, 'yyyy-MM-dd')
        const existingIndex = prev.findIndex(d => format(d, 'yyyy-MM-dd') === dateString)
        
        if (existingIndex >= 0) {
          return prev.filter((_, index) => index !== existingIndex)
        } else {
          return [...prev, date]
        }
      })
    } else if (selectionMode === 'range') {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(date)
        setRangeEnd(null)
        setSelectedDates([date])
      } else if (rangeStart && !rangeEnd) {
        setRangeEnd(date)
        const start = isBefore(date, rangeStart) ? date : rangeStart
        const end = isAfter(date, rangeStart) ? date : rangeStart
        
        const rangeDates: Date[] = []
        let current = start
        while (!isAfter(current, end)) {
          rangeDates.push(new Date(current))
          current = addDays(current, 1)
        }
        setSelectedDates(rangeDates)
      }
    }
  }, [selectionMode, rangeStart, rangeEnd])

  const handleBulkAction = async (isAvailable: boolean) => {
    if (selectedDates.length === 0) {
      toast({
        title: "No dates selected",
        description: "Please select one or more dates first.",
        variant: "destructive"
      })
      return
    }

    const dateStrings = selectedDates.map(date => format(date, 'yyyy-MM-dd'))
    try {
      await onSetDateAvailability(dateStrings, isAvailable)
      toast({
        title: "Success",
        description: `Marked ${dateStrings.length} date(s) as ${isAvailable ? 'available' : 'unavailable'}.`
      })
      clearSelection()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update date availability.",
        variant: "destructive"
      })
    }
  }

  const clearSelection = () => {
    setSelectedDates([])
    setRangeStart(null)
    setRangeEnd(null)
  }

  const getDateStatus = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd')
    const override = getDateOverride(dateString)
    if (override) return override.is_available ? 'available' : 'unavailable'
    
    const dayOfWeek = date.getDay()
    const dayAvailability = availability.find(day => day.day_of_week === dayOfWeek)
    return dayAvailability?.is_available ? 'available' : 'unavailable'
  }

  const isDateSelected = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd')
    return selectedDates.some(selected => format(selected, 'yyyy-MM-dd') === dateString)
  }

  const groupedOverrides = dateOverrides.reduce((acc, override) => {
    const month = format(new Date(override.date), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(override)
    return acc
  }, {} as Record<string, DateOverride[]>)

  return (
    <div className="space-y-6">
      {/* Selection Mode Controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectionMode === 'single' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionMode('single')
              clearSelection()
            }}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Single
          </Button>
          <Button
            variant={selectionMode === 'multi' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionMode('multi')
              clearSelection()
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Multi-Select
          </Button>
          <Button
            variant={selectionMode === 'range' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionMode('range')
              clearSelection()
            }}
          >
            <Minus className="h-4 w-4 mr-1" />
            Date Range
          </Button>
          {selectedDates.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear ({selectedDates.length})
            </Button>
          )}
        </div>

        {selectionMode === 'range' && rangeStart && !rangeEnd && (
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
            Range started: {format(rangeStart, 'MMM d, yyyy')} - Click another date to complete the range
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="flex justify-center">
        <CalendarComponent
          mode="single"
          selected={selectedDates[0]}
          onSelect={handleDateSelect}
          className={cn(
            "rounded-lg border pointer-events-auto shadow-sm",
            "p-4 bg-card"
          )}
          modifiers={{
            available: (date) => getDateStatus(date) === 'available',
            unavailable: (date) => getDateStatus(date) === 'unavailable',
            override: (date) => !!getDateOverride(format(date, 'yyyy-MM-dd')),
            selected: isDateSelected
          }}
          modifiersStyles={{
            available: { 
              backgroundColor: 'hsl(var(--success) / 0.1)', 
              color: 'hsl(var(--success))',
              border: '1px solid hsl(var(--success) / 0.3)'
            },
            unavailable: { 
              backgroundColor: 'hsl(var(--destructive) / 0.1)', 
              color: 'hsl(var(--destructive))',
              border: '1px solid hsl(var(--destructive) / 0.3)'
            },
            override: { 
              fontWeight: 'bold',
              boxShadow: 'inset 0 0 0 2px hsl(var(--primary))'
            },
            selected: {
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              fontWeight: 'bold'
            }
          }}
        />
      </div>

      {/* Action Buttons */}
      {selectedDates.length > 0 && (
        <div className="space-y-3 p-4 bg-muted rounded-lg">
          <div className="text-sm font-medium">
            {selectedDates.length === 1 
              ? format(selectedDates[0], 'EEEE, MMMM d, yyyy')
              : `${selectedDates.length} dates selected`
            }
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => handleBulkAction(true)}
              disabled={isSaving}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark Available
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction(false)}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Mark Unavailable
            </Button>
          </div>
        </div>
      )}

      {/* Date Overrides List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Date Overrides</h4>
          {dateOverrides.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAllOverrides}
              disabled={isSaving}
              className="text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dateOverrides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No date overrides set
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-4">
              {Object.entries(groupedOverrides).map(([month, overrides]) => (
                <div key={month} className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">{month}</h5>
                  <div className="space-y-2">
                    {overrides.map((override) => (
                      <div 
                        key={override.date} 
                        className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={override.is_available ? 'default' : 'destructive'}>
                            {override.is_available ? 'Available' : 'Unavailable'}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {format(new Date(override.date), 'EEE, MMM d')}
                            </div>
                            {override.note && (
                              <div className="text-xs text-muted-foreground">{override.note}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveDateOverride(override.date)}
                          disabled={isSaving}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}