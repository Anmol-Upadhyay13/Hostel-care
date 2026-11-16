import { useState } from 'react';
import { ArrowRight, Building2, MapPin } from 'lucide-react';
import { Complaint, UserRole } from '../../types/hostelCare';
import { formatDateTime } from '../../utils/complaintHelpers';
import { HostelCampus3D } from './HostelCampus3D';
import { PriorityReadout, StatusReadout } from './StatusReadout';

interface CampusTwinScreenProps {
  complaints: Complaint[];
  currentRole: UserRole;
  onOpenComplaint: (complaintId: string) => void;
}

export function CampusTwinScreen({
  complaints,
  currentRole,
  onOpenComplaint,
}: CampusTwinScreenProps) {
  const [selected, setSelected] = useState<Complaint | null>(complaints[0] ?? null);

  const actionLabel =
    currentRole === 'warden'
      ? 'Manage & Assign'
      : currentRole === 'technician'
      ? 'Open Job Workbench'
      : 'Inspect Timeline';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 dark:text-white">
            Interactive 3D Hostel Campus Twin
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Orbit North Hall and South Hall, toggle Hologram Blueprint wireframe, separate
            floors with Exploded View, and click any 3D marker to inspect room-level fault status.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <HostelCampus3D
            complaints={complaints}
            height={540}
            selectedComplaintId={selected?.id}
            onSelectComplaint={(c) => setSelected(c)}
            onOpenComplaintDetail={(c) => onOpenComplaint(c.id)}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          {selected ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <span className="font-mono text-xs font-semibold text-navy-900 dark:text-sky-400">
                  {selected.id}
                </span>
                <div className="flex items-center gap-2">
                  <PriorityReadout priority={selected.priority} />
                  <StatusReadout status={selected.status} compact />
                </div>
              </div>

              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                {selected.title}
              </h2>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-sky-400" />
                <span>
                  {selected.hostelName} {selected.block} · Room {selected.roomNumber}
                </span>
              </p>

              <p className="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {selected.description}
              </p>

              <div className="mt-4 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Category</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selected.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Assigned Tech</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selected.assignedTechnicianName ?? 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target SLA</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-sky-300">
                    {formatDateTime(selected.expectedResolutionAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenComplaint(selected.id)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-navy-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0c1322]">
              <Building2 className="mx-auto mb-2 h-6 w-6 text-slate-400 dark:text-sky-400" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select a 3D room marker in the campus viewport to inspect details.
              </p>
            </div>
          )}

          {/* Quick Wing Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              Wing Fault Summary
            </h3>
            <div className="mt-3 divide-y divide-slate-200 text-xs dark:divide-slate-800">
              {[
                { hostel: 'North Hall', block: 'Block A' },
                { hostel: 'North Hall', block: 'Block B' },
                { hostel: 'South Hall', block: 'Block A' },
                { hostel: 'South Hall', block: 'Block B' },
              ].map((w) => {
                const sub = complaints.filter(
                  (c) => c.hostelName === w.hostel && c.block === w.block
                );
                const open = sub.filter(
                  (c) => c.status !== 'Closed' && c.status !== 'Completed'
                ).length;
                const overdue = sub.filter((c) => c.isOverdue).length;
                return (
                  <div
                    key={`${w.hostel}-${w.block}`}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {w.hostel} · {w.block}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-sky-400">
                      {open} open{overdue > 0 ? ` · ${overdue} overdue` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
