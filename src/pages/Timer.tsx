import { WorkTimer } from '@/components/WorkTimer';
import { DailySummary } from '@/components/DailySummary';
import { MobileBottomNav } from '@/components/MobileBottomNav';

export default function Timer() {

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Work Timer</h1>

          {/* Unified Work Timer */}
          <WorkTimer />

          {/* Daily Summary */}
          <DailySummary />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}