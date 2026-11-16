import {
  AppNotification,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  HostelCareState,
  MvpValidationEntry,
  TechnicianAvailability,
  UserAccount,
  UserRole,
} from '../types/hostelCare';
import { createInitialSeedState } from '../data/seedData';

const STORAGE_KEY = 'hostelcare_prototype_state_v1';
const SYNC_EVENT = 'hostelcare:state-updated';

const bus = new EventTarget();

function getEffectiveNowMs(state: HostelCareState): number {
  return Date.now() + state.simulatedHoursOffset * 3600 * 1000;
}

function getEffectiveNowIso(state: HostelCareState): string {
  return new Date(getEffectiveNowMs(state)).toISOString();
}

function getDefaultExpectedHours(priority: ComplaintPriority): number {
  switch (priority) {
    case 'Critical':
      return 6;
    case 'High':
      return 12;
    case 'Medium':
      return 24;
    case 'Low':
      return 48;
  }
}

export function evaluateEscalations(state: HostelCareState): HostelCareState {
  const nowMs = getEffectiveNowMs(state);
  const nowIso = new Date(nowMs).toISOString();
  const newNotifs: AppNotification[] = [...state.notifications];

  const updatedComplaints = state.complaints.map((c) => {
    if (c.status === 'Completed' || c.status === 'Closed') {
      return { ...c, isOverdue: false };
    }

    const expectedMs = new Date(c.expectedResolutionAt).getTime();
    const isOverdue = nowMs > expectedMs;

    let escalationLevel: 0 | 1 | 2 = c.escalationLevel;
    let escalationReason = c.escalationReason;

    if (c.reopenCount >= 2 || (isOverdue && c.priority === 'Critical')) {
      escalationLevel = 2;
      escalationReason =
        c.reopenCount >= 2
          ? `Repeatedly reopened (${c.reopenCount}x) — requires immediate warden oversight.`
          : 'Critical complaint exceeded expected resolution window.';
    } else if (isOverdue) {
      if (escalationLevel < 1) escalationLevel = 1;
      escalationReason = 'Exceeded expected resolution time (Overdue).';
    } else if (c.priority === 'Critical') {
      if (escalationLevel < 1) escalationLevel = 1;
      escalationReason = 'Critical priority complaint flagged for immediate attention.';
    }

    // Emit overdue escalation notification once when transitioning to overdue
    if (isOverdue && !c.isOverdue) {
      newNotifs.unshift({
        id: `notif-esc-${c.id}-${Date.now()}`,
        recipientRole: 'warden',
        complaintId: c.id,
        title: `Overdue Escalation: ${c.id}`,
        message: `${c.title} (${c.hostelName} ${c.block} · Room ${c.roomNumber}) has exceeded its expected resolution time.`,
        timestamp: nowIso,
        read: false,
        severity: 'critical',
      });
    }

    return {
      ...c,
      isOverdue,
      escalationLevel,
      escalationReason,
    };
  });

  return {
    ...state,
    complaints: updatedComplaints,
    notifications: newNotifs.slice(0, 40),
  };
}

function syncStateToServer(evaluated: HostelCareState) {
  if (typeof fetch === 'undefined') return;
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(evaluated),
  }).catch(() => {
    // Graceful offline fallback: localStorage remains authoritative locally
  });
}

export async function hydrateStateFromServer(): Promise<HostelCareState | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return null;
    const serverState = (await res.json()) as HostelCareState;
    if (!serverState || !Array.isArray(serverState.complaints)) return null;
    const evaluated = evaluateEscalations(serverState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluated));
    bus.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: evaluated }));
    return evaluated;
  } catch {
    return null;
  }
}

export function loadState(): HostelCareState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = evaluateEscalations(createInitialSeedState());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as HostelCareState;
    return evaluateEscalations(parsed);
  } catch {
    const seed = evaluateEscalations(createInitialSeedState());
    return seed;
  }
}

export function saveState(next: HostelCareState): HostelCareState {
  const evaluated = evaluateEscalations(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluated));
  bus.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: evaluated }));
  syncStateToServer(evaluated);
  return evaluated;
}

export function subscribeState(listener: (state: HostelCareState) => void): () => void {
  const handleBus = (e: Event) => {
    const ce = e as CustomEvent<HostelCareState>;
    listener(ce.detail);
  };
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      listener(loadState());
    }
  };
  bus.addEventListener(SYNC_EVENT, handleBus);
  window.addEventListener('storage', handleStorage);
  return () => {
    bus.removeEventListener(SYNC_EVENT, handleBus);
    window.removeEventListener('storage', handleStorage);
  };
}

export function resetDemoData(): HostelCareState {
  const fresh = evaluateEscalations(createInitialSeedState());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  bus.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: fresh }));
  if (typeof fetch !== 'undefined') {
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
  }
  return fresh;
}

// --- Actions ---

export function registerStudentAccount(
  state: HostelCareState,
  payload: {
    name: string;
    email: string;
    password: string;
    hostel: string;
    block: string;
    roomNumber: string;
  }
): { state: HostelCareState; user: UserAccount; error?: string } {
  const exists = state.users.some(
    (u) => u.email.toLowerCase() === payload.email.trim().toLowerCase()
  );
  if (exists) {
    return { state, user: state.users[0], error: 'An account with this email already exists.' };
  }
  const newUser: UserAccount = {
    id: `user-student-${Date.now()}`,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    role: 'student',
    hostel: payload.hostel,
    block: payload.block,
    roomNumber: payload.roomNumber.trim(),
  };
  const next = saveState({
    ...state,
    users: [...state.users, newUser],
  });
  return { state: next, user: newUser };
}

export function submitComplaint(
  state: HostelCareState,
  student: UserAccount,
  input: {
    title: string;
    description: string;
    category: ComplaintCategory;
    hostelName: string;
    block: string;
    roomNumber: string;
    priority: ComplaintPriority;
    preferredAvailability: string;
    beforePhotos: string[];
  }
): { state: HostelCareState; complaint: Complaint } {
  const nowMs = getEffectiveNowMs(state);
  const nowIso = new Date(nowMs).toISOString();
  const seqStr = String(state.nextComplaintSeq).padStart(3, '0');
  const id = `HC-2026-${seqStr}`;
  const expectedHours = getDefaultExpectedHours(input.priority);
  const expectedResolutionAt = new Date(nowMs + expectedHours * 3600 * 1000).toISOString();

  const newComplaint: Complaint = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    hostelName: input.hostelName,
    block: input.block,
    roomNumber: input.roomNumber.trim(),
    priority: input.priority,
    status: 'Submitted',
    studentId: student.id,
    studentName: student.name,
    studentEmail: student.email,
    preferredAvailability: input.preferredAvailability.trim() || 'Flexible daytime hours',
    beforePhotos: input.beforePhotos,
    afterPhotos: [],
    expectedResolutionAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    internalWorkNotes: [],
    reopenCount: 0,
    escalationLevel: input.priority === 'Critical' ? 1 : 0,
    escalationReason:
      input.priority === 'Critical'
        ? 'Critical priority complaint flagged for immediate warden attention.'
        : undefined,
    isOverdue: false,
    wardenVerified: false,
    materialRequests: [],
    isDemoSample: false,
    timeline: [
      {
        id: `tl-${id}-1`,
        timestamp: nowIso,
        previousStatus: 'None',
        updatedStatus: 'Submitted',
        actorName: student.name,
        actorRole: 'student',
        description: `Complaint submitted (${input.category}, ${input.priority} priority)${
          input.beforePhotos.length > 0 ? ` with ${input.beforePhotos.length} photo(s)` : ''
        }.`,
      },
    ],
    messages: [],
  };

  const notif: AppNotification = {
    id: `notif-sub-${id}-${Date.now()}`,
    recipientRole: 'warden',
    complaintId: id,
    title: `New ${input.priority} Complaint: ${id}`,
    message: `${student.name} reported "${newComplaint.title}" in ${input.hostelName} ${input.block}, Room ${input.roomNumber}.`,
    timestamp: nowIso,
    read: false,
    severity: input.priority === 'Critical' ? 'critical' : 'info',
  };

  const isGuidedLeak =
    input.category === 'Plumbing' ||
    input.category === 'Washroom' ||
    input.title.toLowerCase().includes('leak') ||
    input.title.toLowerCase().includes('water');

  const guidedDemo = isGuidedLeak
    ? {
        ...state.guidedDemo,
        trackedComplaintId: id,
        step1Reported: true,
        step2Assigned: false,
        step3Accepted: false,
        step4Scheduled: false,
        step5StudentViewedSchedule: false,
        step6InProgress: false,
        step7AfterPhotoUploaded: false,
        step8Completed: false,
        step9StudentConfirmed: false,
        step10WardenVerifiedClosed: false,
      }
    : state.guidedDemo;

  const next = saveState({
    ...state,
    nextComplaintSeq: state.nextComplaintSeq + 1,
    complaints: [newComplaint, ...state.complaints],
    notifications: [notif, ...state.notifications],
    guidedDemo,
  });

  return { state: next, complaint: newComplaint };
}

export function assignComplaintToTechnician(
  state: HostelCareState,
  wardenName: string,
  complaintId: string,
  technicianId: string,
  priority?: ComplaintPriority
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const tech = state.technicians.find((t) => t.id === technicianId);
  if (!tech) return state;

  let assignedTarget = false;
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    assignedTarget = true;
    const prevStatus = c.status;
    const nextPriority = priority ?? c.priority;
    return {
      ...c,
      priority: nextPriority,
      status: 'Assigned' as ComplaintStatus,
      assignedTechnicianId: tech.id,
      assignedTechnicianName: tech.name,
      declineReason: undefined,
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prevStatus,
          updatedStatus: 'Assigned' as ComplaintStatus,
          actorName: wardenName,
          actorRole: 'warden' as const,
          description: `Assigned to ${tech.name} (${tech.specialty})${
            priority && priority !== c.priority ? ` · Priority set to ${priority}` : ''
          }.`,
        },
      ],
    };
  });

  if (!assignedTarget) return state;

  const target = complaints.find((c) => c.id === complaintId)!;
  const notifs: AppNotification[] = [
    {
      id: `notif-assign-tech-${Date.now()}`,
      recipientRole: 'technician',
      recipientEmail: tech.email,
      complaintId,
      title: `New Job Assigned: ${complaintId}`,
      message: `${target.title} (${target.hostelName} ${target.block} · Room ${target.roomNumber}). Review details and accept when ready.`,
      timestamp: nowIso,
      read: false,
      severity: target.priority === 'Critical' ? 'critical' : 'info',
    },
    {
      id: `notif-assign-stu-${Date.now() + 1}`,
      recipientRole: 'student',
      recipientEmail: target.studentEmail,
      complaintId,
      title: `Technician Assigned to ${complaintId}`,
      message: `${tech.name} has been assigned to your complaint and will confirm a visit schedule shortly.`,
      timestamp: nowIso,
      read: false,
      severity: 'info',
    },
    ...state.notifications,
  ];

  const isGuided =
    state.guidedDemo.trackedComplaintId === complaintId ||
    (!state.guidedDemo.trackedComplaintId && target.category === 'Plumbing');

  return saveState({
    ...state,
    complaints,
    notifications: notifs,
    guidedDemo: isGuided
      ? {
          ...state.guidedDemo,
          trackedComplaintId: complaintId,
          step1Reported: true,
          step2Assigned: true,
        }
      : state.guidedDemo,
  });
}

export function technicianAcceptOrDecline(
  state: HostelCareState,
  techName: string,
  complaintId: string,
  decision: 'accept' | 'decline',
  reason?: string
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    if (decision === 'accept') {
      return {
        ...c,
        status: 'Accepted' as ComplaintStatus,
        updatedAt: nowIso,
        timeline: [
          ...c.timeline,
          {
            id: `tl-${c.id}-${c.timeline.length + 1}`,
            timestamp: nowIso,
            previousStatus: prev,
            updatedStatus: 'Accepted' as ComplaintStatus,
            actorName: techName,
            actorRole: 'technician' as const,
            description: 'Technician reviewed complaint details and accepted the assignment.',
          },
        ],
      };
    }
    return {
      ...c,
      status: 'Rejected' as ComplaintStatus,
      declineReason: reason?.trim() || 'Scheduling conflict / outside trade scope.',
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: 'Rejected' as ComplaintStatus,
          actorName: techName,
          actorRole: 'technician' as const,
          description: `Assignment declined: ${reason?.trim() || 'Unavailable for current slot'}. Sent back to Warden.`,
        },
      ],
    };
  });

  const target = complaints.find((c) => c.id === complaintId);
  if (!target) return state;

  const newNotif: AppNotification =
    decision === 'accept'
      ? {
          id: `notif-acc-${Date.now()}`,
          recipientRole: 'student',
          recipientEmail: target.studentEmail,
          complaintId,
          title: `Technician Accepted ${complaintId}`,
          message: `${techName} accepted your complaint and is preparing a visit slot.`,
          timestamp: nowIso,
          read: false,
          severity: 'info',
        }
      : {
          id: `notif-dec-${Date.now()}`,
          recipientRole: 'warden',
          complaintId,
          title: `Job Declined by Technician: ${complaintId}`,
          message: `${techName} declined ${complaintId}. Reason: ${target.declineReason}. Please reassign.`,
          timestamp: nowIso,
          read: false,
          severity: 'warning',
        };

  return saveState({
    ...state,
    complaints,
    notifications: [newNotif, ...state.notifications],
    guidedDemo:
      decision === 'accept' && state.guidedDemo.trackedComplaintId === complaintId
        ? { ...state.guidedDemo, step3Accepted: true }
        : state.guidedDemo,
  });
}

export function technicianScheduleVisit(
  state: HostelCareState,
  techName: string,
  complaintId: string,
  scheduledVisitStart: string,
  estimatedCompletionTime: string,
  note?: string
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    const formattedStart = new Date(scheduledVisitStart).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextNotes = note?.trim() ? [...c.internalWorkNotes, note.trim()] : c.internalWorkNotes;
    return {
      ...c,
      status: 'Scheduled' as ComplaintStatus,
      scheduledVisitStart,
      estimatedCompletionTime,
      expectedResolutionAt: estimatedCompletionTime,
      internalWorkNotes: nextNotes,
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: 'Scheduled' as ComplaintStatus,
          actorName: techName,
          actorRole: 'technician' as const,
          description: `Visit scheduled for ${formattedStart} with realistic completion estimate set.`,
        },
      ],
    };
  });

  const target = complaints.find((c) => c.id === complaintId);
  if (!target) return state;

  const notif: AppNotification = {
    id: `notif-sch-${Date.now()}`,
    recipientRole: 'student',
    recipientEmail: target.studentEmail,
    complaintId,
    title: `Visit Scheduled for ${complaintId}`,
    message: `${techName} scheduled your repair visit for ${new Date(scheduledVisitStart).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}.`,
    timestamp: nowIso,
    read: false,
    severity: 'info',
  };

  return saveState({
    ...state,
    complaints,
    notifications: [notif, ...state.notifications],
    guidedDemo:
      state.guidedDemo.trackedComplaintId === complaintId
        ? { ...state.guidedDemo, step4Scheduled: true }
        : state.guidedDemo,
  });
}

export function technicianUpdateStatus(
  state: HostelCareState,
  techName: string,
  complaintId: string,
  nextStatus: ComplaintStatus,
  workNote?: string,
  afterPhotosToAdd?: string[]
): { state: HostelCareState; error?: string } {
  const existing = state.complaints.find((c) => c.id === complaintId);
  if (!existing) return { state };

  const combinedAfterPhotos = [
    ...existing.afterPhotos,
    ...(afterPhotosToAdd ?? []),
  ];

  if (nextStatus === 'Completed' && combinedAfterPhotos.length === 0) {
    return {
      state,
      error: 'Completion photograph proof is required before marking a job as Completed.',
    };
  }

  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    const notes = workNote?.trim() ? [...c.internalWorkNotes, workNote.trim()] : c.internalWorkNotes;
    return {
      ...c,
      status: nextStatus,
      afterPhotos: combinedAfterPhotos,
      internalWorkNotes: notes,
      resolvedAt: nextStatus === 'Completed' ? nowIso : c.resolvedAt,
      isOverdue: nextStatus === 'Completed' ? false : c.isOverdue,
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: nextStatus,
          actorName: techName,
          actorRole: 'technician' as const,
          description:
            nextStatus === 'Completed'
              ? `Work completed with ${combinedAfterPhotos.length} completion photo(s)${
                  workNote?.trim() ? ` — "${workNote.trim()}"` : ''
                }. Sent to student for confirmation.`
              : `Status updated to ${nextStatus}${workNote?.trim() ? `: ${workNote.trim()}` : ''}.`,
        },
      ],
    };
  });

  const target = complaints.find((c) => c.id === complaintId)!;
  const notifs: AppNotification[] = [...state.notifications];

  if (nextStatus === 'Completed') {
    notifs.unshift({
      id: `notif-comp-${Date.now()}`,
      recipientRole: 'student',
      recipientEmail: target.studentEmail,
      complaintId,
      title: `Work Completed — Confirm Resolution (${complaintId})`,
      message: `${techName} uploaded completion proof for "${target.title}". Please inspect and confirm whether the issue is resolved.`,
      timestamp: nowIso,
      read: false,
      severity: 'success',
    });
  } else {
    notifs.unshift({
      id: `notif-upd-${Date.now()}`,
      recipientRole: 'student',
      recipientEmail: target.studentEmail,
      complaintId,
      title: `${complaintId}: ${nextStatus}`,
      message: `${techName} updated status to "${nextStatus}".`,
      timestamp: nowIso,
      read: false,
      severity: 'info',
    });
  }

  let guided = state.guidedDemo;
  if (guided.trackedComplaintId === complaintId) {
    guided = {
      ...guided,
      step6InProgress:
        guided.step6InProgress ||
        nextStatus === 'Work in Progress' ||
        nextStatus === 'On the Way',
      step7AfterPhotoUploaded: guided.step7AfterPhotoUploaded || combinedAfterPhotos.length > 0,
      step8Completed: guided.step8Completed || nextStatus === 'Completed',
    };
  }

  const next = saveState({
    ...state,
    complaints,
    notifications: notifs,
    guidedDemo: guided,
  });

  return { state: next };
}

export function addAfterPhotosToComplaint(
  state: HostelCareState,
  techName: string,
  complaintId: string,
  photos: string[]
): HostelCareState {
  if (photos.length === 0) return state;
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    return {
      ...c,
      afterPhotos: [...c.afterPhotos, ...photos],
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: c.status,
          updatedStatus: c.status,
          actorName: techName,
          actorRole: 'technician' as const,
          description: `Uploaded ${photos.length} after-repair verification photograph(s).`,
        },
      ],
    };
  });

  return saveState({
    ...state,
    complaints,
    guidedDemo:
      state.guidedDemo.trackedComplaintId === complaintId
        ? { ...state.guidedDemo, step7AfterPhotoUploaded: true }
        : state.guidedDemo,
  });
}

export function requestMaterialForJob(
  state: HostelCareState,
  techName: string,
  complaintId: string,
  item: string,
  quantity: string,
  urgency: 'Standard' | 'Urgent'
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    return {
      ...c,
      status: 'Waiting for Materials' as ComplaintStatus,
      updatedAt: nowIso,
      materialRequests: [
        ...c.materialRequests,
        {
          id: `mat-${Date.now()}`,
          item: item.trim(),
          quantity: quantity.trim(),
          urgency,
          requestedBy: techName,
          requestedAt: nowIso,
          status: 'Requested' as const,
        },
      ],
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: 'Waiting for Materials' as ComplaintStatus,
          actorName: techName,
          actorRole: 'technician' as const,
          description: `Requested material/assistance: ${item.trim()} (${quantity.trim()}, ${urgency}).`,
        },
      ],
    };
  });

  const notif: AppNotification = {
    id: `notif-mat-${Date.now()}`,
    recipientRole: 'warden',
    complaintId,
    title: `Material Request on ${complaintId}`,
    message: `${techName} requested ${item.trim()} (${quantity.trim()}) for ${complaintId}.`,
    timestamp: nowIso,
    read: false,
    severity: urgency === 'Urgent' ? 'warning' : 'info',
  };

  return saveState({
    ...state,
    complaints,
    notifications: [notif, ...state.notifications],
  });
}

export function studentConfirmOrReopen(
  state: HostelCareState,
  studentName: string,
  complaintId: string,
  resolved: boolean,
  options?: {
    rating?: number;
    feedbackComment?: string;
    reopenReason?: string;
  }
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  let techIdToCredit: string | undefined;

  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    if (resolved) {
      techIdToCredit = c.assignedTechnicianId;
      return {
        ...c,
        status: 'Closed' as ComplaintStatus,
        closedAt: nowIso,
        updatedAt: nowIso,
        isOverdue: false,
        studentFeedback: options?.rating
          ? {
              rating: options.rating,
              comment: options.feedbackComment?.trim() || 'Confirmed resolved.',
              submittedAt: nowIso,
            }
          : c.studentFeedback,
        timeline: [
          ...c.timeline,
          {
            id: `tl-${c.id}-${c.timeline.length + 1}`,
            timestamp: nowIso,
            previousStatus: prev,
            updatedStatus: 'Closed' as ComplaintStatus,
            actorName: studentName,
            actorRole: 'student' as const,
            description: `Student confirmed problem is resolved${
              options?.rating ? ` (Rated ${options.rating}/5)` : ''
            }.`,
          },
        ],
      };
    }

    const nextReopenCount = c.reopenCount + 1;
    const nextEscalation: 0 | 1 | 2 = nextReopenCount >= 2 ? 2 : 1;
    const reasonText =
      options?.reopenReason?.trim() || 'Issue persists after attempted repair.';
    return {
      ...c,
      status: 'Reopened' as ComplaintStatus,
      reopenCount: nextReopenCount,
      reopenReason: reasonText,
      escalationLevel: nextEscalation,
      escalationReason:
        nextReopenCount >= 2
          ? `Repeatedly reopened (${nextReopenCount}x) — high-priority warden escalation.`
          : 'Reopened by student after completion check.',
      wardenVerified: false,
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: 'Reopened' as ComplaintStatus,
          actorName: studentName,
          actorRole: 'student' as const,
          description: `Student reported issue still exists: "${reasonText}". Escalated to Warden & Technician.`,
        },
      ],
    };
  });

  const technicians = techIdToCredit
    ? state.technicians.map((t) =>
        t.id === techIdToCredit
          ? { ...t, completedJobsTotal: t.completedJobsTotal + 1 }
          : t
      )
    : state.technicians;

  const target = complaints.find((c) => c.id === complaintId);
  if (!target) return state;

  const notifs: AppNotification[] = resolved
    ? [
        {
          id: `notif-closed-${Date.now()}`,
          recipientRole: 'warden',
          complaintId,
          title: `Student Confirmed Resolution: ${complaintId}`,
          message: `${studentName} confirmed "${target.title}" is resolved. Ready for final warden audit.`,
          timestamp: nowIso,
          read: false,
          severity: 'success',
        },
        ...state.notifications,
      ]
    : [
        {
          id: `notif-reopen-w-${Date.now()}`,
          recipientRole: 'warden',
          complaintId,
          title: `Complaint Reopened: ${complaintId}`,
          message: `${studentName} reported the issue persists: "${target.reopenReason}".`,
          timestamp: nowIso,
          read: false,
          severity: 'critical',
        },
        ...(target.assignedTechnicianId
          ? [
              {
                id: `notif-reopen-t-${Date.now() + 1}`,
                recipientRole: 'technician' as const,
                complaintId,
                title: `Job Reopened: ${complaintId}`,
                message: `Student reported issue persists on ${complaintId}. Check notes & revisit.`,
                timestamp: nowIso,
                read: false,
                severity: 'warning' as const,
              },
            ]
          : []),
        ...state.notifications,
      ];

  return saveState({
    ...state,
    complaints,
    technicians,
    notifications: notifs,
    guidedDemo:
      resolved && state.guidedDemo.trackedComplaintId === complaintId
        ? { ...state.guidedDemo, step9StudentConfirmed: true }
        : state.guidedDemo,
  });
}

export function wardenVerifyOrReopen(
  state: HostelCareState,
  wardenName: string,
  complaintId: string,
  action: 'verify' | 'reopen' | 'escalate',
  note?: string
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    const prev = c.status;
    if (action === 'verify') {
      return {
        ...c,
        status: 'Closed' as ComplaintStatus,
        wardenVerified: true,
        closedAt: c.closedAt ?? nowIso,
        updatedAt: nowIso,
        timeline: [
          ...c.timeline,
          {
            id: `tl-${c.id}-${c.timeline.length + 1}`,
            timestamp: nowIso,
            previousStatus: prev,
            updatedStatus: 'Closed' as ComplaintStatus,
            actorName: wardenName,
            actorRole: 'warden' as const,
            description: note?.trim() || 'Warden verified completion photos and closed complaint record.',
          },
        ],
      };
    }
    if (action === 'escalate') {
      return {
        ...c,
        priority: 'Critical' as ComplaintPriority,
        escalationLevel: 2 as const,
        escalationReason: note?.trim() || 'Manually escalated by Warden for immediate resolution.',
        updatedAt: nowIso,
        timeline: [
          ...c.timeline,
          {
            id: `tl-${c.id}-${c.timeline.length + 1}`,
            timestamp: nowIso,
            previousStatus: prev,
            updatedStatus: c.status,
            actorName: wardenName,
            actorRole: 'warden' as const,
            description: `Escalated to Critical attention: ${note?.trim() || 'Urgent follow-up required.'}`,
          },
        ],
      };
    }
    return {
      ...c,
      status: 'Reopened' as ComplaintStatus,
      wardenVerified: false,
      reopenCount: c.reopenCount + 1,
      escalationLevel: 2 as const,
      escalationReason: 'Reopened by Warden after quality review.',
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: prev,
          updatedStatus: 'Reopened' as ComplaintStatus,
          actorName: wardenName,
          actorRole: 'warden' as const,
          description: `Reopened by Warden: ${note?.trim() || 'Further inspection required.'}`,
        },
      ],
    };
  });

  return saveState({
    ...state,
    complaints,
    guidedDemo:
      action === 'verify' && state.guidedDemo.trackedComplaintId === complaintId
        ? { ...state.guidedDemo, step10WardenVerifiedClosed: true }
        : state.guidedDemo,
  });
}

export function changeComplaintPriority(
  state: HostelCareState,
  wardenName: string,
  complaintId: string,
  priority: ComplaintPriority
): HostelCareState {
  const nowIso = getEffectiveNowIso(state);
  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId || c.priority === priority) return c;
    return {
      ...c,
      priority,
      escalationLevel: priority === 'Critical' ? (Math.max(c.escalationLevel, 1) as 0 | 1 | 2) : c.escalationLevel,
      updatedAt: nowIso,
      timeline: [
        ...c.timeline,
        {
          id: `tl-${c.id}-${c.timeline.length + 1}`,
          timestamp: nowIso,
          previousStatus: c.status,
          updatedStatus: c.status,
          actorName: wardenName,
          actorRole: 'warden' as const,
          description: `Priority updated from ${c.priority} to ${priority}.`,
        },
      ],
    };
  });
  return saveState({ ...state, complaints });
}

export function postComplaintMessage(
  state: HostelCareState,
  complaintId: string,
  senderName: string,
  senderRole: UserRole,
  content: string
): HostelCareState {
  const trimmed = content.trim();
  if (!trimmed) return state;
  const nowIso = getEffectiveNowIso(state);

  const complaints = state.complaints.map((c) => {
    if (c.id !== complaintId) return c;
    return {
      ...c,
      updatedAt: nowIso,
      messages: [
        ...c.messages,
        {
          id: `msg-${Date.now()}`,
          senderName,
          senderRole,
          content: trimmed,
          timestamp: nowIso,
        },
      ],
    };
  });

  return saveState({ ...state, complaints });
}

export function updateTechnicianAvailability(
  state: HostelCareState,
  technicianId: string,
  availability: TechnicianAvailability
): HostelCareState {
  const technicians = state.technicians.map((t) =>
    t.id === technicianId ? { ...t, availability } : t
  );
  return saveState({ ...state, technicians });
}

export function markGuidedStep5Viewed(
  state: HostelCareState,
  complaintId: string
): HostelCareState {
  if (
    state.guidedDemo.trackedComplaintId === complaintId &&
    state.guidedDemo.step4Scheduled &&
    !state.guidedDemo.step5StudentViewedSchedule
  ) {
    return saveState({
      ...state,
      guidedDemo: { ...state.guidedDemo, step5StudentViewedSchedule: true },
    });
  }
  return state;
}

export function advanceSimulatedTime(
  state: HostelCareState,
  hoursToAdd: number
): HostelCareState {
  return saveState({
    ...state,
    simulatedHoursOffset: state.simulatedHoursOffset + hoursToAdd,
  });
}

export function markAllNotificationsRead(
  state: HostelCareState,
  role: UserRole
): HostelCareState {
  return saveState({
    ...state,
    notifications: state.notifications.map((n) =>
      n.recipientRole === role || n.recipientRole === 'all' ? { ...n, read: true } : n
    ),
  });
}

export function submitMvpFeedback(
  state: HostelCareState,
  entry: Omit<MvpValidationEntry, 'id' | 'submittedAt'>
): HostelCareState {
  const newEntry: MvpValidationEntry = {
    ...entry,
    id: `mvp-${Date.now()}`,
    submittedAt: getEffectiveNowIso(state),
  };
  return saveState({
    ...state,
    mvpFeedback: [newEntry, ...state.mvpFeedback],
  });
}
