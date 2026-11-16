import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cpu,
  Image as ImageIcon,
  Loader2,
  Moon,
  ShieldCheck,
  Sun,
  Wrench,
} from 'lucide-react';
import { DEMO_IMAGES } from '../../data/seedData';
import { AiTriageResult, requestAiFaultTriage } from '../../services/aiClient';
import { HostelCareState, UserRole } from '../../types/hostelCare';
import { HostelCampus3D } from '../shared/HostelCampus3D';
import { BeforeAfterComparisonSlider } from '../shared/PhotoGallery';
import { useTheme } from '../shared/ThemeProvider';

interface LandingPageProps {
  state: HostelCareState;
  onGoToLogin: (prefillRole?: UserRole) => void;
  onOpenMvpFeedback: () => void;
}

interface LifecycleStageDemo {
  id: string;
  step: string;
  title: string;
  statusBadge: string;
  ownerRole: UserRole;
  studentView: string;
  technicianView: string;
  wardenView: string;
}

const LIFECYCLE_STAGES: LifecycleStageDemo[] = [
  {
    id: 'submitted',
    step: '01',
    title: 'Student Reports Fault',
    statusBadge: 'Submitted',
    ownerRole: 'student',
    studentView:
      'Receives unique complaint ID (e.g. HC-1042) with room metadata, preferred visit window, and live status milestone bar.',
    technicianView: 'Awaiting Warden triage and trade-category dispatch.',
    wardenView:
      'Complaint enters triage queue immediately with priority badge and 3D Campus Twin room marker.',
  },
  {
    id: 'assigned',
    step: '02',
    title: 'Warden Assigns Specialist',
    statusBadge: 'Assigned',
    ownerRole: 'warden',
    studentView:
      'Timeline shows assigned technician name, specialization, and target SLA timestamp.',
    technicianView:
      'Job appears in Assigned Queue with uploaded fault photos and block/room coordinates.',
    wardenView:
      'Balances job load across plumbers, electricians, and carpenters; adjusts priority if critical.',
  },
  {
    id: 'scheduled',
    step: '03',
    title: 'Technician Sets Visit Window',
    statusBadge: 'Scheduled',
    ownerRole: 'technician',
    studentView:
      'Sees realistic expected arrival and completion times without arbitrary automated promises.',
    technicianView:
      'Accepts job (or declines with reason) and locks a practical arrival slot into Daily Schedule.',
    wardenView:
      'Verifies SLA alignment and monitors technician shift capacity in real time.',
  },
  {
    id: 'progress',
    step: '04',
    title: 'On-Site Work & Materials',
    statusBadge: 'Work in Progress',
    ownerRole: 'technician',
    studentView:
      'Live status transitions (On the Way → Work in Progress) plus two-way message thread for room access.',
    technicianView:
      'Logs field notes, requests store spare parts if needed, and updates job progress directly.',
    wardenView:
      'Tracks active work orders and receives automatic escalation alerts if SLA threshold is exceeded.',
  },
  {
    id: 'proof',
    step: '05',
    title: 'Mandatory After-Photo Proof',
    statusBadge: 'Completed',
    ownerRole: 'technician',
    studentView:
      'Inspects side-by-side Before & After slider photography showing verified physical repair.',
    technicianView:
      'System enforces uploading completion photography and resolution notes before marking Completed.',
    wardenView:
      'Audits photographic proof directly from the management console or 3D Campus Twin.',
  },
  {
    id: 'verified',
    step: '06',
    title: 'Student Confirm or Reopen',
    statusBadge: 'Closed / Reopened',
    ownerRole: 'student',
    studentView:
      'Confirms "Yes, Issue Resolved" (with 1–5 star rating) or "No, Reopen" if the fault persists.',
    technicianView:
      'Receives closure rating or immediate priority follow-up assignment if reopened.',
    wardenView:
      'Gives final administrative sign-off; reopened tickets automatically escalate to Critical.',
  },
];

export function LandingPage({
  state,
  onGoToLogin,
  onOpenMvpFeedback,
}: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [heroVisualMode, setHeroVisualMode] = useState<'3d' | 'photo'>('3d');
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [activeProofPair, setActiveProofPair] = useState<'plumbing' | 'electrical'>('plumbing');

  const [triagePreset, setTriagePreset] = useState<'leak' | 'socket' | 'wifi'>('leak');
  const [triageInput, setTriageInput] = useState(
    'Water is dripping continuously under the North Hall Room 204 bathroom sink pipe joint onto the tiles.'
  );
  const [triagePhoto, setTriagePhoto] = useState<string>(DEMO_IMAGES.leakBefore);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<AiTriageResult | null>(null);

  const handleSelectTriagePreset = (preset: 'leak' | 'socket' | 'wifi') => {
    setTriagePreset(preset);
    setTriageError(null);
    if (preset === 'leak') {
      setTriageInput(
        'Water is dripping continuously under the North Hall Room 204 bathroom sink pipe joint onto the tiles.'
      );
      setTriagePhoto(DEMO_IMAGES.leakBefore);
    } else if (preset === 'socket') {
      setTriageInput(
        'Study desk 3-pin wall socket faceplate is cracked with dark scorch marks when plugging in laptop charger.'
      );
      setTriagePhoto(DEMO_IMAGES.socketBefore);
    } else {
      setTriageInput(
        'Block B 2nd floor corridor Wi-Fi access point shows solid amber LED and disconnects laptops every 10 minutes.'
      );
      setTriagePhoto(DEMO_IMAGES.wifiCorridor);
    }
  };

  const handleRunLandingTriage = async () => {
    setTriageError(null);
    setTriageLoading(true);
    try {
      const result = await requestAiFaultTriage({
        description: triageInput,
        photoDataUrl: triagePhoto,
      });
      setTriageResult(result);
    } catch (err) {
      setTriageError(
        err instanceof Error ? err.message : 'Unable to complete AI fault analysis.'
      );
    } finally {
      setTriageLoading(false);
    }
  };

  const openCount = state.complaints.filter((c) => c.status !== 'Closed').length;
  const closedCount = state.complaints.filter((c) => c.status === 'Closed').length;
  const availableTechs = state.technicians.filter(
    (t) => t.availability !== 'Off Shift'
  ).length;

  const activeStage = LIFECYCLE_STAGES[activeStageIdx];

  return (
    <div className="futuristic-grid min-h-screen bg-[#f4f6f9] text-slate-900 transition-colors dark:bg-[#060b14] dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800/90 dark:bg-[#060b14]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-navy-900 dark:text-sky-400 whitespace-nowrap shrink-0"
          >
            HostelCare
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#overview"
              className="hover:text-navy-900 dark:hover:text-sky-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Overview
            </a>
            <a
              href="#roles"
              className="hover:text-navy-900 dark:hover:text-sky-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              User Roles
            </a>
            <a
              href="#lifecycle"
              className="hover:text-navy-900 dark:hover:text-sky-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Lifecycle
            </a>
            <a
              href="#evidence"
              className="hover:text-navy-900 dark:hover:text-sky-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Visual Proof
            </a>
            <a
              href="#ai-triage"
              className="hover:text-navy-900 dark:hover:text-sky-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              AI Triage
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onGoToLogin()}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-sky-500 dark:text-slate-950 dark:font-semibold dark:hover:bg-sky-400 whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split with Interactive 3D Campus Twin & Architectural Photography Toggle */}
        <section id="overview" className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-[#0c1322] lg:col-span-5">
              <div className="space-y-5">
                <p className="text-xs font-medium text-slate-500 dark:text-sky-400">
                  University Hostel Facilities Platform · Spatial Command Twin
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-navy-950 dark:text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.12] [text-wrap:balance]">
                  Report. Track. Resolve. With Transparency.
                </h1>
                <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  HostelCare connects students, maintenance technicians, and hostel wardens in
                  one shared complaint lifecycle — pairing visible step-by-step progress and
                  interactive 3D wing mapping with realistic technician visit scheduling.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onGoToLogin('student')}
                    className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap shrink-0"
                  >
                    <span>Open Demo Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onGoToLogin('warden')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <span>Warden Console</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <p>
                    Demo accounts:{' '}
                    <span className="font-mono text-slate-700 dark:text-sky-300">
                      student@demo.com
                    </span>{' '}
                    ·{' '}
                    <span className="font-mono text-slate-700 dark:text-sky-300">
                      technician@demo.com
                    </span>{' '}
                    ·{' '}
                    <span className="font-mono text-slate-700 dark:text-sky-300">
                      warden@demo.com
                    </span>
                  </p>
                  <p className="mt-0.5">
                    Password:{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-200">demo123</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {heroVisualMode === '3d'
                    ? 'Interactive 3D Campus Twin — click markers, toggle Blueprint, or Explode floors'
                    : 'North Hall & South Hall Residential Complex'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0c1322] dark:text-slate-200 dark:hover:bg-slate-800"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Futuristic Dark Mode'}
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="h-3.5 w-3.5 text-amber-400" />
                        <span>Light</span>
                      </>
                    ) : (
                      <>
                        <Moon className="h-3.5 w-3.5 text-navy-900" />
                        <span>Dark</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#0c1322]">
                    <button
                      type="button"
                      onClick={() => setHeroVisualMode('3d')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                        heroVisualMode === '3d'
                          ? 'bg-navy-900 text-white dark:bg-sky-500 dark:text-slate-950'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <Box className="h-3.5 w-3.5" />
                      <span>3D Campus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroVisualMode('photo')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                        heroVisualMode === 'photo'
                          ? 'bg-navy-900 text-white dark:bg-sky-500 dark:text-slate-950'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Campus Photo</span>
                    </button>
                  </div>
                </div>
              </div>

              {heroVisualMode === '3d' ? (
                <HostelCampus3D
                  complaints={state.complaints}
                  height={440}
                  compactMode
                  onOpenComplaintDetail={() => onGoToLogin('warden')}
                />
              ) : (
                <div className="h-[440px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-[#0c1322]">
                  {heroImgFailed ? (
                    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-8 text-center dark:from-slate-900 dark:to-slate-950">
                      <Building2 className="mb-3 h-10 w-10 text-navy-900 dark:text-sky-400" />
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        North Hall & South Hall Maintenance Hub
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Centralized hostel facilities coordination
                      </p>
                    </div>
                  ) : (
                    <img
                      src={DEMO_IMAGES.heroCampus}
                      alt="University student hostel campus buildings and courtyard"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4-column summary strip immediately below hero */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tracked Complaints
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-navy-950 dark:text-white">
                {state.complaints.length}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {openCount} active · {closedCount} closed
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Maintenance Staff
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-navy-950 dark:text-white">
                {state.technicians.length}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {availableTechs} active across 2 hostel blocks
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Resolution Verification
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-navy-950 dark:text-sky-400">
                2-Step
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                After-photo proof + student confirmation
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0c1322]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Data Persistence
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-navy-950 dark:text-emerald-400">
                Full-Stack
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Server API + cross-tab LocalStorage sync
              </p>
            </div>
          </div>
        </section>

        {/* Three Role Entry Cards */}
        <section
          id="roles"
          className="border-t border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-[#090f1c]"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-navy-950 dark:text-white [text-wrap:balance]">
                Three Role-Specific Interfaces, One Shared Truth
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Every action performed by a student, technician, or warden immediately updates the
                3D Campus Twin, chronological timeline, and role notifications.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-6 transition-colors hover:border-sky-500/60 dark:border-slate-800 dark:bg-[#0c1322]">
                <div className="space-y-3">
                  <ClipboardList className="h-6 w-6 text-navy-900 dark:text-sky-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    01. Student / Hosteller Panel
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Submit complaints with room details and photos, track every milestone on a
                    transparent timeline, message technicians, and confirm or reopen resolved jobs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToLogin('student')}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 hover:underline dark:text-sky-400"
                >
                  <span>Enter as Student</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-6 transition-colors hover:border-sky-500/60 dark:border-slate-800 dark:bg-[#0c1322]">
                <div className="space-y-3">
                  <Wrench className="h-6 w-6 text-navy-900 dark:text-sky-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    02. Technician Panel
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Accept or decline jobs with reasons, set realistic arrival and completion
                    schedules, request store materials, and upload before-and-after photo proof.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToLogin('technician')}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 hover:underline dark:text-sky-400"
                >
                  <span>Enter as Technician</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-6 transition-colors hover:border-sky-500/60 dark:border-slate-800 dark:bg-[#0c1322]">
                <div className="space-y-3">
                  <ShieldCheck className="h-6 w-6 text-navy-900 dark:text-sky-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    03. Warden / Admin Panel
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Monitor hostel-wide KPIs, assign technicians by workload, escalate overdue or
                    reopened complaints, audit before/after photos, and export maintenance reports.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToLogin('warden')}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 hover:underline dark:text-sky-400"
                >
                  <span>Enter as Warden</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Complaint Lifecycle Explorer */}
        <section
          id="lifecycle"
          className="border-t border-slate-200 bg-[#f4f6f9] py-14 dark:border-slate-800 dark:bg-[#060b14]"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-navy-950 dark:text-white [text-wrap:balance]">
                  Interactive Complaint Lifecycle Explorer
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Click any stage below to inspect how Student, Technician, and Warden workspaces
                  synchronize in real time — never closing a ticket without photo proof and
                  student verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActiveStageIdx((prev) => (prev + 1) % LIFECYCLE_STAGES.length)
                }
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-sky-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0c1322] dark:text-sky-400 dark:hover:bg-slate-800"
              >
                <span>Advance Stage</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Interactive Stage Selector Tabs */}
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {LIFECYCLE_STAGES.map((stage, idx) => {
                const isSelected = idx === activeStageIdx;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setActiveStageIdx(idx)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-white shadow-sm dark:border-sky-400 dark:bg-[#0e192d]'
                        : 'border-slate-200 bg-white/80 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0c1322]/80 dark:hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`font-mono text-xs font-bold ${
                        isSelected
                          ? 'text-navy-900 dark:text-sky-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      STEP {stage.step}
                    </span>
                    <span className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {stage.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Stage Live Perspective Matrix */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0c1322]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <p className="font-mono text-xs font-semibold text-navy-900 dark:text-sky-400">
                    STAGE {activeStage.step} · STATUS: {activeStage.statusBadge.toUpperCase()}
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                    {activeStage.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToLogin(activeStage.ownerRole)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  <span>Try as {activeStage.ownerRole}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-sky-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Student Sees</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeStage.studentView}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-sky-300">
                    <CalendarClock className="h-4 w-4 text-navy-900 dark:text-sky-400" />
                    <span>Technician Controls</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeStage.technicianView}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-sky-300">
                    <Camera className="h-4 w-4 text-navy-900 dark:text-amber-400" />
                    <span>Warden Oversight</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeStage.wardenView}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Inspection & Before/After Proof Showcase */}
        <section
          id="evidence"
          className="border-t border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-[#090f1c]"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-navy-950 dark:text-white [text-wrap:balance]">
                  Verified Before & After Visual Evidence
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Students attach fault photos at intake and technicians submit physical completion
                  proof before closing any job — eliminating disputed resolutions.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 self-start dark:border-slate-700 dark:bg-[#0c1322]">
                <button
                  type="button"
                  onClick={() => setActiveProofPair('plumbing')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    activeProofPair === 'plumbing'
                      ? 'bg-navy-900 text-white dark:bg-sky-500 dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Plumbing · Room 204
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProofPair('electrical')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    activeProofPair === 'electrical'
                      ? 'bg-navy-900 text-white dark:bg-sky-500 dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Electrical · Room 302
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <BeforeAfterComparisonSlider
                  beforeSrc={
                    activeProofPair === 'plumbing'
                      ? DEMO_IMAGES.leakBefore
                      : DEMO_IMAGES.socketBefore
                  }
                  afterSrc={
                    activeProofPair === 'plumbing'
                      ? DEMO_IMAGES.leakAfter
                      : DEMO_IMAGES.socketFixed
                  }
                />
                <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeProofPair === 'plumbing'
                    ? 'HC-2026-010 · P-trap seal & ceiling joint repair verified before student closure'
                    : 'HC-2026-003 · Study desk 3-pin outlet replacement & voltage check proof'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-6">
                {[
                  {
                    src: DEMO_IMAGES.fanBefore,
                    alt: 'Ceiling fan and wall regulator fault inspection in Room 108',
                    code: 'HC-2026-002 · Electrical',
                    title: 'Ceiling Fan Regulator Fault',
                    caption: 'North Hall Block A · Room 108',
                  },
                  {
                    src: DEMO_IMAGES.wifiCorridor,
                    alt: 'Hostel corridor ceiling Wi-Fi access point showing amber fault status',
                    code: 'HC-2026-004 · Internet/Wi-Fi',
                    title: 'Corridor Access Point AP-2B',
                    caption: 'North Hall Block B · Room 215',
                  },
                  {
                    src: DEMO_IMAGES.tableBroken,
                    alt: 'Wooden hostel study desk with detached front leg and bracket',
                    code: 'HC-2026-005 · Furniture',
                    title: 'Study Desk Frame Damage',
                    caption: 'North Hall Block A · Room 109',
                  },
                  {
                    src: DEMO_IMAGES.doorLockFixed,
                    alt: 'Newly aligned stainless steel mortise door lock hardware after repair',
                    code: 'HC-2026-009 · Carpentry',
                    title: 'Mortise Door Lock Alignment',
                    caption: 'South Hall Block B · Room 220',
                  },
                ].map((item) => (
                  <figure
                    key={item.code}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0c1322]"
                  >
                    <img
                      src={item.src}
                      alt={item.alt}
                      referrerPolicy="no-referrer"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <figcaption className="space-y-0.5 border-t border-slate-200 p-3 dark:border-slate-800">
                      <p className="font-mono text-[11px] font-medium text-navy-900 dark:text-sky-400">
                        {item.code}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.caption}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Live Interactive AI Fault Triage Sandbox */}
        <section
          id="ai-triage"
          className="border-t border-slate-200 bg-[#f4f6f9] py-14 dark:border-slate-800 dark:bg-[#060b14]"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-navy-950 dark:text-white [text-wrap:balance]">
                  AI Multimodal Fault Triage & Dispatch Prep
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Test live AI diagnosis directly below: pick a hostel fault photo or type any
                  issue to classify trade priority, safety guidance, and spare parts before a
                  technician departs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 self-start dark:border-slate-700 dark:bg-[#0c1322]">
                {[
                  { id: 'leak' as const, label: 'Pipe Leak' },
                  { id: 'socket' as const, label: 'Scorched Socket' },
                  { id: 'wifi' as const, label: 'Wi-Fi AP Fault' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectTriagePreset(p.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      triagePreset === p.id
                        ? 'bg-navy-900 text-white dark:bg-sky-500 dark:text-slate-950'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0c1322] lg:col-span-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 sm:col-span-5">
                    <img
                      src={triagePhoto}
                      alt="Selected hostel fault sample for AI visual triage"
                      referrerPolicy="no-referrer"
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col justify-between gap-2 sm:col-span-7">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Student Fault Report Description
                    </label>
                    <textarea
                      rows={4}
                      value={triageInput}
                      onChange={(e) => setTriageInput(e.target.value)}
                      className="w-full flex-1 rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-navy-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Inspects both text and fault photo via Gemini
                  </span>
                  <button
                    type="button"
                    onClick={handleRunLandingTriage}
                    disabled={triageLoading || !triageInput.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 whitespace-nowrap"
                  >
                    {triageLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5" />
                    )}
                    <span>{triageLoading ? 'Diagnosing Fault...' : 'Run AI Triage'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0c1322] lg:col-span-6">
                {triageError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
                  >
                    {triageError}
                  </div>
                ) : triageResult ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                      <div>
                        <p className="font-mono text-[11px] font-medium text-navy-900 dark:text-sky-400">
                          {triageResult.category} · {triageResult.priority} Priority
                        </p>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {triageResult.suggestedTitle}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onGoToLogin('student')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 hover:underline dark:text-sky-400"
                      >
                        <span>Submit in Portal</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>
                        <strong>Student Safety Guidance:</strong> {triageResult.safetyNotice}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <p>
                        <strong>Recommended Technician Kit:</strong>{' '}
                        {triageResult.likelyPartsNeeded.join(', ')}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {triageResult.reasoning}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-center space-y-2 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Ready to Diagnose Fault Photo & Description
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Click <strong>Run AI Triage</strong> to see how HostelCare automatically
                      assigns trade categories, flags electrical or water safety steps for the
                      student, and lists spare parts so technicians arrive prepared on the first
                      visit.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* MVP Validation Section */}
        <section
          id="mvp-validation"
          className="border-t border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-[#090f1c]"
        >
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-navy-950 dark:text-white">
                MVP Hypothesis & Usability Testing Capture
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Built to test whether hostellers trust and understand complaint progress while
                technicians retain practical scheduling control. Evaluators can log live usability
                observations in the built-in MVP Feedback Capture tool.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMvpFeedback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0c1322] dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <span>Open MVP Feedback Form</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#f4f6f9] py-6 dark:border-slate-800 dark:bg-[#060b14]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center">
          <span>HostelCare — Smart Hostel Maintenance & Complaint Tracking</span>
          <span>Demonstration dataset persisted via Express API & LocalStorage</span>
        </div>
      </footer>
    </div>
  );
}
