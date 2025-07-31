import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import { useWorkerAvailability } from '@/hooks/useWorkerAvailability'
import { useWorkerDateAvailability } from '@/hooks/useWorkerDateAvailability'
import { EnhancedDateAvailability } from '@/components/EnhancedDateAvailability'
import { Bell, Moon, Globe, Shield, HelpCircle, Download, Clock, Calendar, Edit, X, Plus } from 'lucide-react'
import { format, isToday } from 'date-fns'

export default function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isEditingAvailability, setIsEditingAvailability] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [availabilityTab, setAvailabilityTab] = useState("weekly")

  const {
    availability,
    isLoading: availabilityLoading,
    isSaving: availabilitySaving,
    updateDayAvailability,
    saveAvailability,
    resetToDefaults,
    getTotalWeeklyHours
  } = useWorkerAvailability()

  const {
    dateOverrides,
    isLoading: dateOverridesLoading,
    isSaving: dateOverridesSaving,
    setDateAvailability,
    setBulkDateAvailability,
    removeDateOverride,
    clearAllDateOverrides,
    getDateOverride
  } = useWorkerDateAvailability()

  const downloadTimeSheetStatement = async () => {
    if (!user) return

    setIsDownloading(true)
    try {
      // Fetch all time sheets for the user
      const { data: timeSheets, error } = await supabase
        .from('time_sheets')
        .select('*')
        .eq('user_id', user.id)
        .order('work_date', { ascending: false })

      if (error) throw error

      if (!timeSheets || timeSheets.length === 0) {
        toast({
          title: 'No Data Found',
          description: 'You have no shift hours recorded yet.',
          variant: 'destructive',
        })
        return
      }

      // Create CSV content
      const csvHeader = 'Date,Hours Worked,Note,Created At\n'
      const csvRows = timeSheets.map(sheet => {
        const date = new Date(sheet.work_date).toLocaleDateString()
        const hours = sheet.hours?.toFixed(2) || '0.00'
        const note = (sheet.note || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
        const createdAt = new Date(sheet.created_at).toLocaleString()
        return `"${date}","${hours}","${note}","${createdAt}"`
      }).join('\n')

      const csvContent = csvHeader + csvRows

      // Calculate totals
      const totalHours = timeSheets.reduce((sum, sheet) => sum + (sheet.hours || 0), 0)
      const totalDays = timeSheets.length

      // Add summary at the end
      const csvSummary = `\n\nSUMMARY:\nTotal Days Worked,${totalDays}\nTotal Hours,${totalHours.toFixed(2)}\nAverage Hours per Day,${totalDays > 0 ? (totalHours / totalDays).toFixed(2) : '0.00'}`
      const finalCsvContent = csvContent + csvSummary

      // Create and download file
      const blob = new Blob([finalCsvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `shift-hours-statement-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: 'Download Complete',
        description: `Downloaded statement with ${totalDays} work days and ${totalHours.toFixed(2)} total hours.`,
      })
    } catch (error) {
      console.error('Error downloading time sheet:', error)
      toast({
        title: 'Download Failed',
        description: 'Unable to download your shift hours statement. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
  }

  const handleSetDateAvailability = async (dates: string[], isAvailable: boolean, note?: string) => {
    return await setBulkDateAvailability(dates, isAvailable, note)
  }

  const handleRemoveDateOverride = async (date: string) => {
    return await removeDateOverride(date)
  }

  const handleClearAllOverrides = async () => {
    return await clearAllDateOverrides()
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <img 
            src="/lovable-uploads/f8eff9bf-a328-4c88-bf0b-a0a5a85c77ec.png" 
            alt="NextGen Home" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/today')}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Task Updates</div>
                <div className="text-sm text-muted-foreground">Get notified when tasks are assigned or updated</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Daily Reminders</div>
                <div className="text-sm text-muted-foreground">Receive daily task reminders</div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-sm text-muted-foreground">Toggle dark mode theme</div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Time Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Shift Hours Statement</div>
                <div className="text-sm text-muted-foreground">Download a CSV file with all your recorded shift hours</div>
              </div>
            </div>
            <Button 
              onClick={downloadTimeSheetStatement}
              disabled={isDownloading}
              className="w-full justify-start hover-scale"
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? 'Preparing Download...' : 'Download Shift Hours Statement'}
            </Button>
          </CardContent>
        </Card>

        {/* Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Worker Availability</div>
                <div className="text-sm text-muted-foreground">Manage weekly schedule and specific date overrides</div>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Manage Availability
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <DialogTitle>Worker Availability</DialogTitle>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsEditingAvailability(!isEditingAvailability)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {isEditingAvailability ? 'View Mode' : 'Edit Mode'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manage your weekly schedule and specific date overrides
                  </p>
                </DialogHeader>

                <Tabs value={availabilityTab} onValueChange={setAvailabilityTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="weekly">Weekly Schedule</TabsTrigger>
                    <TabsTrigger value="dates">Specific Dates</TabsTrigger>
                  </TabsList>

                  <TabsContent value="weekly" className="space-y-4">
                    {availabilityLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 sm:space-y-4">
                          {availability.map((day) => {
                            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const dayName = dayNames[day.day_of_week];
                            
                            return (
                              <div key={day.day_of_week} className="border rounded-lg p-3 sm:p-4">
                                <div className="flex items-center justify-between">
                                  <Label className="font-medium">{dayName}</Label>
                                  <Switch
                                    checked={day.is_available}
                                    onCheckedChange={(checked) => 
                                      isEditingAvailability && updateDayAvailability(day.day_of_week, { is_available: checked })
                                    }
                                    disabled={!isEditingAvailability}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Available days:</span>
                            <span className="font-medium">{availability.filter(day => day.is_available).length} out of 7</span>
                          </div>
                        </div>

                        {isEditingAvailability && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button 
                              onClick={async () => {
                                const success = await saveAvailability();
                                if (success) {
                                  setIsEditingAvailability(false);
                                }
                              }}
                              disabled={availabilitySaving}
                              className="flex-1"
                            >
                              {availabilitySaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setIsEditingAvailability(false);
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="dates" className="space-y-6">
                    <EnhancedDateAvailability
                      availability={availability}
                      dateOverrides={dateOverrides}
                      onSetDateAvailability={handleSetDateAvailability}
                      onRemoveDateOverride={handleRemoveDateOverride}
                      onClearAllOverrides={handleClearAllOverrides}
                      isLoading={dateOverridesLoading}
                      isSaving={dateOverridesSaving}
                      getDateOverride={getDateOverride}
                    />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('settings.languageRegion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={currentLanguage} onValueChange={changeLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Privacy Settings
            </Button>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Help & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              Help Center
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Contact Support
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Report a Bug
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  )
}
