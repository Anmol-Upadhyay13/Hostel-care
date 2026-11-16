export type UserRole = 'student' | 'technician' | 'warden';

export type ComplaintCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'Furniture'
  | 'Internet/Wi-Fi'
  | 'Cleaning'
  | 'Water Supply'
  | 'Washroom'
  | 'Other';

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ComplaintStatus =
  | 'Submitted'
  | 'Assigned'
  | 'Accepted'
  | 'Scheduled'
  | 'On the Way'
  | 'Work in Progress'
  | 'Waiting for Materials'
  | 'Completed'
  | 'Closed'
  | 'Reopened'
  | 'Rejected';

export type TechnicianAvailability = 'Available' | 'On Field' | 'Off Shift';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  hostel?: string;
  block?: string;
  roomNumber?: string;
  phone?: string;
  technicianId?: string;
}

export interface TechnicianProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  categories: ComplaintCategory[];
  availability: TechnicianAvailability;
  maxDailyJobs: number;
  rating: number;
  completedJobsTotal: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  previousStatus: ComplaintStatus | 'None';
  updatedStatus: ComplaintStatus;
  actorName: string;
  actorRole: UserRole | 'system';
  description: string;
}

export interface ComplaintMessage {
  id: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
}

export interface MaterialRequest {
  id: string;
  item: string;
  quantity: string;
  urgency: 'Standard' | 'Urgent';
  requestedBy: string;
  requestedAt: string;
  status: 'Requested' | 'Approved' | 'Delivered';
}

export interface StudentFeedback {
  rating: number;
  comment: string;
  submittedAt: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  hostelName: string;
  block: string;
  roomNumber: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  studentId: string;
  studentName: string;
  studentEmail: string;
  preferredAvailability: string;
  beforePhotos: string[];
  afterPhotos: string[];
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  scheduledVisitStart?: string;
  estimatedCompletionTime?: string;
  expectedResolutionAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  internalWorkNotes: string[];
  declineReason?: string;
  reopenCount: number;
  reopenReason?: string;
  escalationLevel: 0 | 1 | 2;
  escalationReason?: string;
  isOverdue: boolean;
  wardenVerified: boolean;
  materialRequests: MaterialRequest[];
  studentFeedback?: StudentFeedback;
  timeline: TimelineEvent[];
  messages: ComplaintMessage[];
  isDemoSample?: boolean;
}

export interface AppNotification {
  id: string;
  recipientRole: UserRole | 'all';
  recipientEmail?: string;
  complaintId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'success' | 'critical';
}

export interface MvpValidationEntry {
  id: string;
  evaluatorName: string;
  evaluatorRole: string;
  whatWasEasy: string;
  whatWasConfusing: string;
  statusTrustworthy: 'Yes' | 'Partially' | 'No';
  schedulingPractical: 'Yes' | 'Partially' | 'No';
  completionProofUseful: 'Yes' | 'Partially' | 'No';
  whatToImprove: string;
  submittedAt: string;
}

export interface GuidedDemoProgress {
  trackedComplaintId: string | null;
  step1Reported: boolean;
  step2Assigned: boolean;
  step3Accepted: boolean;
  step4Scheduled: boolean;
  step5StudentViewedSchedule: boolean;
  step6InProgress: boolean;
  step7AfterPhotoUploaded: boolean;
  step8Completed: boolean;
  step9StudentConfirmed: boolean;
  step10WardenVerifiedClosed: boolean;
}

export interface HostelCareState {
  users: UserAccount[];
  technicians: TechnicianProfile[];
  complaints: Complaint[];
  notifications: AppNotification[];
  mvpFeedback: MvpValidationEntry[];
  simulatedHoursOffset: number;
  guidedDemo: GuidedDemoProgress;
  nextComplaintSeq: number;
}
