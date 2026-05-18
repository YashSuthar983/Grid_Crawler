import React from 'react';
import { motion } from 'motion/react';
import { GanttEntry, FaultTask, Crew } from '../utils/algorithms';
import { Clock, Users, Zap, Timer } from 'lucide-react';

interface SchedulerUIProps {
  gantt: GanttEntry[];
  faults: FaultTask[];
  crews: Crew[];
  currentTime?: number;
}

const SchedulerUI: React.FC<SchedulerUIProps> = ({ gantt, faults, crews, currentTime }) => {
  const totalTime = gantt.length > 0 ? Math.max(...gantt.map(g => g.end)) : 10;
  const scale = 40; // 40px per time unit

  return (
    <div className="flex flex-col gap-6 p-6 bg-white border border-slate-200 shadow-sm rounded-xl font-mono">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Round Robin Engine: T-Slice(2s)
        </h2>
        <div className="flex gap-4 text-[10px] text-slate-600">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            <span>Active Crews: {crews.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-red-500 animate-pulse" />
            <span>Simultaneous Faults: {faults.length}</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart Content */}
      <div className="relative overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-max">
          <div className="flex flex-col gap-2 relative">
            {currentTime !== undefined && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 transition-all duration-300 ease-linear shadow-[0_0_8px_#f43f5e]"
                style={{ left: `${(currentTime * scale) + 112}px` }} 
              />
            )}
            {crews.map((crew) => {
              const crewEntries = gantt.filter(g => g.crewId === crew.id);
              
              return (
                <div key={crew.id} className="flex items-center gap-4 group">
                  <div className="w-24 text-[10px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors shrink-0">
                    {crew.name}
                  </div>
                  <div className="relative h-10 border-l border-slate-300 flex-grow min-w-[600px] bg-slate-50 rounded shadow-inner">
                    {crewEntries.map((entry, i) => {
                      const fault = faults.find(f => f.id === entry.taskId);
                      return (
                        <motion.div
                          key={`${crew.id}-${entry.taskId}-${i}`}
                          initial={{ opacity: 0, scaleX: 0 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          className="absolute h-8 top-1 border border-blue-400/50 flex items-center justify-center rounded shadow-sm"
                          style={{
                            left: entry.start * scale,
                            width: (entry.end - entry.start) * scale,
                            backgroundColor: `hsla(${parseInt(entry.taskId) * 137.5 % 360}, 80%, 80%, 0.5)`,
                            borderLeft: '4px solid #3b82f6'
                          }}
                        >
                          <span className="text-[9px] text-slate-800 font-bold truncate px-1">
                            {fault?.substationId}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time scale */}
          <div className="flex mt-2 ml-28">
            {Array.from({ length: Math.ceil(totalTime) + 1 }).map((_, i) => (
              <div key={i} className="relative" style={{ width: scale }}>
                <div className="h-2 border-l border-slate-300" />
                <span className="absolute top-3 -left-1 text-[8px] text-slate-500 font-bold">{i}s</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Table */}
      <div className="mt-4 overflow-hidden border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-left text-[10px]">
          <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Fault Unit</th>
              <th className="px-4 py-3">Arrival</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Wait Time</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {faults.map((fault) => (
              <tr key={fault.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-800">{fault.substationId}</td>
                <td className="px-4 py-3 text-slate-600">{fault.arrivalTime}s</td>
                <td className="px-4 py-3 text-slate-600">{fault.burstTime}s</td>
                <td className="px-4 py-3 text-orange-600 flex items-center gap-1 font-bold">
                  <Timer className="w-3 h-3" />
                  {fault.waitingTime}s
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    RESOLVED
                  </span>
                </td>
              </tr>
            ))}
            {faults.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 italic">
                  No active sequencer tasks. Monitor the grid for faults.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchedulerUI;
