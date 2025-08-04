import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer';

export const DailySummary = () => {
  const { dailySummary, formatDuration } = useTimer();

  if (dailySummary.totalHours === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No time logged today</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Today's Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Hours */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total Hours</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              {formatDuration(Math.floor(dailySummary.totalHours * 3600))}
            </span>
            {dailySummary.overtimeHours > 0 && (
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                OT
              </Badge>
            )}
          </div>
        </div>

        {/* Regular vs Overtime breakdown */}
        {dailySummary.totalHours > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Regular</span>
              <span>{formatDuration(Math.floor(dailySummary.regularHours * 3600))}</span>
            </div>
            {dailySummary.overtimeHours > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overtime</span>
                <span className="text-orange-600 font-medium">
                  {formatDuration(Math.floor(dailySummary.overtimeHours * 3600))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Project breakdown */}
        {Object.keys(dailySummary.projectBreakdown).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              By Project
            </h4>
            {Object.entries(dailySummary.projectBreakdown).map(([projectName, data]) => (
              <div key={projectName} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 mr-2">{projectName}</span>
                <span className="font-medium">
                  {formatDuration(Math.floor((data as { hours: number }).hours * 3600))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};