import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/* ============================================================================
   VIDYA — AI Mentorship assistant persona & voice configuration.
   Presentation/personality only: no new endpoints, no backend changes.
   `voice` is the contract a TTS engine (or the chat backend once it gains an
   LLM) should honour, so the spoken output matches the persona below.
   ========================================================================== */
const VIDYA = {
  name: 'VIDYA',
  role: 'Study companion & wellbeing mentor',
  tagline: 'Always here to listen',
  persona: 'A warm, calm and emotionally intelligent study companion for Indian college students. Speaks softly, like an older sister who genuinely cares. Never robotic, never clinical, never masculine or preachy.',
  traits: ['warm', 'calm', 'emotionally intelligent', 'encouraging', 'never judgemental', 'concise and real', 'gentle humour'],
  // Style rules for any future LLM pass — kept explicit so the tone cannot drift.
  style: {
    register: 'soft spoken Indian English, everyday campus tone',
    sentenceLength: 'short and warm, 1–2 sentences, never long paragraphs',
    opener: 'acknowledge the feeling first, in one short line',
    never: ['robotic phrasing', 'clinical or diagnostic language', 'lecturing', 'slang the student never used', 'male-coded framing', 'excessive exclamation marks', 'cheerleading over study'],
    reassurance: 'reassure before advising, and always leave one small doable next step',
  },
  voice: {
    lang: 'en-IN',
    // Ordered preference list; the first installed matching voice wins.
    preferredVoices: ['Swara', 'Aditi', 'Raveena', 'Neerja', 'Nisha', 'Asha', 'Samantha', 'Google UK English Female', 'Microsoft Swara Online (Natural) - English (India)'],
    gender: 'female',
    ageRange: [18, 22],
    rate: 0.92,      // slow, unhurried
    pitch: 1.18,     // soft, youthful
    volume: 0.95,
    style: 'conversational, warm, gentle',
  },
  // Sent with every chat turn. The current backend ignores it (it only reads
  // `message` and `studentId`), so replies are unchanged today — but the
  // persona already reaches the server for a future TTS/LLM integration.
  apiPayload: () => ({
    assistant: 'VIDYA',
    persona: 'warm-female-student-companion',
    voice: { lang: 'en-IN', gender: 'female', rate: 0.92, pitch: 1.18, style: 'conversational, warm, gentle' },
  }),
};

/* Panel-state key for the chat tab. Kept as one constant so the visible label
   and every aarTool comparison can never drift apart. */
const AAR_CHAT_TAB = `Chat with ${VIDYA.name}`;

/* Resource Vault presentation helpers. The Department → Semester → Subject →
   Module → Resource Type cascade and its accents; the resource records
   themselves are never altered by any of this. */
const VAULT_ORDER = ['department', 'semester', 'subject', 'module', 'type'];
const VAULT_TYPE_TONES = {
  Notes: { icon: 'N', tone: 'amber' },
  PYQ: { icon: 'Q', tone: 'green' },
  PPT: { icon: 'P', tone: 'blue' },
  Lecture: { icon: '▶', tone: 'violet' },
};
const vaultTypeLook = (type) => VAULT_TYPE_TONES[type] || { icon: '📄', tone: 'slate' };

/* Student Community presentation helpers. Read-only grouping/metadata for the
   community page — the posts, likes, comments and announcements themselves all
   still come from the existing backend routes. */
const COMMUNITY_USER_ID = 'CSE26-001';
const COMMUNITY_MEMBERS = 60;
const COMMUNITY_GROUPS = [
  { key: 'maths', icon: '∑', name: 'Maths Revision', focus: 'Integration', members: 18, words: ['math', 'mat-i', 'integrat', 'calculus', 'derivat', 'matrix', 'engineering mathematics', 'limit'] },
  { key: 'pps', icon: '</>', name: 'PPS Practice', focus: 'C basics', members: 14, words: ['pps', 'programming', ' c ', 'pointer', 'array', 'loop', 'basics', 'code'] },
  { key: 'physics', icon: '⚛', name: 'Physics Lab Help', focus: 'Lab records', members: 11, words: ['physics', 'phy-i', 'lab', 'optic', 'current', 'electric', 'wave'] },
];
/* Composer starters. Selecting one only prefills the textarea — nothing is
   written to the backend until the student publishes. */
const COMMUNITY_STARTERS = [
  { key: 'discussion', icon: '💬', label: 'Discussion', prompt: '' },
  { key: 'resource', icon: '📚', label: 'Resource', prompt: 'Sharing a resource that helped me — ' },
  { key: 'doubt', icon: '❓', label: 'Doubt', prompt: 'I have a doubt about ' },
  { key: 'group', icon: '👥', label: 'Study group', prompt: 'Looking for study partners for ' },
];
const relativeTime = (iso) => {
  const then = new Date(iso || '').getTime();
  if (!iso || Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ---------- Shared feature page shell --------------------------------------
   Every feature page leads with this hero so the headline, the live numbers and
   the primary action always sit in the same place, followed by the feature's own
   cards. Presentation only: no data, routing or behaviour lives here. */
function FeatureHero({ eyebrow, title, description, icon, stats, accent, children }) {
  return <header className={`feature-hero${accent ? ` accent-${accent}` : ''}`}>
    <span className="feature-hero-glow" aria-hidden="true"></span>
    <span className="feature-hero-mark" aria-hidden="true">{icon}</span>
    <div className="feature-hero-text">
      <div className="feature-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {Array.isArray(stats) && stats.length > 0
      ? <div className="feature-hero-stats">{stats.map(s => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
      : null}
    {children}
  </header>;
}

/* Card wrapper matching the hero's visual language, for new feature sections. */
function FeatureCard({ title, subtitle, icon, actions, className = '', children }) {
  return <section className={`feature-card ${className}`.trim()}>
    {(title || actions) && <div className="feature-card-head">
      <div className="feature-card-title">
        {icon ? <span className="feature-card-mark" aria-hidden="true">{icon}</span> : null}
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
      </div>
      {actions}
    </div>}
    {children}
  </section>;
}

/* Section heading used inside a feature page to separate stacked card groups. */
function FeatureSectionTitle({ eyebrow, title, subtitle, actions }) {
  return <div className="feature-section-title">
    <div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
    {actions}
  </div>;
}


/* Chooses the device voice for VIDYA in strict tiers, so Indian English always
   wins among the female voices and a masculine voice is never selected while
   any female voice exists: Indian female > female > Indian male > anything.
   Pure function — no DOM — so the same selection can be reused by a server-side
   or Web-Audio TTS layer later. */
const pickPersonaVoice = (voices) => {
  const FEMALE = /(female|woman|girl|swara|aditi|raveena|neerja|nisha|asha|heera|lekha|zira|aria|jenny|victoria|sonia|moira|tessa|samantha|nova|serena)/i;
  const MALE = /(male|man\b|ravi|david|mark|george|daniel|alex|fred|thomas|hemant|madhur|guy)/i;
  const isIndian = (v) => {
    const l = (v.lang || '').replace('_', '-').toLowerCase();
    return l === 'en-in' || /india|indian/i.test(`${v.name || ''} ${v.voiceURI || ''}`);
  };
  const isFemale = (v) => FEMALE.test(v.name || '') && !MALE.test(v.name || '');
  const isPreferred = (v) => VIDYA.voice.preferredVoices.some(p => (v.name || '').toLowerCase().includes(p.toLowerCase()));
  const tier = (v) => {
    const female = isFemale(v), indian = isIndian(v), preferred = isPreferred(v);
    if (female && indian) return preferred ? 0 : 1;  // best: Indian English, female
    if (female) return preferred ? 2 : 3;            // female elsewhere
    if (indian) return 4;                            // only when no female voice exists at all
    return 5;
  };
  if (!Array.isArray(voices) || !voices.length) return null;
  return voices.slice().sort((a, b) => (tier(a) - tier(b)) || (a.localService === b.localService ? 0 : (a.localService ? -1 : 1)))[0] || null;
};

/* Speech length a single utterance can be trusted with. Browsers silently cut
   off anything much longer, so replies are split on sentence boundaries (and
   hard-wrapped only as a last resort) and queued one after another. Replies are
   lightly normalised first, so list markers, bullets and arrows are spoken as
   natural language instead of being read out character by character. */
const SPEECH_CHUNK_LIMIT = 200;
const normalizeForSpeech = (text) => String(text ?? '')
  .replace(/[*_`#>|]+/g, ' ')
  .replace(/(^|\s)\d{1,2}[.)]\s/g, '$1')
  .replace(/[()[\]{}]/g, ' ')
  .replace(/[•·▪◦]/g, ', ')
  .replace(/[→⇒]/g, ' to ')
  .replace(/\s+[—–]\s+/g, '. ')     // a dash between ideas is a sentence break when spoken
  .replace(/\s+/g, ' ')
  .trim();
const splitForSpeech = (text) => {
  const clean = normalizeForSpeech(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?।]+[.!?।]*\s*/g) || [clean];
  const chunks = [];
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (piece.length <= SPEECH_CHUNK_LIMIT) { chunks.push(piece); continue; }
    for (let i = 0; i < piece.length; i += SPEECH_CHUNK_LIMIT) {
      const wrapped = piece.slice(i, i + SPEECH_CHUNK_LIMIT).trim();
      if (wrapped) chunks.push(wrapped);
    }
  }
  return chunks;
};

const subjects = [
  { name: "Engineering Mathematics-I", code: "MAT-I", icon: "∑", color: "blue", progress: 62, status: "On track" },
  { name: "Engineering Physics", code: "PHY-I", icon: "⚛", color: "yellow", progress: 72, status: "Improving" },
  { name: "Introduction to AI", code: "AI-I", icon: "✦", color: "violet", progress: 68, status: "Good" },
  { name: "Programming for Problem Solving (PPS)", code: "PPS-I", icon: "</>", color: "green", progress: 74, status: "Good" },
  { name: "Basic Electrical & Electronics Engineering", code: "BEEE-I", icon: "ϟ", color: "teal", progress: 65, status: "Improving" },
  { name: "Universal Human Values", code: "UHV-I", icon: "♡", color: "pink", progress: 80, status: "Strong" },
];

const facultyDirectory = [
  { id: "FAC-CSE-DK", name: "Dhirendra Kumar", department: "Computer Science & Engineering", designation: "Assistant Professor", subjects: ["Introduction to AI", "Programming for Problem Solving (PPS)"], short: "DK" },
  { id: "FAC-AH-AKJ", name: "Anand Kumar Jha", department: "Applied Science & Humanities", designation: "Assistant Professor", subjects: ["Engineering Mathematics-I"], short: "AKJ" },
  { id: "FAC-AH-AK", name: "Anand Kamal", department: "Computer Science & Engineering", designation: "Assistant Professor", subjects: [], short: "AK" },
  { id: "FAC-AH-AVJ", name: "Avinash Kumar Jha", department: "Applied Science & Humanities", designation: "Assistant Professor", subjects: ["Engineering Physics"], short: "AKJ" },
  { id: "FAC-EE-PK", name: "Poonam Kumari", department: "Electrical Engineering", designation: "Assistant Professor", subjects: ["Basic Electrical & Electronics Engineering (BEEE)"], short: "PK" },
  { id: "FAC-AH-RKJ", name: "Rajeev Kumar Jha", department: "Applied Science & Humanities", designation: "Faculty", subjects: ["Universal Human Values"], short: "RKJ" },
  { id: "FAC-AH-CKJ", name: "Chandan Kumar Jha", department: "Applied Science & Humanities", designation: "Assistant Professor • Chemistry", subjects: [], short: "CKJ" },
  { id: "FAC-CE-SK", name: "Sumit Kumar", department: "Civil Engineering", designation: "Assistant Professor", subjects: [], short: "SK" },
];

/* ===== Academic Twin dashboard derivations =====
   Every panel below the Twin hero is computed from the analysis payload that
   /api/student-dashboard/academic-twin already returns (profile, attendance,
   assignmentCompletion, practiceAccuracy, consistency) plus the assignments,
   resources and focus-session log the rest of CampusLMS already stores. No new
   endpoints and no mock numbers: if a value is missing the panel says so. */

const TWIN_ID = "CSE26-001";
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const TWIN_SUBJECT_KEYS = [
  { key: "maths", label: "Mathematics", match: ["math"] },
  { key: "physics", label: "Physics", match: ["physic"] },
  { key: "ai", label: "AI", match: [" ai", "artificial"] },
  { key: "pps", label: "PPS", match: ["programming", "pps", "problem solving"] },
  { key: "beee", label: "BEEE", match: ["electrical", "beee", "electronic"] },
  { key: "uhv", label: "UHV", match: ["human values", "uhv"] },
];

/* Subject names differ slightly between the profile, assignments and faculty
   map ("BEEE" vs the full title), so matching is done on keywords. */
const twinTopicOf = (name = "") => {
  const hay = ` ${String(name).toLowerCase()} `;
  return (TWIN_SUBJECT_KEYS.find(k => k.match.some(m => hay.includes(m))) || {}).key || "other";
};
const twinHealthBand = (score) => (score >= 80 ? "Strong" : score >= 65 ? "Steady" : score >= 50 ? "Watch" : "At risk");
const twinDaysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);

/* Per-subject health blends syllabus progress with the live workload sitting on
   that subject (unsent assignments, locked deadlines) and the study material
   available for it, so the score reacts to work that is actually outstanding. */
const twinSubjectHealth = (profile = [], ctx = {}) => {
  const { allAssignments = [], resources: available = [], avg = 0 } = ctx;
  return profile.map(s => {
    const topic = twinTopicOf(s.name);
    const mine = allAssignments.filter(x => twinTopicOf(x.subject) === topic);
    const outstanding = mine.filter(x => !(Array.isArray(x.submittedBy) && x.submittedBy.includes(TWIN_ID)));
    const locked = outstanding.filter(x => x.locked).length;
    const materials = available.filter(r => twinTopicOf(r.subject || r.title) === topic).length;
    const loadPenalty = Math.min(24, outstanding.length * 8);
    const supportBonus = Math.min(8, materials * 3);
    const score = clampPct(Number(s.progress || 0) - loadPenalty + supportBonus);
    return {
      ...s, topic, score, band: twinHealthBand(score), materials,
      outstanding, locked, loadPenalty, supportBonus,
      delta: Math.round(score - Number(avg || 0)),
      next: mine.slice().sort((x, y) => String(x.deadline).localeCompare(String(y.deadline)))[0] || null,
    };
  });
};

/* Weekly trend reads the focus-session log 30-Min Rescue already persists
   ({day, minutes, sessions}) so the bars are recorded study time. */
const twinWeeklyTrend = (focusLog = [], days = 7) => {
  const byDay = new Map(focusLog.map(x => [x.day, x]));
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const today = new Date();
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    const key = iso(date);
    const row = byDay.get(key) || {};
    return { key, label: date.toLocaleDateString("en-IN", { weekday: "short" }), day: date.getDate(), minutes: Number(row.minutes || 0), sessions: Number(row.sessions || 0) };
  });
  const total = series.reduce((n, x) => n + x.minutes, 0);
  const sessions = series.reduce((n, x) => n + x.sessions, 0);
  const best = series.reduce((m, x) => (x.minutes > m.minutes ? x : m), series[0] || { minutes: 0, label: "—" });
  /* The series only covers the visible window, so the comparison period is
     summed straight from the log rather than from the truncated series. */
  const todayKey = iso(today);
  const prevMinutes = focusLog.reduce((n, x) => {
    const back = twinDaysBetween(x.day, todayKey);
    return back >= days && back < days * 2 ? n + Number(x.minutes || 0) : n;
  }, 0);
  const activeDays = series.filter(x => x.minutes > 0).length;
  return {
    series, total, sessions, best, activeDays, days,
    dailyAvg: series.length ? Math.round(total / series.length) : 0,
    prevMinutes,
    /* null rather than a fake jump when there is no earlier period logged. */
    change: prevMinutes ? Math.round(((total - prevMinutes) / prevMinutes) * 100) : null,
  };
};

/* Rule-based alerts over the same numbers the server uses for `risk`, plus the
   deadline pressure the Twin payload does not carry. */
const twinRiskAlerts = (a = {}, ctx = {}) => {
  const { allAssignments = [], trend = null } = ctx;
  const attendance = a.attendance?.percentage ?? a.attendancePct;
  const pending = allAssignments.filter(x => !(Array.isArray(x.submittedBy) && x.submittedBy.includes(TWIN_ID)));
  const overdue = pending.filter(x => x.locked);
  const alerts = [];
  if (attendance != null && Number(attendance) < 75)
    alerts.push({ id: "attendance", level: "high", title: "Attendance below the safe line", detail: `${attendance}% present — most colleges need 75% to sit the exam.`, action: "Academic Records" });
  if (a.assignmentCompletion != null && Number(a.assignmentCompletion) < 50)
    alerts.push({ id: "assignments", level: "high", title: `${pending.length} assignment${pending.length === 1 ? "" : "s"} still unsubmitted`, detail: `Assignment completion is ${a.assignmentCompletion}%. This is the single biggest drag on your profile.`, action: "Assignments" });
  if (overdue.length)
    alerts.push({ id: "locked", level: "high", title: `${overdue.length} deadline${overdue.length === 1 ? "" : "s"} already locked`, detail: `${overdue[0].title} can no longer be submitted. Ask faculty for a re-open.`, action: "Assignments" });
  if (a.weakest && Number(a.weakest.progress) < 65)
    alerts.push({ id: "weakest", level: "medium", title: `${a.weakest.name} is dragging the average`, detail: `${a.weakest.progress}% progress. Two focused blocks here lift the whole Twin average.`, action: "30-Min Rescue" });
  if (a.consistency != null && Number(a.consistency) < 60)
    alerts.push({ id: "consistency", level: "medium", title: "Study plan is only half done", detail: `${a.consistency}% of your planned study blocks completed. Consistency matters more than intensity.`, action: "Learning Path" });
  if (a.practiceAccuracy != null && Number(a.practiceAccuracy) < 60)
    alerts.push({ id: "practice", level: "medium", title: "Practice accuracy is untested", detail: a.practiceAccuracy ? `${a.practiceAccuracy}% accuracy across your attempts.` : "No question attempts recorded yet, so accuracy cannot be trusted.", action: "Question Practice" });
  if (trend && trend.total === 0)
    alerts.push({ id: "trend", level: "low", title: "No study time logged this week", detail: "Your 30-Min Rescue log is empty for the last 7 days, so this trend cannot improve on its own.", action: "30-Min Rescue" });
  if (a.risk === "Needs attention" && !alerts.some(x => x.level === "high"))
    alerts.push({ id: "risk", level: "medium", title: "Twin flags this profile as needing attention", detail: a.recommendation || "Refresh the analysis to see the updated recommendation.", action: "Exam Readiness" });
  if (!alerts.length)
    alerts.push({ id: "clear", level: "clear", title: "No active risk signals", detail: "Attendance, assignments, consistency and practice are all inside their healthy bands.", action: "Exam Readiness" });
  const rank = { high: 0, medium: 1, low: 2, clear: 3 };
  return alerts.sort((x, y) => rank[x.level] - rank[y.level]);
};

/* Same weighting the server uses for its readiness score, applied to the
   simulated inputs so the projection is comparable with the real number. */
const twinReadiness = ({ avg, practice, assignments: asg, attendance, pending }) =>
  clampPct(avg * 0.6 + practice * 0.15 + asg * 0.15 + attendance * 0.1 - Math.min(12, pending * 2));

const twinSimulate = (base, sim) => {
  const hours = Number(sim.hours) || 0, questions = Number(sim.questions) || 0;
  const submit = Number(sim.assignments) || 0, classes = Number(sim.classes) || 0;
  const avgNow = clampPct(base.avg);
  const practiceNow = clampPct(base.practiceAccuracy);
  const asgNow = clampPct(base.assignmentCompletion);
  const attNow = clampPct(base.attendance);
  const total = Math.max(1, base.totalAssignments || 0);
  const submitted = Math.round(asgNow / 100 * total) + submit;
  const avgNext = clampPct(avgNow + Math.min(15, hours * 1.4));
  /* With no attempts on record there is no accuracy to build on, so practice
     only moves once questions are actually planned — an idle plan must not
     invent an accuracy score. */
  const practiceNext = clampPct(practiceNow ? practiceNow + Math.min(25, questions * 0.7) : Math.min(50, questions * 0.9));
  const asgNext = clampPct(submitted / total * 100);
  const attNext = clampPct(attNow + Math.min(8, classes * 1.6));
  const pending = Math.max(0, total - submitted);
  const readinessNow = twinReadiness({ avg: avgNow, practice: practiceNow, assignments: asgNow, attendance: attNow, pending: base.pendingAssignments || 0 });
  const readinessNext = twinReadiness({ avg: avgNext, practice: practiceNext, assignments: asgNext, attendance: attNext, pending });
  return {
    rows: [
      { key: "avg", label: "Average subject progress", now: avgNow, next: avgNext, unit: "%" },
      { key: "practice", label: "Practice accuracy", now: practiceNow, next: practiceNext, unit: "%" },
      { key: "assignments", label: "Assignment completion", now: asgNow, next: asgNext, unit: "%" },
      { key: "attendance", label: "Attendance", now: attNow, next: attNext, unit: "%" },
    ],
    weeklyMinutes: hours * 60,
    readinessNow, readinessNext,
    readinessDelta: readinessNext - readinessNow,
    remaining: pending,
  };
};

/* Goals seeded from the live analysis. Metric goals recompute their progress
   from current data every render, so they can never drift out of date. */
const twinSeedGoals = (a = {}) => [
  { id: "g-subject", metric: "subject", label: `Reach 80% in ${a.weakest?.name || "your weakest subject"}`, target: 80, done: false },
  { id: "g-attendance", metric: "attendance", label: "Hold attendance at 85%+", target: 85, done: false },
  { id: "g-assignments", metric: "assignments", label: "Clear all pending assignments", target: 100, done: false },
  { id: "g-practice", metric: "practice", label: "Reach 70% practice accuracy", target: 70, done: false },
];
const twinGoalProgress = (goal, live) => {
  if (goal.metric === "subject") return clampPct(live.weakestProgress);
  if (goal.metric === "attendance") return clampPct(live.attendance);
  if (goal.metric === "assignments") return clampPct(live.assignmentCompletion);
  if (goal.metric === "practice") return clampPct(live.practiceAccuracy);
  /* Manual goals carry no measurable metric, so they never auto-complete. */
  return 0;
};
const twinDaysLeft = (deadline) => {
  if (!deadline) return null;
  const days = twinDaysBetween(new Date().toISOString().slice(0, 10), String(deadline).slice(0, 10));
  return days < 0 ? 0 : days;
};


const beu2026Curriculum = [
  ["Engineering Mathematics-I", "3 credits"],
  ["Engineering Physics", "3 credits"],
  ["Introduction to AI", "3 credits"],
  ["Computer Fundamentals & Emerging Technology", "3 credits"],
  ["Universal Human Values", "2 credits"],
  ["Essence of Indian Constitution", "2 credits"],
  ["Basic Electrical & Electronics Engineering (BEEE)", "3 credits"],
];

const assignments = [
  { title: "EM Assignment 2", subject: "Engineering Mathematics", deadline: "Sep 22", status: "Pending" },
  { title: "Physics Lab Record", subject: "Engineering Physics", deadline: "Sep 24", status: "Pending" },
  { title: "Programming Quiz", subject: "Programming", deadline: "Sep 26", status: "Upcoming" },
  { title: "Chemistry Assignment", subject: "Chemistry", deadline: "Sep 28", status: "Upcoming" },
  { title: "Engineering Graphics Submission", subject: "Engineering Graphics", deadline: "Oct 02", status: "Upcoming" },
];

const resources = [
  { title: "Module 1 Lecture Notes", type: "Notes", subject: "Programming", size: "2.4 MB" },
  { title: "Module 2 Important Questions", type: "PYQ", subject: "Engineering Mathematics", size: "1.1 MB" },
  { title: "Unit 3 Revision PPT", type: "PPT", subject: "Engineering Physics", size: "3.8 MB" },
  { title: "Module 1 Recorded Lecture", type: "Lecture", subject: "Basic Electrical", size: "Video" },
];

const FACULTY_V16 = {
  semesters: ['Semester I', 'Semester II', 'Semester III', 'Semester IV'],
  conceptCatalog: {
    'Introduction to AI': ['Search & State Space', 'Heuristics & Informed Search', 'Knowledge Representation', 'Planning & Reasoning'],
    'Programming for Problem Solving (PPS)': ['Pointers & Arrays', 'Functions & Recursion', 'Structures & File I/O', 'Dynamic Memory'],
    'Engineering Mathematics-I': ['Matrices & Determinants', 'Complex Numbers', 'Linear Programming', 'Probability Distributions'],
  },
  fallbackConcepts: ['Core Theory', 'Numerical Practice', 'Problem Solving', 'Applied Revision'],
  parentChannels: ['SMS', 'Email', 'Portal Update'],
  riskBands: [
    { key: 'high', label: 'High Risk', color: '#e5484d' },
    { key: 'at', label: 'At Risk', color: '#f76b15' },
    { key: 'support', label: 'Needs Support', color: '#f5c518' },
    { key: 'track', label: 'On Track', color: '#30a46c' },
  ],
};

const CR_V16 = {
  storeKey: 'CR Class Events',
  issueCategories: ['Academic', 'Infrastructure', 'Hostel', 'Examination', 'Fees', 'Other'],
  eventTypes: ['Class Event', 'Deadline', 'Workshop', 'Meeting', 'Trip', 'Exam'],
  issueStatuses: ['Open', 'In Progress', 'Resolved'],
  // Deterministic pseudonym so the CR can thread a reply without seeing who raised it.
  mask: (id) => `Anonymous · ${String(id).slice(-4).toUpperCase().padStart(4, '0')}`,
};

const API = "";

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

const roleOptions = [
  { id: "Student", icon: "🎓", tone: "student", detail: "Notes, PYQs, assignments and AI study tools" },
  { id: "Faculty", icon: "👨‍🏫", tone: "faculty", detail: "Classes, resources and student insights" },
  { id: "CR", icon: "👤", tone: "cr", detail: "Announcements and class coordination" },
];

const quickTools = [
  ["⏱", "I Have 30 Minutes", "Get a focused study plan", "30-Min Rescue", "purple"],
  ["▣", "Exam Tomorrow", "Last-minute revision", "Exam Night Mode", "red"],
  ["✦", "AI Summary", "Summarize any topic", "AI Summary", "violet"],
  ["🎙", "Practice Viva", "Improve with AI", "AI Viva Simulator", "blue"],
  ["↻", "Teach Me Again", "Better explanations", "AI Assistant", "orange"],
  ["▥", "Check My Readiness", "See exam readiness", "Exam Readiness", "teal"],
];

const revisionSubjects = [
  { name: "Engineering Mathematics-I", focus: "Integration & differential equations", code: "MAT-I" },
  { name: "Programming for Problem Solving (PPS)", focus: "Arrays, functions & file handling", code: "PPS-I" },
  { name: "Engineering Physics", focus: "Unit 3 — waves and oscillations", code: "PHY-I" },
  { name: "Basic Electrical & Electronics Engineering", focus: "Network theorems and AC circuits", code: "BEEE-I" },
  { name: "Introduction to AI", focus: "Search strategies and evaluation", code: "AI-I" },
  { name: "Universal Human Values", focus: "Ethics, empathy and teamwork", code: "UHV-I" },
];

const internshipOpportunities = [
  { id: "INT-01", company: "Tata Consultancy Services", role: "Software Engineering Intern", mode: "On-site", duration: "6 months", stipend: "₹25,000 / month", skills: "DSA, C, DBMS", closes: "21 Oct 2026" },
  { id: "INT-02", company: "Infosys Springboard", role: "Systems Intern", mode: "Remote", duration: "12 weeks", stipend: "₹15,000 / month", skills: "Python, Linux, Git", closes: "05 Nov 2026" },
  { id: "INT-03", company: "Tech Mahindra NextGen", role: "Embedded Software Trainee", mode: "Hybrid", duration: "6 months", stipend: "₹18,000 / month", skills: "C++, Embedded C, RTOS", closes: "30 Nov 2026" },
  { id: "INT-04", company: "Deloitte Technology", role: "Data Analyst Intern", mode: "On-site", duration: "8 weeks", stipend: "₹20,000 / month", skills: "SQL, Power BI, Statistics", closes: "18 Dec 2026" },
];

const aptitudeQuestions = [
  { id: "APT-01", section: "Quantitative", question: "A student scores 62, 74 and 80 in three tests. What is the average score?", options: ["70", "72", "74", "76"], answer: "72" },
  { id: "APT-02", section: "Logical Reasoning", question: "If all Engineers are Graduates and some Graduates are Coders, which conclusion is valid?", options: ["Some Engineers are Coders", "No Engineer is a Coder", "All Coders are Engineers", "Nothing can be concluded"], answer: "Nothing can be concluded" },
  { id: "APT-03", section: "Verbal Ability", question: "Choose the word closest in meaning to 'Meticulous'.", options: ["Careless", "Painstaking", "Rapid", "Generic"], answer: "Painstaking" },
  { id: "APT-04", section: "Quantitative", question: "A train covers 240 km in 3 hours. What is its speed?", options: ["60 km/h", "70 km/h", "80 km/h", "90 km/h"], answer: "80 km/h" },
  { id: "APT-05", section: "Logical Reasoning", question: "Odd one out: 4, 9, 16, 27, 36", options: ["4", "9", "16", "27"], answer: "27" },
];

const careerStages = [
  { id: "CS-1", stage: "Semester I–II", title: "Build the base", detail: "Strengthen C, Python and Engineering Mathematics. Maintain 75% attendance in every subject.", status: "in-progress" },
  { id: "CS-2", stage: "Semester III", title: "Add a specialisation", detail: "Pick one track — full stack, data, embedded or core engineering — and complete two real projects.", status: "next" },
  { id: "CS-3", stage: "Semester IV–V", title: "Internships & aptitude", detail: "Apply to internships, clear aptitude rounds and build one internship-grade resume.", status: "locked" },
  { id: "CS-4", stage: "Semester VI", title: "Campus placement", detail: "Technical and HR interview prep, portfolio review and referral applications.", status: "locked" },
];

function App() {
  const [role, setRole] = useState("Student");
  const [facultyId, setFacultyId] = useState("FAC-CSE-DK");
  const [syllabusData, setSyllabusData] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [certificatesLoaded, setCertificatesLoaded] = useState(false);
  /* Per-feature view state for the shared feature pages (search + filters). */
  const [certQuery, setCertQuery] = useState("");
  const [certFilter, setCertFilter] = useState("all");
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [assignmentQuery, setAssignmentQuery] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [subjectQuery, setSubjectQuery] = useState("");
  const [subjectSort, setSubjectSort] = useState("progress");
  const [syllabusQuery, setSyllabusQuery] = useState("");

  const [syllabusOpenCourse, setSyllabusOpenCourse] = useState(null);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceSubject, setPracticeSubject] = useState('Introduction to AI');
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelected, setPracticeSelected] = useState(null);
  const [practiceFeedback, setPracticeFeedback] = useState(null);
  const [practiceStats, setPracticeStats] = useState({total:0,correct:0,accuracy:0});
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [selectedSubject, setSelectedSubject] = useState(null);
  /* Resource Vault filter console state. Local view state only — the vault still
     renders the untouched resource records from /api/resource-vault. */
  const [vaultFilter, setVaultFilter] = useState({ department: '', semester: '', subject: '', module: '', type: '' });
  const [vaultSort, setVaultSort] = useState('hierarchy');
  const [submitted, setSubmitted] = useState(false);
  const [notifications, setNotifications] = useState(5);
  const [search, setSearch] = useState("");
  const [examMode, setExamMode] = useState(false);
  const [dark, setDark] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [serverData, setServerData] = useState(null);
  const [facultySemester, setFacultySemester] = useState('Semester I');
  const [facultyV16, setFacultyV16] = useState({ rescues: [], parentLog: [], plans: [], drafts: {} });
  const [v16Busy, setV16Busy] = useState('');
  const [v16Out, setV16Out] = useState('');
  const [crEvents, setCrEvents] = useState([]);
  const [crLive, setCrLive] = useState({ schedules: [], subjects: [] });
  const [crBusy, setCrBusy] = useState('');
  const [crOut, setCrOut] = useState('');
  const [smartToolsData, setSmartToolsData] = useState(null);
  const [toast, setToast] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([{ role: "assistant", text: "Hi! I am CampusAI. Ask me about your assignments, subjects, resources, study plan, or exams." }]);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [readerOpen, setReaderOpen] = useState(false);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityText, setCommunityText] = useState("");
  /* Student Community interaction state. All local view state — the feed still
     comes from /api/community/posts. */
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityFilter, setCommunityFilter] = useState("all");
  const [communitySort, setCommunitySort] = useState("newest");
  const [communityGroup, setCommunityGroup] = useState("");
  const [communityJoined, setCommunityJoined] = useState([]);
  const [communityOpen, setCommunityOpen] = useState({});
  const [communityDrafts, setCommunityDrafts] = useState({});
  const [communityBusy, setCommunityBusy] = useState({});
  const [communityPosting, setCommunityPosting] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [studentToolState, setStudentToolState] = useState({});
  const [pomo, setPomo] = useState({ remaining: 25 * 60, running: false, phase: "focus", focusLength: 25, breakLength: 5, completed: null });
  const [aptIndex, setAptIndex] = useState(0);
  const [aptPicked, setAptPicked] = useState(null);
  const [aptResult, setAptResult] = useState(null);
  const [resumeDraft, setResumeDraft] = useState(null);
  const [vivaAnswer, setVivaAnswer] = useState('');
  const [vivaIndex, setVivaIndex] = useState(0);
  const [vivaFeedback, setVivaFeedback] = useState('');
  const [toolBusy, setToolBusy] = useState(false);
  const [dashboardFeatureBusy, setDashboardFeatureBusy] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [aiLauncherOpen, setAiLauncherOpen] = useState(false);

  /* Academic Twin dashboard view state. Presentation and simulation only — the
     Twin analysis still comes from /api/student-dashboard/academic-twin and the
     goals still persist through the existing student-tools endpoint. */
  const [twinSubject, setTwinSubject] = useState(null);
  const [twinRange, setTwinRange] = useState(7);
  const [twinFocusLog, setTwinFocusLog] = useState([]);
  const [twinSim, setTwinSim] = useState({ hours: 2, questions: 10, assignments: 1, classes: 2 });
  const [twinGoalDraft, setTwinGoalDraft] = useState({ label: "", target: 80 });

  /* VIDYA assistant drawer. Reuses aiInput/aiMessages and the existing
     /api/ai/chat round-trip, so the drawer never changes backend or routing. */
  const [vidyaListening, setVidyaListening] = useState(false);
  const [vidyaThinking, setVidyaThinking] = useState(false);
  const vidyaScrollRef = useRef(null);
  /* Increments whenever speech playback is (re)started or stopped, so a stale
     queue can never keep talking over a newer request. */
  const speakRun = useRef(0);
  /* Voices Chrome loads lazily. Primed on mount and on `voiceschanged` so a
     persona voice is already resolved by the time the first query is answered. */
  const speakVoices = useRef([]);

  /* Keep the newest message in view as the conversation grows. Declared after
     the state above so its dependency array never reads a binding early. */
  useEffect(() => {
    if (!aiLauncherOpen) return;
    const el = vidyaScrollRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [aiMessages, vidyaThinking, aiLauncherOpen]);

  /* Escape dismisses the floating VIDYA card and stops any playback. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || !aiLauncherOpen) return;
      setAiLauncherOpen(false);
      speakRun.current += 1;
      try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiLauncherOpen]);

  /* Prime the device voice list. Chrome populates it asynchronously and can do
     so without ever firing `voiceschanged`, so the list is also polled briefly. */
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => { try { const v = synth.getVoices(); if (v.length) speakVoices.current = v; } catch { /* unsupported */ } };
    load();
    synth.addEventListener?.("voiceschanged", load);
    const timers = [200, 600, 1200, 2000].map(ms => setTimeout(load, ms));
    return () => { synth.removeEventListener?.("voiceschanged", load); timers.forEach(clearTimeout); };
  }, []);

  const [vivaQuestions, setVivaQuestions] = useState([]);
  const [vivaSubject, setVivaSubject] = useState('Programming for Problem Solving (PPS)');
  const [vivaListening, setVivaListening] = useState(false);
  const [vivaInputMode, setVivaInputMode] = useState('text');
  const [mentorInput, setMentorInput] = useState('');
  const [mentorMessages, setMentorMessages] = useState([]);
  const [mentorBusy, setMentorBusy] = useState(false);
  // AI Mentorship page UI state (aar- CSS namespace retained) — presentation only, local mock backend.
  const [aarMood, setAarMood] = useState(null);
  const [aarTool, setAarTool] = useState(AAR_CHAT_TAB);
  const [aarThread, setAarThread] = useState(0);
  const [aarInfo, setAarInfo] = useState(null);
  const [aarCalm, setAarCalm] = useState(false);
  const [aarCalmStep, setAarCalmStep] = useState(0);
  const [aarCalmRounds, setAarCalmRounds] = useState(0);
  const [aarJournal, setAarJournal] = useState([]);
  const [aarDraft, setAarDraft] = useState('');
  const [aarRecovery, setAarRecovery] = useState([]);
  const [aarCircle, setAarCircle] = useState(null);
  const [aarTimeline, setAarTimeline] = useState([]);
  const [aarDone, setAarDone] = useState([]);
  // Voice mode for the large centre mic button. The ref mirrors the state so the
  // speech callbacks (which run outside React) can read the live value.
  const [aarVoice, setAarVoice] = useState('off');
  const aarVoiceRef = useRef('off');
  const setAarVoiceMode = (v) => { aarVoiceRef.current = v; setAarVoice(v); };

  useEffect(() => {
    if (!aarCalm) return undefined;
    const id = setInterval(() => setAarCalmStep((s) => {
      if (s === 3) setAarCalmRounds((r) => r + 1);
      return (s + 1) % 4;
    }), 2200);
    return () => clearInterval(id);
  }, [aarCalm]);

  const login = async (asRole = role) => {
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ role: asRole, facultyId: asRole === "Faculty" ? facultyId : null }) });
      localStorage.setItem("campusLmsToken", result.token);
      setServerData(result.user);
      setLoggedIn(true);
      setRole(asRole);
      setActive("Dashboard");
      showToast(`${result.user.name} login connected to CampusLMS backend.`);
    } catch (error) { showToast(error.message); }
  };
  const logout = () => {
    localStorage.removeItem("campusLmsToken"); setLoggedIn(false); setActive("Dashboard"); setServerData(null); setWorkspace(null); setWorkflowStep(0); showToast("Logged out successfully.");
  };
  const go = (page) => setActive(page);
  const openStudentTool = async (tool) => {
    setActive(tool); setToolBusy(true);
    try {
      const r = await api(`/api/student-tools/${encodeURIComponent(tool)}`);
      setStudentToolState(r.state || {});
      if(tool==='Academic Twin'){
        const twin=await api('/api/student-dashboard/academic-twin');
        setStudentToolState(v=>({...v,analysis:twin}));
      }
      if(tool==='Exam Readiness'){
        const smart=await api('/api/student-dashboard/smart-tools');
        setStudentToolState(v=>({...v,readiness:smart.readiness}));
      }
      if(tool==='AI Mentorship'){
        const mentor=await api('/api/student-dashboard/mentorship');
        setMentorMessages(mentor.messages||[]);
      }
      if(tool==='AI Viva Simulator'){
        setVivaIndex(0);setVivaAnswer('');setVivaFeedback('');setVivaInputMode('text');
        const q=await api(`/api/student-dashboard/viva/questions?subject=${encodeURIComponent(vivaSubject)}`);
        setVivaQuestions(q.questions||[]);
      }
    }
    catch(e){ showToast(`Could not load ${tool}: ${e.message}`); }
    finally { setToolBusy(false); }
  };
  const saveStudentTool = async (tool, state) => {
    try { const r = await api(`/api/student-tools/${encodeURIComponent(tool)}`, {method:'POST', body:JSON.stringify({role, state})}); setStudentToolState(r.state || state); return r.state || state; }
    catch(e){ showToast(`Backend save failed: ${e.message}`); throw e; }
  };

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const rescueStore = (tool) => tool || {};
  const logFocusSession = async (minutes, label) => {
    const prev = rescueStore(studentToolState);
    const log = [...(prev.focusLog || [])];
    const day = todayKey();
    const idx = log.findIndex(x => x.day === day);
    if (idx > -1) log[idx] = { ...log[idx], minutes: log[idx].minutes + minutes, sessions: log[idx].sessions + 1 };
    else log.push({ day, minutes, sessions: 1 });
    const sessions = [...(prev.sessions || [])];
    sessions.unshift({ at: new Date().toISOString(), minutes, label: label || 'Focus session' });
    await saveStudentTool('30-Min Rescue', { ...prev, focusLog: log.slice(-14), sessions: sessions.slice(0, 12) });
    showToast(`Focus session saved — ${minutes} minutes logged for today.`);
  };

  useEffect(() => {
    if (!pomo.running || active !== '30-Min Rescue') return undefined;
    const id = window.setInterval(() => {
      setPomo(v => (v.remaining <= 1 ? { ...v, remaining: 0, running: false, completed: v.phase } : { ...v, remaining: v.remaining - 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [pomo.running, active]);

  useEffect(() => {
    if (!pomo.completed) return;
    const phase = pomo.completed;
    const next = phase === 'focus' ? 'break' : 'focus';
    const minutes = phase === 'focus' ? pomo.focusLength : pomo.breakLength;
    setPomo(v => ({ ...v, completed: null, phase: next, remaining: minutes * 60 }));
    if (phase === 'focus') logFocusSession(minutes, 'Pomodoro focus block');
    else showToast('Break finished — next focus block is ready.');
  }, [pomo.completed]);

  useEffect(() => {
    if (active !== '30-Min Rescue' && pomo.running) setPomo(v => ({ ...v, running: false }));
  }, [active]);

  /* Academic Twin reads the focus-session log that 30-Min Rescue already
     persists, so the weekly trend is real recorded study time rather than a
     mock series. Failure is silent — the trend panel simply hides itself. */
  useEffect(() => {
    if (active !== 'Academic Twin' || twinFocusLog.length) return undefined;
    let live = true;
    api('/api/student-tools/30-Min%20Rescue')
      .then(r => { if (live) setTwinFocusLog((r.state && r.state.focusLog) || []); })
      .catch(() => {});
    return () => { live = false; };
  }, [active, twinFocusLog.length]);

  const pomoClock = `${String(Math.floor(pomo.remaining / 60)).padStart(2, '0')}:${String(pomo.remaining % 60).padStart(2, '0')}`;
  const pomoTotal = (pomo.phase === 'focus' ? pomo.focusLength : pomo.breakLength) * 60;
  const pomoElapsed = pomoTotal - pomo.remaining;
  const rescueState = rescueStore(studentToolState);
  const dailyTarget = Number(rescueState.dailyTarget || 120);
  const todayLog = (rescueState.focusLog || []).find(x => x.day === todayKey());
  const minutesToday = todayLog?.minutes || 0;
  const targetPct = Math.min(100, Math.round((minutesToday / Math.max(1, dailyTarget)) * 100));

  /* Device speech synthesis. Chrome loads voices lazily and drops or truncates
     speech that starts too early, so playback waits for a real voice, then
     queues the reply chunk by chunk. `speakRun` invalidates an earlier queue
     whenever a newer request takes over. */
  const stopSpeaking = () => {
    speakRun.current += 1;
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
  };

  const speakQueue = (chunks, run) => {
    if (run !== speakRun.current || !chunks.length) return;
    const synth = window.speechSynthesis;
    const [head, ...rest] = chunks;
    const voice = pickPersonaVoice(speakVoices.current.length ? speakVoices.current : synth.getVoices());
    const utterance = new SpeechSynthesisUtterance(head);
    utterance.lang = VIDYA.voice.lang;
    utterance.rate = VIDYA.voice.rate;
    utterance.pitch = VIDYA.voice.pitch;
    utterance.volume = VIDYA.voice.volume;
    if (voice) utterance.voice = voice;
    /* Advance to the next chunk once this one ends, and never stall: Chrome
       intermittently leaves the engine paused or swallows onend, and a stalled
       queue would cut the answer off mid-sentence. */
    let settled = false;
    const advance = () => {
      if (settled) return;
      settled = true; clearTimeout(watchdog);
      if (run !== speakRun.current || !rest.length) return;
      if (synth.paused) { try { synth.resume(); } catch { /* ignore */ } }
      setTimeout(() => speakQueue(rest, run), 90);
    };
    utterance.onend = advance;
    utterance.onerror = advance;
    const watchdog = setTimeout(advance, Math.max(6000, (head.length / (VIDYA.voice.rate * 13)) * 1000 + 5000));
    try { if (synth.paused) synth.resume(); synth.speak(utterance); } catch { advance(); }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return showToast('Voice playback is not supported in this browser.');
    const chunks = splitForSpeech(text);
    if (!chunks.length) return;
    const run = ++speakRun.current;
    const synth = window.speechSynthesis;
    synth.cancel();
    /* Short delay so the engine honours the cancel before the new queue starts. */
    setTimeout(() => {
      if (run !== speakRun.current) return;
      const started = Date.now();
      const start = () => {
        if (run !== speakRun.current) return;
        if (speakVoices.current.length || synth.getVoices().length || Date.now() - started > 1200) { speakQueue(chunks, run); return; }
        setTimeout(start, 120);
      };
      start();
    }, 70);
  };

  const startSpeechCapture = (onText, setListening) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { showToast('Voice input is not supported in this browser. Use Chrome/Edge or type your answer.'); return; }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); showToast('Could not hear the voice clearly. Please try again or type.'); };
    recognition.onresult = (event) => onText(event.results?.[0]?.[0]?.transcript || '');
    recognition.start();
  };

  const sendMentorMessage = async (override) => {
    // `override` lets the voice mode send a dictated message without waiting for
    // a re-render. Guarded by typeof so a click event can never be treated as text.
    const message = (typeof override === 'string' ? override : mentorInput).trim();
    if (!message || mentorBusy) return;
    setMentorBusy(true);
    try {
      const userMsg={id:`local-${Date.now()}`,role:'user',message,createdAt:new Date().toISOString()};
      setMentorMessages(v=>[...v,userMsg]);
      setMentorInput('');
      const r=await api('/api/student-dashboard/mentorship/chat',{method:'POST',body:JSON.stringify({message,studentId:'CSE26-001',...VIDYA.apiPayload()})});
      const mentorMsg={id:r.createdAt,role:'mentor',message:r.reply,plan:r.plan,pressure:r.pressure,createdAt:r.createdAt};
      setMentorMessages(v=>[...v,mentorMsg]);
      speakText(r.reply);
    } catch(e) { showToast(e.message); }
    finally { setMentorBusy(false); }
  };

  /* Large centre mic button. Clicking starts voice mode: VIDYA greets the
     student, listens, then sends whatever was dictated as a normal chat turn.
     Clicking again cancels. Recognition is reused from the viva flow. */
  const toggleAarVoice = () => {
    if (aarVoiceRef.current === 'live') {
      setAarVoiceMode('off');
      try { window.speechSynthesis?.cancel(); } catch {}
      return;
    }
    setAarTool(AAR_CHAT_TAB);
    setAarVoiceMode('live');
    speakText('I am here with you. Go ahead, tell me how your day has been.');
    startSpeechCapture(
      (text) => {
        if (aarVoiceRef.current !== 'live') return;
        setAarVoiceMode('off');
        if (text) sendMentorMessage(text);
      },
      (listening) => { if (!listening && aarVoiceRef.current === 'live') setAarVoiceMode('off'); },
    );
  };

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(window.__campusToastTimer);
    window.__campusToastTimer = window.setTimeout(() => setToast(""), 2600);
  };

  const runAction = async (action, meta = {}) => {
    try {
      const result = await api("/api/actions", { method: "POST", body: JSON.stringify({ role, action, meta }) });
      showToast(result.message || `${action} recorded.`);
      setWorkspace({ title: action.replace(/ opened\.?$/, "").replace(/:.*$/, ""), action, meta, result });
    } catch (error) { showToast(error.message); }
  };
  const openRoleWorkspace = (title, meta = {}) => { setWorkflowStep(0); setReaderOpen(false); setWorkspace({ title, action: title, meta, role }); };

  const openDashboardFeature = async (feature) => {
    setDashboardFeatureBusy(true);
    try {
      if (feature === 'Academic Twin') {
        const r = await api('/api/student-dashboard/academic-twin');
        setWorkspace({title:'Academic Twin', action:'academic-twin', data:r});
      } else if (feature === 'Academic Insights') {
        const r = await api('/api/student-dashboard/insights');
        setWorkspace({title:'Academic Insights', action:'academic-insights', data:r});
      } else if (feature === 'My Subjects') {
        const r = await api('/api/student-dashboard/subjects');
        setWorkspace({title:'My Subjects', action:'student-subjects', data:r});
      } else if (feature === 'Pending Assignments') {
        const r = await api('/api/student-dashboard/assignments-summary');
        setWorkspace({title:'Pending Assignments', action:'student-assignments-summary', data:r});
      } else if (feature === 'Learning Progress') {
        const r = await api('/api/student-dashboard/progress');
        setWorkspace({title:'Learning Progress', action:'student-progress', data:r});
      } else if (feature === 'Upcoming Exams') {
        const r = await api('/api/student-dashboard/exams');
        setWorkspace({title:'Upcoming Exams', action:'student-exams', data:r});
      } else if (feature === 'Upcoming Classes') {
        const r = await api('/api/student-dashboard/timetable');
        setWorkspace({title:'Upcoming Classes', action:'student-timetable', data:r});
      } else if (feature === 'Mentorship') {
        const r = await api('/api/student-dashboard/mentorship');
        setWorkspace({title:'Live AI Mentorship', action:'mentorship', data:r});
      } else if (feature === 'Faculty Handoff') {
        setWorkspace({title:'AI → Faculty Handoff', action:'faculty-handoff'});
      } else if (feature === 'PYQ Rapid Test') {
        openStudentTool('Mock Tests');
      } else if (feature === 'Study Planner') {
        openStudentTool('30-Min Rescue');
      }
    } catch (e) { showToast(`Could not load ${feature}: ${e.message}`); }
    finally { setDashboardFeatureBusy(false); }
  };

  const createFacultyHandoff = async () => {
    try {
      const title = document.getElementById('handoff-title')?.value?.trim() || 'Student needs faculty support';
      const description = document.getElementById('handoff-description')?.value?.trim() || 'Created from CampusAI Faculty Handoff.';
      const r = await api('/api/student-dashboard/faculty-handoff', {method:'POST', body:JSON.stringify({title,description,studentId:'CSE26-001'})});
      await refreshDashboard(); closeWorkspace(); showToast(r.message);
    } catch(e) { showToast(e.message); }
  };

  const mentorshipAction = async (action) => {
    try {
      const r = await api('/api/student-dashboard/mentorship', {method:'POST',body:JSON.stringify({action,studentId:'CSE26-001',title:'DSA Problem Solving',time:'Today, 5:00 PM'})});
      setWorkspace(w=>({...w, data:{...(w?.data||{}), latest:r.session}}));
      showToast(r.message);
    } catch(e) { showToast(e.message); }
  };

  const closeWorkspace = () => setWorkspace(null);

  const createAssignment = async () => {
    const title = window.prompt("Assignment title", "New CSE Assignment");
    if (!title?.trim()) return;
    const subject = window.prompt("Subject", "Programming");
    const deadline = window.prompt("Deadline (YYYY-MM-DD)", "2026-10-05");
    try { const r = await api("/api/assignments", { method:"POST", body:JSON.stringify({title, subject, deadline, role}) }); await refreshDashboard(); showToast(`Assignment '${r.assignment.title}' created and saved.`); closeWorkspace(); } catch(e){showToast(e.message)}
  };

  /* Returns the reply text so a voice turn can also read it aloud. Existing
     callers ignore the return value, so the written behaviour is unchanged. */
  const askAI = async (directMessage = "") => {
    const message = (directMessage || aiInput).trim(); if (!message) return "";
    setAiMessages(m => [...m, {role:"user", text:message}]); setAiInput("");
    try { const r = await api("/api/ai/chat", {method:"POST", body:JSON.stringify({role, message, context:{assignments:serverData?.assignments||[], announcements:serverData?.announcements||[]}})}); const reply = r.reply || ""; setAiMessages(m => [...m, {role:"assistant", text:reply, data:r.data}]); return reply; } catch(e){ const failure = `I could not connect to the CampusAI service: ${e.message}`; setAiMessages(m => [...m,{role:"assistant",text:failure}]); return failure; }
  };

  const openResource = async (resource) => {
    try { const r = await api(`/api/resources/${encodeURIComponent(resource.id || resource.title)}`); setReaderOpen(false); setWorkspace({title:resource.title, action:"resource", resource:r.resource}); } catch(e){ setWorkspace({title:resource.title, action:"resource", resource}); }
  };

  const refreshDashboard = async () => {
    try {
      const result = await api(`/api/dashboard?role=${encodeURIComponent(role)}${role === "Faculty" ? `&facultyId=${encodeURIComponent(facultyId)}` : ""}`);
      setServerData(result);
      if (role === 'Student') {
        try { const smart = await api('/api/student-dashboard/smart-tools'); setSmartToolsData(smart); } catch(e) { console.warn('Smart tools sync failed:', e.message); }
      }
      setNotifications((result.notifications || []).length);
      setAnnouncements(result.announcements || []);
      if (result.resources) window.__campusResources = result.resources;
    } catch (error) { showToast(error.message); }
  };

  useEffect(() => {
    if (loggedIn) refreshDashboard();
  }, [loggedIn, role, facultyId]);

  useEffect(() => {
    if (loggedIn && active === 'Academic Records' && !recordLoaded) loadStudentRecord();
    if (loggedIn && active === 'Certificates' && !certificatesLoaded) loadCertificates();
    if (loggedIn && active === 'Question Practice' && !practiceQuestions.length && !practiceLoading) loadPracticeQuestions(practiceSubject);
    if (loggedIn && active === 'Resources' && !vaultData) loadVault();
  }, [loggedIn, active]);

  const loadSyllabus = async () => {
    try { const r = await api("/api/syllabus"); setSyllabusData(r); }
    catch (e) { showToast(`Could not load syllabus: ${e.message}`); }
  };
  const loadVault = async () => {
    try { const r = await api('/api/resource-vault?department=' + encodeURIComponent('Computer Science & Engineering (IoT)') + '&semester=' + encodeURIComponent('Semester I')); setVaultData(r); }
    catch (e) { showToast(`Could not load Resource Vault: ${e.message}`); }
  };
  const openNotifications = async () => {
    try { const [n,h] = await Promise.all([api('/api/notifications'),api('/api/database/health')]); setWorkspace({title:'Notification Center',action:'Notification Center',data:{...n,health:h}}); }
    catch(e){showToast(e.message);}
  };
  const sendNotificationTest = async () => {
    try { const r=await api('/api/notifications/test',{method:'POST',body:JSON.stringify({role,provider:'Generic',title:'CampusLMS Test Alert',body:'This is a live notification webhook test.'})}); showToast(r.notification?.deliveries?.length?'Webhook test dispatched.':'Notification saved to outbox.'); } catch(e){showToast(e.message)}
  };
  const configureWebhook = async () => {
    const provider=document.getElementById('webhook-provider')?.value||'Generic'; const name=document.getElementById('webhook-name')?.value?.trim()||`${provider} bridge`; const url=document.getElementById('webhook-url')?.value?.trim(); const secret=document.getElementById('webhook-secret')?.value||'';
    if(!url) return showToast('Webhook URL is required.');
    try { await api('/api/notifications/webhooks',{method:'POST',body:JSON.stringify({provider,name,url,secret,role})}); showToast(`${provider} notification bridge saved.`); await openNotifications(); } catch(e){showToast(e.message)}
  };

  const loadStudentRecord = async () => { try { const r=await api('/api/student-records'); setStudentRecord(r.record); setRecordLoaded(true); } catch(e){showToast(`Could not load academic record: ${e.message}`);} };
  const loadCertificates = async () => { try { const r=await api('/api/certificates'); setCertificates(r.certificates||[]); setCertificatesLoaded(true); } catch(e){showToast(`Could not load certificates: ${e.message}`);} };

  const loadPracticeQuestions = async (subject = practiceSubject) => {
    setPracticeLoading(true);
    try {
      const [q, st] = await Promise.all([api(`/api/question-bank?subject=${encodeURIComponent(subject)}`), api('/api/question-bank/stats')]);
      setPracticeQuestions(q.questions || []); setPracticeStats(st); setPracticeIndex(0); setPracticeSelected(null); setPracticeFeedback(null);
    } catch (e) { showToast(`Could not load question practice: ${e.message}`); }
    finally { setPracticeLoading(false); }
  };
  const submitPracticeAnswer = async () => {
    const q = practiceQuestions[practiceIndex];
    if (!q || practiceSelected === null) return showToast('Select an answer first.');
    try {
      const r = await api('/api/question-bank/attempt', {method:'POST', body:JSON.stringify({questionId:q.id,selectedIndex:practiceSelected,studentId:'CSE26-001'})});
      setPracticeFeedback(r);
      const st = await api('/api/question-bank/stats'); setPracticeStats(st);
    } catch (e) { showToast(e.message); }
  };
  const nextPracticeQuestion = () => {
    if (practiceIndex >= practiceQuestions.length - 1) { showToast('You completed this subject practice set.'); return; }
    setPracticeIndex(v=>v+1); setPracticeSelected(null); setPracticeFeedback(null);
  };

  const publishAnnouncement = async (title, body) => {
    try {
      const result = await api("/api/announcements", { method: "POST", body: JSON.stringify({ title, body, role }) });
      setAnnouncements((items) => [result.announcement, ...items]);
      await refreshDashboard();
      showToast("Announcement published to the backend and class feed.");
    } catch (error) { showToast(error.message); }
  };

  const previewAssignmentFile = (assignment, file) => {
    if (!file) return;
    if (assignment.locked || (assignment.deadline && new Date(`${assignment.deadline}T23:59:59+05:30`).getTime() < Date.now())) return showToast(`Submission locked after ${assignment.deadline}.`);
    const reader=new FileReader();
    reader.onload=()=>{const previewUrl=String(reader.result||'');setAssignmentPreview({assignment,file,previewUrl});setWorkspace({title:`Preview • ${assignment.title}`,action:'assignment-preview',assignment,file,previewUrl});};
    reader.onerror=()=>showToast('Could not read the selected file.');
    reader.readAsDataURL(file);
  };
  const submitAssignment = async (assignmentId, file = null, answerText = '') => {
    try {
      let payload = { assignmentId, studentId: "CSE26-001", fileName: file?.name || "assignment-submission.pdf", answerText };
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          payload.fileSize = file.size; payload.fileType = file.type; payload.content = String(reader.result || '');
          const result = await api("/api/assignments/submit", { method:"POST", body:JSON.stringify(payload) });
          setSubmitted(true); setAssignmentPreview(null); setWorkspace(null); setServerData(current => current ? {...current, assignments:current.assignments.map(a=>a.id===result.assignment.id?result.assignment:a)}:current); showToast(result.message);
        };
        reader.readAsDataURL(file);
      } else {
        const result = await api("/api/assignments/submit", { method:"POST", body:JSON.stringify(payload) });
        setSubmitted(true); setServerData(current => current ? {...current, assignments:current.assignments.map(a=>a.id===result.assignment.id?result.assignment:a)}:current); showToast(result.message);
      }
    } catch (error) { showToast(error.message); }
  };
  const openAssignmentEvaluation = async (assignmentId) => {
    try { const r=await api(`/api/assignments/${encodeURIComponent(assignmentId)}/submissions`); setWorkspace({title:'Assignment Evaluation',action:'assignment-evaluation',data:r}); } catch(e){showToast(e.message)}
  };
  const gradeSubmission = async (assignmentId, submissionId) => {
    const grade=document.getElementById(`grade-${submissionId}`)?.value||''; const feedback=document.getElementById(`feedback-${submissionId}`)?.value||'';
    try { const r=await api(`/api/assignments/${encodeURIComponent(assignmentId)}/grade`,{method:'POST',body:JSON.stringify({submissionId,grade,feedback,facultyId,role:'Faculty'})}); setWorkspace(w=>({...w,data:{...w.data,submissions:(w.data.submissions||[]).map(s=>s.id===submissionId?r.submission:s)}})); showToast(r.message); } catch(e){showToast(e.message)}
  };

  const raiseIssue = async () => {
    const title = window.prompt("Issue title", "Need help with assignment") || "";
    if (!title.trim()) return;
    try {
      const result = await api("/api/issues", { method: "POST", body: JSON.stringify({ title, description: "Raised from CR dashboard", raisedBy: "CR-CSE-01" }) });
      showToast(`Issue #${result.issue.id} raised successfully.`);
      refreshDashboard();
    } catch (error) { showToast(error.message); }
  };

  const createPoll = async () => {
    const question = window.prompt("Poll question", "Which topic needs a revision session?") || "";
    if (!question.trim()) return;
    try {
      await api("/api/polls", { method: "POST", body: JSON.stringify({ question, options: ["Mathematics", "Physics", "Programming"], createdBy: "CR-CSE-01" }) });
      showToast("Poll created and stored in the backend.");
    } catch (error) { showToast(error.message); }
  };

  const toggleVoiceAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast("Voice input is not supported by this browser. Use Chrome or Edge.");
    if (voiceListening) return;
    const recognition = new SpeechRecognition(); recognition.lang = "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    setVoiceListening(true); showToast("CampusAI is listening...");
    recognition.onresult = (event) => { const text = event.results?.[0]?.[0]?.transcript || ""; setAiInput(text); setVoiceListening(false); setActive("AI Assistant"); if (text.trim()) setTimeout(() => askAI(text), 0); };
    recognition.onerror = () => { setVoiceListening(false); showToast("Voice input could not be captured. Please try again."); };
    recognition.onend = () => setVoiceListening(false); recognition.start();
  };
  /* VIDYA send. Delegates to askAI so the request shape, endpoint and message
     history stay identical to the full-page AI Assistant. When the turn came
     from the microphone, `speakReply` also reads the answer aloud — the written
     message is always added either way. */
  const vidyaAsk = async (text, speakReply = false) => {
    const message = (text || "").trim(); if (!message || vidyaThinking) return;
    setVidyaThinking(true);
    try {
      const reply = await askAI(message);
      if (speakReply && reply) {
        /* Small grace period so the recogniser has fully released the mic and
           cannot pick up VIDYA's own playback. */
        setTimeout(() => { if (aiLauncherOpen) speakText(reply); }, 350);
      }
    } finally { setVidyaThinking(false); }
  };

  /* Voice for the floating assistant. Same recogniser as toggleVoiceAssistant,
     but it keeps the card open, sends through vidyaAsk instead of navigating
     away, and asks for the answer to be spoken back. */
  const vidyaVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast("Voice input is not supported by this browser. Use Chrome or Edge.");
    if (vidyaListening) return;
    /* Stop any playback first so the microphone never captures VIDYA. */
    stopSpeaking();
    const recognition = new SpeechRecognition(); recognition.lang = "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    setVidyaListening(true); showToast(`${VIDYA.name} is listening...`);
    recognition.onresult = (event) => { const text = event.results?.[0]?.[0]?.transcript || ""; setVidyaListening(false); if (text.trim()) vidyaAsk(text, true); };
    recognition.onerror = () => { setVidyaListening(false); showToast("Voice input could not be captured. Please try again."); };
    recognition.onend = () => setVidyaListening(false); recognition.start();
  };

  const loadCommunity = async () => { try { const result = await api("/api/community/posts"); setCommunityPosts(result.posts || []); } catch (e) { showToast(e.message); } };
  /* Display name for whoever is posting. Same value the publish call has always
     sent, just named once so the composer, feed and replies agree. */
  const communityAuthor = role === "Faculty" ? (serverData?.user?.name || facultyDirectory.find(f => f.id === facultyId)?.name || "Faculty") : "Satya Prakash";
  const publishCommunityPost = async () => {
    const text = communityText.trim(); if (!text) return showToast("Write something before posting.");
    setCommunityPosting(true);
    try { const result = await api("/api/community/posts", { method:"POST", body:JSON.stringify({author: communityAuthor, role, text}) }); setCommunityPosts(posts => [result.post, ...posts]); setCommunityText(""); showToast("Post published to the community."); } catch(e) { showToast(e.message); }
    finally { setCommunityPosting(false); }
  };
  /* Like toggle. Same endpoint, payload and optimistic list swap as before. */
  const toggleCommunityLike = async (post) => {
    try { const r = await api(`/api/community/posts/${post.id}/like`, { method:"POST", body:JSON.stringify({userId:COMMUNITY_USER_ID, role}) }); setCommunityPosts(items => items.map(x => x.id === r.post.id ? r.post : x)); } catch (e) { showToast(e.message); }
  };
  const submitCommunityReply = async (post) => {
    const text = (communityDrafts[post.id] || "").trim();
    if (!text || communityBusy[post.id]) return;
    setCommunityBusy(b => ({ ...b, [post.id]: true }));
    try {
      const r = await api(`/api/community/posts/${post.id}/comments`, { method:"POST", body:JSON.stringify({author: communityAuthor, role, text}) });
      setCommunityPosts(items => items.map(x => x.id === r.post.id ? r.post : x));
      setCommunityDrafts(d => ({ ...d, [post.id]: "" }));
      setCommunityOpen(o => ({ ...o, [post.id]: true }));
    } catch (e) { showToast(e.message); }
    finally { setCommunityBusy(b => ({ ...b, [post.id]: false })); }
  };
  /* A starter only prefills the composer, and never overwrites a real draft. */
  const applyCommunityStarter = (starter) => {
    const current = communityText.trim();
    const isStarter = !current || COMMUNITY_STARTERS.some(s => s.prompt === current);
    if (!isStarter) return showToast("Finish or clear your draft before using a starter.");
    setCommunityText(starter.prompt);
  };
  const toggleCommunityGroup = (key) => setCommunityGroup(g => (g === key ? "" : key));
  const toggleCommunityJoin = (key) => setCommunityJoined(list => (list.includes(key) ? list.filter(x => x !== key) : [...list, key]));

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => !q || `${r.title} ${r.type} ${r.subject}`.toLowerCase().includes(q));
  }, [search]);

  const facultyRecord = useMemo(() => {
    if (serverData?.faculty) return serverData.faculty;
    if (serverData?.user?.role === 'Faculty') return serverData.user;
    return facultyDirectory.find((f) => f.id === facultyId) || facultyDirectory[0] || {};
  }, [serverData, facultyId]);

  const facultyIntel = useMemo(() => {
    const subjects = facultyRecord.subjects || [];
    const scope = subjects.length ? subjects : (serverData?.subjects || []).map((s) => s.name).filter(Boolean);
    const profile = (serverData?.subjects || []).filter((s) => scope.includes(s.name));

    // Real per-subject progress, straight from the backend subjects profile.
    const subjectMetrics = scope.map((name) => {
      const row = profile.find((p) => p.name === name);
      const progress = Number(row?.progress || 0);
      const rowAssignments = (serverData?.assignments || []).filter((a) => a.subject === name);
      const submitted = rowAssignments.filter((a) => a.status === 'Submitted').length;
      const pendingEval = rowAssignments.filter((a) => a.status === 'Submitted').length;
      return {
        name,
        progress,
        known: row != null,
        assignments: rowAssignments.length,
        submitted,
        pendingEval,
        resources: (serverData?.resources || []).filter((r) => r.subject === name).length,
        gap: row ? Math.max(0, 100 - progress) : null,
      };
    });

    const attendance = serverData?.attendance || {};
    const attendancePct = attendance.total ? Math.round((attendance.present / attendance.total) * 100) : null;
    const cohort = Number(serverData?.stats?.students || 0);

    const scored = subjectMetrics.filter((s) => s.known);
    const avgProgress = scored.length ? Math.round(scored.reduce((n, s) => n + s.progress, 0) / scored.length) : null;
    const avgGap = scored.length ? Math.round(scored.reduce((n, s) => n + s.gap, 0) / scored.length) : null;

    // Cohort-level risk drivers. Every number here traces to a backend record.
    const drivers = [
      { label: 'Subject mastery gap', value: avgGap, note: 'Average of 100 − subject progress', source: 'Dashboard subjects profile' },
      { label: 'Attendance shortfall', value: attendancePct == null ? null : Math.max(0, 100 - attendancePct), note: `${attendance.present || 0} of ${attendance.total || 0} present today`, source: '/api/dashboard attendance' },
      { label: 'Assignment backlog', value: (serverData?.assignments || []).length ? Math.round(((serverData?.assignments || []).filter((a) => a.status === 'Pending' || a.status === 'Upcoming').length / (serverData?.assignments || []).length) * 100) : null, note: 'Share of assignments not yet submitted', source: 'Dashboard assignments' },
      { label: 'Evaluation backlog', value: (serverData?.assignments || []).length ? Math.round(((serverData?.assignments || []).filter((a) => a.status === 'Submitted').length / (serverData?.assignments || []).length) * 100) : null, note: 'Share awaiting evaluation', source: 'Dashboard assignments' },
    ];

    const liveDrivers = drivers.filter((d) => d.value != null);
    const exposure = liveDrivers.length ? Math.round(liveDrivers.reduce((n, d) => n + d.value, 0) / liveDrivers.length) : null;
    const atRiskCohort = exposure == null ? null : Math.round((exposure / 100) * cohort);

    const band = (value) => (value == null ? null
      : value >= 60 ? 'high' : value >= 40 ? 'at' : value >= 20 ? 'support' : 'track');
    const bands = FACULTY_V16.riskBands.map((b) => ({ ...b, count: b.key === 'track' ? (exposure == null ? null : Math.max(0, cohort - atRiskCohort)) : 0 }));
    if (exposure != null) {
      // Only the band the cohort actually falls into is ever populated.
      const active = band(exposure);
      bands.forEach((b) => { if (b.key !== 'track' && b.key !== active) b.count = 0; });
      bands.find((b) => b.key === active).count = atRiskCohort;
    }

    // Concept heat: real subject gap blended with real doubt tickets and evaluation backlog.
    const tickets = serverData?.tickets || [];
    const concepts = scope.flatMap((subject) => {
      const metric = subjectMetrics.find((m) => m.name === subject);
      const names = FACULTY_V16.conceptCatalog[subject] || FACULTY_V16.fallbackConcepts;
      return names.map((concept) => {
        const match = tickets.filter((t) => `${t.title || ''} ${t.description || ''}`.toLowerCase().includes(concept.split(' ')[0].toLowerCase()));
        const gap = metric?.gap == null ? null : Math.max(0, Math.round(metric.gap - (names.indexOf(concept) * 3)));
        const heat = gap == null ? null : Math.min(100, gap + match.length * 15 + (metric.pendingEval ? 5 : 0));
        return { subject, concept, heat, doubts: match.length, gap, signals: gap == null ? 0 : (match.length ? match.length + 1 : 1) };
      });
    });

    return {
      subjects, scope, subjectMetrics, profile, cohort,
      attendance, attendancePct, avgProgress, avgGap,
      drivers, exposure, band, bands, atRiskCohort,
      tickets, concepts,
      pendingEvaluations: serverData?.stats?.pendingEvaluations ?? null,
      resourceCount: (serverData?.resources || []).filter((r) => !scope.length || scope.includes(r.subject)).length,
      hasAnalytics: avgProgress != null || attendancePct != null,
    };
  }, [serverData, facultyRecord]);

  const v16Persist = async (patch) => {
    setFacultyV16((v) => ({ ...v, ...patch }));
    try {
      await api(`/api/student-tools/Faculty%20Analytics%20State`, {
        method: 'POST',
        body: JSON.stringify({ role: 'Faculty', facultyId, state: { ...facultyV16, ...patch, semester: facultySemester } }),
      });
    } catch (e) { console.warn('Faculty module state sync failed:', e.message); }
  };

  const v16Ask = async (key, prompt) => {
    setV16Busy(key);
    setV16Out('');
    try {
      const r = await api('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ role: 'Faculty', message: prompt }),
      });
      const text = r?.reply || r?.message || r?.text || '';
      setV16Out(text);
      return text;
    } catch (e) { setV16Out(`AI service unavailable: ${e.message}`); return ''; }
    finally { setV16Busy(''); }
  };

  useEffect(() => {
    if (role !== 'Faculty') return;
    (async () => {
      try {
        const r = await api(`/api/student-tools/Faculty%20Analytics%20State?role=Faculty&facultyId=${encodeURIComponent(facultyId)}`);
        const s = r?.state || r?.data;
        if (s && typeof s === 'object') {
          if (s.semester && FACULTY_V16.semesters.includes(s.semester)) setFacultySemester(s.semester);
          setFacultyV16((v) => ({ ...v, ...['rescues', 'parentLog', 'plans'].map((k) => [k, Array.isArray(s[k]) ? s[k] : v[k]]).reduce((o, [k, val]) => ({ ...o, [k]: val }), {}) }));
        }
      } catch (e) { console.warn('Faculty module state load skipped:', e.message); }
    })();
  }, [role, facultyId]);

  const crIntel = useMemo(() => {
    const attendance = serverData?.attendance || {};
    const cohort = Number(attendance.total || serverData?.stats?.students || 0);
    const present = Number(attendance.present || serverData?.stats?.present || 0);
    const attendancePct = attendance.total ? Math.round((present / attendance.total) * 100) : null;

    // The CR dashboard payload omits subjects and schedules, so both come from
    // their own endpoints and are merged in here.
    const rawSubjects = crLive.subjects.length ? crLive.subjects : (serverData?.subjects || []);
    const subjects = rawSubjects.map((s) => ({ name: s.name, progress: Number(s.progress || 0), known: s.progress != null }));
    const avgProgress = subjects.length ? Math.round(subjects.reduce((n, s) => n + s.progress, 0) / subjects.length) : null;
    const weakest = subjects.filter((s) => s.known).sort((a, b) => a.progress - b.progress).slice(0, 3);

    const allAssignments = serverData?.assignments || [];
    const byStatus = (s) => allAssignments.filter((a) => a.status === s).length;
    const submissions = allAssignments.reduce((n, a) => n + (a.submissions?.length || 0), 0);
    const submissionRate = allAssignments.length ? Math.round((submissions / Math.max(1, allAssignments.length * cohort)) * 100) : null;

    const issues = serverData?.issues || [];
    const openIssues = issues.filter((i) => i.status !== 'Resolved');
    const anonymousIssues = issues.filter((i) => !i.raisedBy || i.raisedBy === 'Anonymous');
    const polls = serverData?.polls || [];
    const schedules = crLive.schedules.length ? crLive.schedules : (serverData?.schedules || []);
    const tickets = serverData?.tickets || [];
    const recentAnnouncements = serverData?.announcements || [];

    // Per-student rows exist only where the backend actually stores a submission.
    const studentMap = {};
    allAssignments.forEach((a) => (a.submissions || []).forEach((s) => {
      const sid = s.studentId || s.id;
      if (!sid) return;
      studentMap[sid] = studentMap[sid] || { id: sid, name: s.studentName || s.name || sid, submitted: 0, assignments: [], late: 0 };
      studentMap[sid].submitted += 1;
      studentMap[sid].assignments.push(a.title);
    }));
    const roster = Object.values(studentMap);

    // Prioritised action queue — every item points at a real record.
    const queue = [];
    if (openIssues.length) queue.push({ key: 'issues', level: 'high', label: `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}`, detail: 'Triage the anonymous issue box', to: 'Anonymous Issue Box' });
    if (allAssignments.filter((a) => a.status === 'Pending').length) queue.push({ key: 'submit', level: 'mid', label: `${byStatus('Pending')} assignment${byStatus('Pending') === 1 ? '' : 's'} pending submission`, detail: 'Remind the class before the deadline', to: 'Smart Announcement Generator' });
    if (weakest.length) queue.push({ key: 'weak', level: 'mid', label: `Weakest subject: ${weakest[0].name} (${weakest[0].progress}%)`, detail: 'Announce a focused revision slot', to: 'Smart Announcement Generator' });
    if (!polls.length) queue.push({ key: 'poll', level: 'low', label: 'No active poll', detail: 'Run a quick class pulse check', to: 'Class Analytics' });
    if (tickets.length) queue.push({ key: 'tickets', level: 'mid', label: `${tickets.length} doubt ticket${tickets.length === 1 ? '' : 's'} open`, detail: 'Route to the concerned faculty', to: 'AI Class Command Center' });
    if (!queue.length) queue.push({ key: 'calm', level: 'ok', label: 'No outstanding class action', detail: 'Nothing in the queue from live records', to: 'AI Class Command Center' });

    return {
      attendance, cohort, present, attendancePct,
      subjects, avgProgress, weakest,
      allAssignments, byStatus, submissions, submissionRate,
      issues, openIssues, anonymousIssues, polls, schedules, tickets, recentAnnouncements,
      roster, queue,
    };
  }, [serverData, crLive]);

  const crPersist = async (patch) => {
    setCrEvents((prev) => (Array.isArray(patch.events) ? patch.events : prev));
    try {
      await api(`/api/student-tools/${encodeURIComponent(CR_V16.storeKey)}`, {
        method: 'POST',
        body: JSON.stringify({ role: 'CR', state: { ...(Array.isArray(patch.events) ? { events: patch.events } : {}), ...patch } }),
      });
    } catch (e) { console.warn('CR module state sync failed:', e.message); }
  };

  const crAsk = async (key, prompt) => {
    setCrBusy(key);
    setCrOut('');
    try {
      const r = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ role: 'CR', message: prompt }) });
      const text = r?.reply || r?.message || r?.text || '';
      setCrOut(text);
      return text;
    } catch (e) { setCrOut(`AI service unavailable: ${e.message}`); return ''; }
    finally { setCrBusy(''); }
  };

  useEffect(() => {
    if (role !== 'CR') return;
    (async () => {
      try {
        const r = await api(`/api/student-tools/${encodeURIComponent(CR_V16.storeKey)}`);
        const s = r?.state;
        if (s && Array.isArray(s.events)) setCrEvents(s.events);
      } catch (e) { console.warn('CR event store load skipped:', e.message); }
      // The CR dashboard payload carries neither subjects nor schedules.
      const [sched, subj] = await Promise.all([
        api('/api/schedules').catch(() => null),
        api('/api/student-dashboard/subjects').catch(() => null),
      ]);
      setCrLive({
        schedules: sched?.schedules || [],
        subjects: subj?.subjects || [],
      });
    })();
  }, [role]);
  if (!loggedIn) {
    return (
      <div className="login-page">
        <div className="login-hero">
          <div className="login-hero-inner">
            <h1 className="login-hero-title"><span className="campus">Campus</span><span className="lms">LMS</span></h1>
            <p className="login-hero-college">Government Engineering College Madhubani</p>
            <p className="login-hero-university">Bihar Engineering University</p>
          </div>
          <div className="login-hero-fade" />
        </div>
        <div className="login-cards">
          {roleOptions.map((item) => <form key={item.id} className={role === item.id ? `glass-card ${item.tone} selected` : `glass-card ${item.tone}`} onSubmit={(e) => { e.preventDefault(); login(item.id); }}>
            <button type="button" className="glass-pick" onClick={() => setRole(item.id)} aria-label={`Select ${item.id} login`}>
              <span className="glass-icon">{item.icon}</span>
              <span className="glass-head"><b>{item.id}</b><small>{item.detail}</small></span>
            </button>
            {item.id === "Faculty" && <select className="login-select" value={facultyId} onChange={e => setFacultyId(e.target.value)} aria-label="Faculty account">{facultyDirectory.map(f => <option key={f.id} value={f.id}>{f.name} • {f.department}</option>)}</select>}
            {item.id !== "Faculty" && <span className="login-select-spacer" aria-hidden="true" />}
            <label>College ID</label>
            <input placeholder="Enter your college ID" defaultValue={item.id === "Faculty" ? facultyId : item.id === "CR" ? "CR-CSE-01" : "CSE26-001"} />
            <label>Password</label>
            <input type="password" placeholder="Enter password" defaultValue="123456" />
            <div className="glass-row">
              <label className="glass-check"><input type="checkbox" />Remember Me</label>
              <button type="button" className="glass-link">Forgot Password?</button>
            </div>
            <button className="login-button" type="submit">Sign in as {item.id} →</button>
          </form>)}
        </div>
        <div className="login-cards-footer">
          <div className="login-tagline">Notes, PYQs, lectures, assignments, mentors and AI-powered academic support — designed around your semester.</div>
          <div className="demo-note"><span>●</span> Demo mode enabled for hackathon</div>
        </div>
      </div>
    );
  }

  const openSubject = (subject) => { setSelectedSubject(subject); setActive("Resources"); };

  const renderDashboard = () => {
    const liveSubjects = serverData?.subjects || subjects;
    const liveAssignments = serverData?.assignments || assignments;
    const liveSchedules = serverData?.schedules || [];
    return (
      <div className="student-home">
        <div className="student-welcome">
          <div>
            <span className="eyebrow">MY LEARNING • CSE (IoT) • SEMESTER I</span>
            <h1>Good morning, Satya 👋</h1>
            <p>Everything you need for today’s classes, practice and revision — organised in one place.</p>
          </div>
          <div className="semester-chip"><b>2026–27</b><span>GEC Madhubani</span></div>
        </div>

        <div className="student-stat-row">
          <button onClick={() => openDashboardFeature('My Subjects')}><span>📚</span><div><small>Subjects</small><b>{serverData?.stats?.subjects ?? liveSubjects.length}</b><em>Semester I</em></div></button>
          <button onClick={() => go('Assignments')}><span>📝</span><div><small>Pending work</small><b>{serverData?.stats?.pendingAssignments ?? 0}</b><em>Assignments</em></div></button>
          <button onClick={() => openDashboardFeature('Learning Progress')}><span>📈</span><div><small>Progress</small><b>{serverData?.stats?.progress ?? 0}%</b><em>Overall learning</em></div></button>
          <button onClick={() => openDashboardFeature('Upcoming Exams')}><span>🗓</span><div><small>Upcoming</small><b>{serverData?.stats?.upcomingExams ?? 0}</b><em>Exams</em></div></button>
        </div>

        <section className="study-hub-section">
          <div className="hub-heading"><div><span className="eyebrow">STUDY HUB</span><h2>Learn → Practice → Test</h2><p>Keep every academic activity together instead of searching through separate features.</p></div><button onClick={() => go('Learning Path')}>Open Learning Path →</button></div>
          <div className="study-hub-grid">
            <button className="hub-card primary" onClick={() => go('Subjects')}><span>📚</span><div><b>My Subjects</b><small>Open your six Semester-I subjects and continue learning.</small></div><i>→</i></button>
            <button className="hub-card" onClick={() => { go('Syllabus'); loadSyllabus(); }}><span>🗂</span><div><b>Syllabus</b><small>BEU curriculum → units → topics → your faculty.</small></div><i>→</i></button>
            <button className="hub-card" onClick={() => go('Resources')}><span>📖</span><div><b>Resource Vault</b><small>Notes, PPTs, lectures and PYQs by subject and module.</small></div><i>→</i></button>
            <button className="hub-card" onClick={() => go('Question Practice')}><span>✍️</span><div><b>Question Practice</b><small>Topic-wise practice with answers, explanations and progress.</small></div><i>→</i></button>
            <button className="hub-card" onClick={() => go('Mock Tests')}><span>📝</span><div><b>Tests & Mocks</b><small>Timed practice and exam-style assessment.</small></div><i>→</i></button>
            <button className="hub-card" onClick={() => go('Assignments')}><span>📌</span><div><b>Assignments</b><small>Deadlines, submissions, feedback and grades.</small></div><i>→</i></button>
          </div>
        </section>

        <section className="smart-tools-section">
          <div className="hub-heading smart-tools-heading"><div><span className="eyebrow">PERSONAL STUDY TOOLS</span><h2>Plan → Prepare → Perform</h2><p>Your academic tools are grouped here so you can move from daily planning to exam revision without searching through the dashboard.</p></div><span className="smart-tools-status">● Synced with your academic data</span></div>
          <div className="smart-tools-grid">
            <button className="smart-tool-card twin" onClick={()=>openStudentTool('Academic Twin')}><span>🧠</span><div><b>Academic Twin</b><small>See strengths, weak subjects and your next focus.</small></div><em>{smartToolsData?.twin?.weakest?.progress ?? '—'}% weakest</em></button>
            <button className="smart-tool-card readiness" onClick={()=>openStudentTool('Exam Readiness')}><span>◎</span><div><b>Exam Readiness</b><small>Check preparation level and get targeted revision actions.</small></div><em>{smartToolsData?.readiness?.score ?? '—'}% ready</em></button>
            <button className="smart-tool-card timetable" onClick={()=>openStudentTool('My Timetable')}><span>🗓</span><div><b>My Timetable</b><small>Today's classes, faculty and rooms in one view.</small></div><em>{smartToolsData?.timetable?.length ?? liveSchedules.length} classes</em></button>
            <button className="smart-tool-card rescue" onClick={()=>openStudentTool('30-Min Rescue')}><span>⏱</span><div><b>30-Min Rescue</b><small>When time is short, get a focused 30-minute recovery plan.</small></div><em>Start focused</em></button>
            <button className="smart-tool-card viva" onClick={()=>openStudentTool('AI Viva Simulator')}><span>🎙</span><div><b>AI Viva Simulator</b><small>Practice oral questions and receive instant feedback.</small></div><em>5 questions</em></button>
            <button className="smart-tool-card mentor" onClick={()=>openStudentTool('AI Mentorship')}><span>👩🏻‍💻</span><div><b>AI Mentorship</b><small>Get a guided study session when you are stuck.</small></div><em>{smartToolsData?.mentorship?.next?.time || 'Available'}</em></button>
            <button className="smart-tool-card path" onClick={()=>openStudentTool('Learning Path')}><span>🧭</span><div><b>Learning Path</b><small>Concept → Learn → Practice → PYQ → Test.</small></div><em>{smartToolsData?.path?.next || 'Continue'}</em></button>
            <button className="smart-tool-card night" onClick={()=>openStudentTool('Exam Night Mode')}><span>☾</span><div><b>Exam Night Mode</b><small>One final-revision workspace for the night before an exam.</small></div><em>Revision kit</em></button>
            <button className="smart-tool-card revision" onClick={()=>openStudentTool('Smart Revision Hub')}><span>✦</span><div><b>Smart Revision Hub</b><small>Notes, PYQs and AI revision cards with one-click quick revision.</small></div><em>{studentToolState.cards?.length ?? 0} cards</em></button>
            <button className="smart-tool-card career" onClick={()=>openStudentTool('Placement & Career Hub')}><span>🚀</span><div><b>Placement &amp; Career Hub</b><small>Resume, internships, aptitude practice and career roadmap.</small></div><em>Careers</em></button>
          </div>
        </section>

        <section className="continue-section">
          <div className="section-topline"><div><span className="eyebrow">CONTINUE LEARNING</span><h2>Your subjects</h2></div><button onClick={() => go('Subjects')}>View all →</button></div>
          <div className="subject-progress-grid">
            {liveSubjects.slice(0, 6).map(s => <button key={s.code} className="subject-progress-card" onClick={() => openSubject(s)}><span className={`subject-tile-icon ${s.color}`}>{s.icon}</span><div><b>{s.name}</b><small>{s.faculty || 'Campus Faculty'}</small><div className="subject-bar"><i style={{width:`${s.progress || 0}%`}} /></div><em>{s.progress || 0}% complete</em></div><span className="subject-arrow">→</span></button>)}
          </div>
        </section>

        <section className="work-section">
          <div className="work-main">
            <div className="section-topline"><div><span className="eyebrow">THIS WEEK</span><h2>Deadlines & classes</h2></div><button onClick={() => go('Assignments')}>Manage work →</button></div>
            <div className="work-grid">
              <div className="clean-panel">
                <div className="panel-mini-head"><div><b>Upcoming deadlines</b><small>Never miss your next submission.</small></div><span>⏰</span></div>
                {(liveAssignments || []).slice(0,4).map((a,i)=><button className="deadline-row" key={a.id || a.title || i} onClick={() => go('Assignments')}><span className="deadline-dot">{i+1}</span><div><b>{a.title}</b><small>{a.subject} • {a.deadline}</small></div><em>{a.status || 'Open'}</em></button>)}
              </div>
              <div className="clean-panel">
                <div className="panel-mini-head"><div><b>Today’s classes</b><small>Your live academic schedule.</small></div><span>🗓</span></div>
                {liveSchedules.length ? liveSchedules.slice(0,4).map((c,i)=><div className="class-clean-row" key={c.id || i}><span>{c.time || 'Today'}</span><div><b>{c.title || 'Class'}</b><small>{c.detail || 'Semester I • CSE (IoT)'}</small></div></div>) : <div className="empty-mini">No class schedule synced yet. Check your faculty timetable for the next session.</div>}
              </div>
            </div>
          </div>
          <aside className="progress-panel">
            <span className="eyebrow">YOUR PROGRESS</span><h3>Keep your semester moving</h3><div className="progress-big"><strong>{serverData?.stats?.progress ?? 0}%</strong><span>overall</span></div><div className="progress-line"><i style={{width:`${serverData?.stats?.progress ?? 0}%`}} /></div><div className="progress-points"><span>🔥 {serverData?.stats?.streak ?? 0}-day learning streak</span><span>✓ Practice and revision are tracked</span><span>→ Next: continue your weakest topic</span></div><button onClick={() => openDashboardFeature('Academic Twin')}>View progress insights →</button>
          </aside>
        </section>

        <section className="community-home-card">
          <div className="community-home-copy"><span className="eyebrow">CAMPUS COMMUNITY</span><h2>Learn with your classmates, not alone.</h2><p>Ask doubts, share useful notes, find study partners and discuss upcoming exams with your batch.</p><div className="community-pills"><span>💬 Doubt discussions</span><span>📚 Resource sharing</span><span>👥 Study groups</span><span>📢 Class updates</span></div></div>
          <div className="community-home-action"><div><b>Student Community</b><small>60 CSE (IoT) learners</small></div><button onClick={() => { go('Community'); loadCommunity(); }}>Open Community →</button></div>
        </section>

        <section className="bottom-academic-row">
          <button onClick={() => go('Academic Records')}><span>🎓</span><div><b>Academic Records</b><small>Attendance, performance and academic history</small></div><i>→</i></button>
          <button onClick={() => go('Certificates')}><span>🏅</span><div><b>Certificates</b><small>View earned and available certificates</small></div><i>→</i></button>
          <button onClick={() => go('Help & Support')}><span>🛟</span><div><b>Help & Support</b><small>Raise a support request when you need help</small></div><i>→</i></button>
        </section>
      </div>
    );
  };

  const renderCommunity = () => {
    const allPosts = communityPosts || [];
    const commentsOf = (post) => post.comments || [];
    const likesOf = (post) => Number(post.likes || 0);
    const dayKey = (iso) => { const d = new Date(iso || ''); return Number.isNaN(d.getTime()) ? '' : d.toDateString(); };
    const today = new Date().toDateString();
    const inGroup = (post, group) => {
      if (!group) return true;
      const words = COMMUNITY_GROUPS.find(g => g.key === group)?.words || [];
      const hay = `${post.text} ${post.author} ${commentsOf(post).map(c => c.text).join(' ')}`.toLowerCase();
      return words.some(w => hay.includes(w));
    };

    const totalReplies = allPosts.reduce((n, p) => n + commentsOf(p).length, 0);
    const totalLikes = allPosts.reduce((n, p) => n + likesOf(p), 0);
    const activeToday = allPosts.filter(p => dayKey(p.createdAt) === today).length;
    const contributors = Object.values(allPosts.reduce((acc, p) => {
      const key = p.author || 'Campus Student';
      acc[key] ??= { name: key, posts: 0, replies: 0, likes: 0 };
      acc[key].posts += 1; acc[key].likes += likesOf(p);
      return acc;
    }, {})).map(c => ({ ...c, replies: allPosts.filter(p => (p.author || 'Campus Student') === c.name).reduce((n, p) => n + commentsOf(p).length, 0) }))
      .sort((a, b) => (b.posts + b.replies) - (a.posts + a.replies) || b.likes - a.likes);

    const query = communityQuery.trim().toLowerCase();
    const visible = allPosts
      .filter(p => inGroup(p, communityGroup))
      .filter(p => {
        if (communityFilter === 'mine') return (p.author || '') === communityAuthor;
        if (communityFilter === 'liked') return (p.likedBy || []).includes(COMMUNITY_USER_ID);
        if (communityFilter === 'unanswered') return commentsOf(p).length === 0;
        if (communityFilter === 'popular') return likesOf(p) > 0;
        return true;
      })
      .filter(p => !query || `${p.text} ${p.author} ${p.role} ${commentsOf(p).map(c => `${c.author} ${c.text}`).join(' ')}`.toLowerCase().includes(query));

    const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    const sorted = visible.slice().sort(
      communitySort === 'oldest' ? (a, b) => -byNewest(a, b)
        : communitySort === 'liked' ? (a, b) => likesOf(b) - likesOf(a) || byNewest(a, b)
          : communitySort === 'discussed' ? (a, b) => commentsOf(b).length - commentsOf(a).length || byNewest(a, b)
            : byNewest
    );
    const activeChips = [
      communityGroup ? ['group', 'Group', COMMUNITY_GROUPS.find(g => g.key === communityGroup)?.name] : null,
      communityFilter !== 'all' ? ['filter', 'Filter', { mine: 'My posts', liked: 'Appreciated by me', unanswered: 'No replies yet', popular: 'Appreciated' }[communityFilter]] : null,
      query ? ['query', 'Search', communityQuery.trim()] : null,
    ].filter(Boolean);
    const resetCommunityView = () => { setCommunityGroup(''); setCommunityFilter('all'); setCommunityQuery(''); };

    return <div className="community-page">
      <header className="community-hero">
        <span className="community-hero-glow" aria-hidden="true"></span>
        <span className="community-hero-mark" aria-hidden="true">💬</span>
        <div className="community-hero-text">
          <div className="community-eyebrow">Campus Community</div>
          <h1>Student Community</h1>
          <p>One place for CSE (IoT) students to ask doubts, share resources, find study partners and stay updated on campus.</p>
        </div>
        <div className="community-hero-stats">
          <div><b>{COMMUNITY_MEMBERS}</b><span>Members</span></div>
          <div><b>{allPosts.length}</b><span>Discussions</span></div>
          <div><b>{totalReplies}</b><span>Replies</span></div>
          <div><b>{totalLikes}</b><span>Appreciations</span></div>
        </div>
        <button className="community-refresh" onClick={loadCommunity}>↻ Refresh feed</button>
      </header>

      <div className="community-layout">
        <aside className="community-rail">
          <section className="panel community-card community-compose">
            <div className="community-card-head"><div><h2>Start a discussion</h2><p>Ask a doubt, share a resource or help a classmate.</p></div><span className="community-card-mark">✎</span></div>
            <div className="community-topic-row">
              {COMMUNITY_STARTERS.map(s => <button key={s.key} onClick={() => applyCommunityStarter(s)}><span aria-hidden="true">{s.icon}</span>{s.label}</button>)}
            </div>
            <textarea className="full-input community-textarea" rows="4" value={communityText} onChange={e => setCommunityText(e.target.value)} placeholder={`Share something with your ${COMMUNITY_MEMBERS}-member batch…`} aria-label="Write a discussion"></textarea>
            <div className="community-compose-foot">
              <small>{communityText.trim() ? `${communityText.trim().length} characters` : 'Posting as ' + communityAuthor}</small>
              <button className="solid-button community-post-button" onClick={publishCommunityPost} disabled={communityPosting || !communityText.trim()}>{communityPosting ? 'Publishing…' : 'Publish to batch →'}</button>
            </div>
          </section>

          <section className="panel community-card community-groups">
            <div className="community-card-head"><div><h2>Study spaces</h2><p>Filter the feed by the group you want to see.</p></div></div>
            <div className="study-group-grid">
              {COMMUNITY_GROUPS.map(g => {
                const posts = allPosts.filter(p => inGroup(p, g.key)).length;
                const joined = communityJoined.includes(g.key);
                return <div className={`study-group-card ${communityGroup === g.key ? 'is-active' : ''}`} key={g.key}>
                  <button className="study-group-main" onClick={() => toggleCommunityGroup(g.key)} aria-pressed={communityGroup === g.key}>
                    <span className="study-group-icon" aria-hidden="true">{g.icon}</span>
                    <b>{g.name}</b>
                    <small>{g.focus} • {g.members + (joined ? 1 : 0)} members</small>
                    <em>{posts} {posts === 1 ? 'post' : 'posts'}</em>
                  </button>
                  <button className={`study-group-join ${joined ? 'is-joined' : ''}`} onClick={() => toggleCommunityJoin(g.key)} aria-pressed={joined}>{joined ? 'Joined ✓' : 'Join'}</button>
                </div>;
              })}
            </div>
          </section>

          <section className="panel community-card community-notices">
            <div className="community-card-head"><div><h2>Announcements</h2><p>Latest class notices from the backend.</p></div></div>
            {(serverData?.announcements || []).length
              ? (serverData.announcements || []).slice(0, 4).map(a => <article className="community-notice" key={a.id}><span className="community-notice-dot" aria-hidden="true"></span><div><b>{a.title}</b>{a.body && <p>{a.body}</p>}<small>{relativeTime(a.createdAt) || a.role}</small></div></article>)
              : <div className="community-note">No announcements posted yet. Your class rep can publish one from the CR dashboard.</div>}
          </section>
        </aside>

        <main className="community-main">
          <section className="panel community-card community-feed">
            <div className="community-card-head">
              <div><h2>Latest discussions</h2><p>Recent conversations from your campus.</p></div>
              <span className="live-feed">● Live</span>
            </div>

            <div className="community-toolbar">
              <div className="community-search">
                <span aria-hidden="true">⌕</span>
                <input value={communityQuery} onChange={e => setCommunityQuery(e.target.value)} placeholder="Search posts, replies and people…" aria-label="Search the community" />
                {communityQuery && <button onClick={() => setCommunityQuery('')} aria-label="Clear search">✕</button>}
              </div>
              <label className="community-sort">
                <span>Sort</span>
                <select value={communitySort} onChange={e => setCommunitySort(e.target.value)} aria-label="Sort discussions">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="liked">Most appreciated</option>
                  <option value="discussed">Most discussed</option>
                </select>
                <i aria-hidden="true">⌄</i>
              </label>
            </div>

            <div className="community-filters">
              {[['all', 'All posts'], ['mine', 'My posts'], ['popular', 'Appreciated'], ['unanswered', 'No replies yet'], ['liked', 'Appreciated by me']].map(([k, label]) => (
                <button key={k} className={communityFilter === k ? 'is-on' : ''} onClick={() => setCommunityFilter(k)} aria-pressed={communityFilter === k}>{label}</button>
              ))}
            </div>

            {activeChips.length > 0 && <div className="community-chips">
              {activeChips.map(([key, label, value]) => <button key={key} className="community-chip" onClick={() => (key === 'query' ? setCommunityQuery('') : key === 'group' ? setCommunityGroup('') : setCommunityFilter('all'))}><span>{label}</span>{value}<i aria-hidden="true">✕</i></button>)}
              <button className="community-chips-clear" onClick={resetCommunityView}>Reset view</button>
            </div>}

            <div className="community-posts">
              {sorted.length ? sorted.map(post => {
                const replies = commentsOf(post);
                const liked = (post.likedBy || []).includes(COMMUNITY_USER_ID);
                const expanded = !!communityOpen[post.id];
                const shown = expanded ? replies : replies.slice(-2);
                return <article className="community-post" key={post.id}>
                  <div className={`community-avatar role-${(post.role || 'student').toLowerCase()}`}>{String(post.author || "S").slice(0, 1)}</div>
                  <div className="community-post-body">
                    <div className="post-meta">
                      <strong>{post.author}</strong>
                      <span className="community-role">{post.role}</span>
                      <small>{relativeTime(post.createdAt) || new Date(post.createdAt).toLocaleString()}</small>
                    </div>
                    <p className="community-post-text">{post.text}</p>
                    <div className="post-actions">
                      <button className={liked ? 'is-liked' : ''} onClick={() => toggleCommunityLike(post)} aria-pressed={liked} aria-label={`${liked ? 'Remove appreciation' : 'Appreciate'} this post`}>♥ {likesOf(post)}</button>
                      <button className={expanded ? 'is-active' : ''} onClick={() => setCommunityOpen(o => ({ ...o, [post.id]: !expanded }))} aria-expanded={expanded}>💬 {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>
                      {replies.length > 2 && <button className="post-more" onClick={() => setCommunityOpen(o => ({ ...o, [post.id]: !expanded }))}>{expanded ? 'Hide replies' : `View all ${replies.length} replies`}</button>}
                    </div>

                    {shown.length > 0 && <div className="community-replies">
                      {shown.map(c => <div className="community-comment" key={c.id}>
                        <div className={`community-avatar mini role-${(c.role || 'student').toLowerCase()}`}>{String(c.author || "S").slice(0, 1)}</div>
                        <div className="community-comment-body"><b>{c.author}</b><span>{c.text}</span><small>{relativeTime(c.createdAt) || new Date(c.createdAt).toLocaleString()}</small></div>
                      </div>)}
                    </div>}

                    {expanded && <form className="community-reply-form" onSubmit={e => { e.preventDefault(); submitCommunityReply(post); }}>
                      <textarea
                        rows={2}
                        value={communityDrafts[post.id] || ''}
                        onChange={e => setCommunityDrafts(d => ({ ...d, [post.id]: e.target.value }))}
                        placeholder={`Reply to ${post.author}…`}
                        aria-label={`Reply to ${post.author}`}
                      />
                      <div className="community-reply-actions">
                        <small>{communityDrafts[post.id]?.trim() ? `${communityDrafts[post.id].trim().length} characters` : 'Be kind and specific'}</small>
                        <button type="submit" disabled={!communityDrafts[post.id]?.trim() || !!communityBusy[post.id]}>{communityBusy[post.id] ? 'Posting…' : 'Post reply'}</button>
                      </div>
                    </form>}
                  </div>
                </article>;
              }) : <div className="empty-state">{allPosts.length ? 'No discussions match this view. Try resetting the filters.' : 'No discussions yet. Start the first conversation for your batch.'}</div>}
            </div>
          </section>
        </main>

        <aside className="community-insights">
          <section className="panel community-card community-insight-card">
            <div className="community-card-head"><div><h2>Member insights</h2><p>Live activity across the batch.</p></div></div>
            <div className="community-insight-grid">
              <div><b>{activeToday}</b><span>Active today</span></div>
              <div><b>{allPosts.filter(p => (p.author || '') === communityAuthor).length}</b><span>Your posts</span></div>
              <div><b>{allPosts.filter(p => (p.likedBy || []).includes(COMMUNITY_USER_ID)).length}</b><span>Appreciated by you</span></div>
              <div><b>{communityJoined.length}</b><span>Groups joined</span></div>
            </div>
          </section>

          <section className="panel community-card community-contributors">
            <div className="community-card-head"><div><h2>Top contributors</h2><p>Ranked by posts and replies.</p></div></div>
            {contributors.length
              ? contributors.slice(0, 5).map((c, i) => <div className="community-contributor" key={c.name}>
                <span className="community-rank">{i + 1}</span>
                <div className={`community-avatar mini role-${i === 0 ? 'student' : 'student'}`}>{c.name.slice(0, 1)}</div>
                <div className="community-contributor-info"><b>{c.name}</b><small>{c.posts} {c.posts === 1 ? 'post' : 'posts'} • {c.replies} {c.replies === 1 ? 'reply' : 'replies'} • ♥ {c.likes}</small></div>
              </div>)
              : <div className="community-note">No activity yet. Be the first to post.</div>}
          </section>

          <section className="panel community-card community-guidelines">
            <div className="community-card-head"><div><h2>Community guidelines</h2><p>Keep the batch useful and safe.</p></div></div>
            <ul>
              <li>Ask one clear question per post so replies stay on point.</li>
              <li>Share resources you actually used, with the subject and module.</li>
              <li>No personal attacks, no spam, no forwarded rumour without a source.</li>
              <li>Appreciate a reply that actually helped you.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>;
  };


  const renderSyllabus = () => {
    const configured = syllabusData?.configuredCourses || [];
    const official = syllabusData?.officialCurriculum || [];
    const open = syllabusOpenCourse;
    return <div className="syllabus-page">
      <div className="page-title"><div><div className="eyebrow">BEU ACADEMIC CURRICULUM</div><h1>Semester I Syllabus</h1><p>B.Tech Computer Science & Engineering (IoT) • Government Engineering College Madhubani • 2026–27</p></div><div className="workspace-actions"><button className="secondary-button" onClick={()=>window.open(syllabusData?.officialUrl,'_blank')}>Official BEU Syllabus ↗</button><button className="secondary-button" onClick={()=>window.open(syllabusData?.regulationUrl,'_blank')}>BEU Regulations ↗</button></div></div>
      <div className="syllabus-banner"><div><strong>Government Engineering College Madhubani</strong><span>B.Tech CSE (IoT) • Bihar Engineering University, Patna</span></div><b>SESSION 2026–27</b></div>
      <div className="syllabus-grid">
        <section className="panel"><div className="panel-heading"><div><h2>Your Semester I Courses</h2><p>Faculty mapping supplied for this prototype. Click a course to open its working topic outline and practice questions.</p></div><button className="secondary-button" onClick={()=>{go('Question Practice');loadPracticeQuestions(practiceSubject)}}>Practice Questions</button></div>{configured.map(c=><div className={`syllabus-row clickable ${open===c.code?'selected':''}`} key={c.code} onClick={()=>setSyllabusOpenCourse(open===c.code?null:c.code)}><div className="syllabus-code">{c.code}</div><div><strong>{c.name}</strong><span>Faculty: {c.faculty} • {c.status}</span>{open===c.code&&<div className="syllabus-units">{(c.units||[]).map((u,i)=><div key={u}><b>Unit {i+1}</b><span>{u}</span></div>)}</div>}</div><em>{c.credits} cr</em></div>)}</section>
        <section className="panel"><div className="panel-heading"><div><h2>BEU 2026–27 Curriculum Reference</h2><p>Course titles/credits shown here are the university reference set. Always use the linked BEU PDF for the authoritative detailed syllabus.</p></div></div>{official.map((c,i)=><div className="syllabus-row" key={c.name}><div className="syllabus-code">{String(i+1).padStart(2,'0')}</div><div><strong>{c.name}</strong><span>{c.source || 'BEU 2026 curriculum portal'}</span></div><em>{c.credits} cr</em></div>)}<div className="syllabus-note">BEU's current 2026–27 regulations explicitly list CSE (IoT) as a B.Tech discipline. The detailed branch syllabus is maintained on BEU's official B.Tech syllabus portal.</div></section>
      </div>
      <section className="panel syllabus-rules"><div className="panel-heading"><div><h2>Current BEU Academic Rules</h2><p>Useful rules for your 2026–27 first-year workflow.</p></div></div><div className="rules-grid"><div><b>{syllabusData?.officialRules?.attendance || '75%'}</b><span>Attendance requirement</span></div><div><b>{syllabusData?.officialRules?.theory || '30 + 70'}</b><span>Theory assessment</span></div><div><b>{syllabusData?.officialRules?.practical || '20 + 30'}</b><span>Practical/sessionals</span></div><div><b>{syllabusData?.officialRules?.theoryPass || '35% overall'}</b><span>Theory passing rule</span></div></div></section>
      <div className="syllabus-source"><b>Official sources:</b> Bihar Engineering University B.Tech syllabus portal and BEU UG Regulation effective from Academic Session 2026–27 onward.</div>
    </div>;
  };

  const renderQuestionPractice = () => {
    const q = practiceQuestions[practiceIndex];
    return <div className="tool-page question-practice-page"><div className="page-title"><div><div className="eyebrow">SEMESTER I • CSE (IoT)</div><h1>Question Practice</h1><p>BEU-aligned practice questions for your actual Semester I subjects. Attempts and accuracy are saved in the backend.</p></div><div className="practice-score"><b>{practiceStats.accuracy || 0}%</b><span>accuracy • {practiceStats.correct || 0}/{practiceStats.total || 0}</span></div></div>
      <div className="practice-toolbar"><label>Subject<select value={practiceSubject} onChange={e=>{setPracticeSubject(e.target.value);loadPracticeQuestions(e.target.value)}}>{['Introduction to AI','Programming for Problem Solving (PPS)','Engineering Physics','Basic Electrical & Electronics Engineering (BEEE)','Engineering Mathematics-I','Universal Human Values'].map(x=><option key={x}>{x}</option>)}</select></label><button className="secondary-button" onClick={()=>loadPracticeQuestions(practiceSubject)}>Refresh Set</button></div>
      {practiceLoading ? <div className="panel"><div className="empty-state">Loading questions from the backend…</div></div> : !q ? <div className="panel"><div className="empty-state">No questions available for this subject.</div></div> : <div className="practice-card"><div className="practice-meta"><span>{q.unit}</span><b>Question {practiceIndex+1} of {practiceQuestions.length}</b></div><h2>{q.question}</h2><div className="practice-options">{q.options.map((option,i)=><button key={option} disabled={!!practiceFeedback} className={`${practiceSelected===i?'selected':''} ${practiceFeedback && i===practiceFeedback.answer?'correct':''} ${practiceFeedback && practiceSelected===i && !practiceFeedback.correct?'wrong':''}`} onClick={()=>setPracticeSelected(i)}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>{practiceFeedback&&<div className={`practice-feedback ${practiceFeedback.correct?'good':'bad'}`}><strong>{practiceFeedback.correct?'✓ Correct':'✕ Not correct'}</strong><p>{practiceFeedback.explanation}</p><small>Answer: {String.fromCharCode(65+practiceFeedback.answer)}</small></div>}<div className="practice-actions">{!practiceFeedback?<button className="solid-button" onClick={submitPracticeAnswer}>Submit Answer</button>:<button className="solid-button" onClick={nextPracticeQuestion}>Next Question →</button>}<button className="secondary-button" onClick={()=>{setPracticeSelected(null);setPracticeFeedback(null)}}>Reset</button></div></div>}
      <div className="panel practice-note"><b>Important:</b> This section uses a curated BEU-aligned Semester I engineering practice bank. It is not labelled as an official BEU previous-year question paper unless an official paper is available and verified.</div>
    </div>;
  };

  const renderAcademicRecords = () => <div className="tool-page"><div className="page-title"><div><div className="eyebrow">ACADEMIC RECORDS</div><h1>My Academic Record</h1><p>Student identity and academic profile loaded from the CampusLMS backend.</p></div><button className="secondary-button" onClick={loadStudentRecord}>Refresh</button></div><div className="syllabus-grid"><section className="panel"><div className="panel-heading"><div><h2>Student Profile</h2><p>Current registration details</p></div></div><div className="record-grid"><div><span>Student ID</span><b>{studentRecord?.studentId}</b></div><div><span>Name</span><b>{studentRecord?.name}</b></div><div><span>Programme</span><b>{studentRecord?.programme}</b></div><div><span>Semester</span><b>{studentRecord?.semester}</b></div><div><span>Session</span><b>{studentRecord?.session}</b></div><div><span>Status</span><b>{studentRecord?.enrollmentStatus}</b></div></div></section><section className="panel"><div className="panel-heading"><div><h2>Attendance Snapshot</h2><p>Current backend attendance record</p></div></div><div className="attendance-big"><strong>{studentRecord?.attendance ? Math.round(studentRecord.attendance.present*100/studentRecord.attendance.total) : 0}%</strong><span>{studentRecord?.attendance?.present || 0} present out of {studentRecord?.attendance?.total || 0}</span></div></section></div></div>;

  const renderCertificates = () => <div className="tool-page"><div className="page-title"><div><div className="eyebrow">DOCUMENTS</div><h1>Certificates</h1><p>Certificate records available for this student profile.</p></div><button className="secondary-button" onClick={loadCertificates}>Refresh</button></div><div className="panel"><div className="workspace-list">{certificates.length?certificates.map(c=><div key={c.id}><b>{c.title}</b><span>{c.status} • Issued {c.issuedOn}</span><button className="secondary-button" onClick={()=>{const text=`CampusLMS Certificate Record\n\n${c.title}\nStudent: Satya Prakash\nID: CSE26-001\nStatus: ${c.status}\nIssued: ${c.issuedOn}`;const blob=new Blob([text],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${c.id}.txt`;a.click();URL.revokeObjectURL(url);}}>Download Record</button></div>):<div className="empty-state">No certificate records are available yet.</div>}</div></div></div>;

  const renderSupport = () => <div className="tool-page"><div className="page-title"><div><div className="eyebrow">STUDENT SUPPORT</div><h1>Help & Support</h1><p>Raise a trackable academic support ticket and follow its status.</p></div></div><div className="panel"><input className="workspace-answer" id="support-title" placeholder="What do you need help with?"/><textarea className="workspace-answer" id="support-desc" rows="5" placeholder="Describe the issue or doubt"></textarea><button className="solid-button" onClick={async()=>{const title=document.getElementById('support-title')?.value?.trim();const description=document.getElementById('support-desc')?.value?.trim();if(!title)return showToast('Enter a support title.');try{const r=await api('/api/tickets',{method:'POST',body:JSON.stringify({title,description,raisedBy:'CSE26-001',role:'Student'})});showToast(`Support ticket #${r.ticket.id} created.`);document.getElementById('support-title').value='';document.getElementById('support-desc').value='';refreshDashboard();}catch(e){showToast(e.message)}}}>Create Support Ticket</button></div><div className="panel"><div className="panel-heading"><div><h2>My Recent Tickets</h2></div><button className="secondary-button" onClick={refreshDashboard}>Refresh</button></div><div className="workspace-list">{(serverData?.tickets||[]).filter(t=>t.raisedBy==='CSE26-001').map(t=><div key={t.id}><b>#{t.id} • {t.status}</b><span>{t.title} • {t.description}</span></div>)}</div></div></div>;

  /* Changing a filter level clears the levels below it so the cascade can never
     end up in an impossible combination. The Subject level also drives
     `selectedSubject`, which is what the subject tiles on the dashboard set. */
  const setVaultLevel = (key, value) => {
    const patch = { [key]: value };
    for (const deeper of VAULT_ORDER.slice(VAULT_ORDER.indexOf(key) + 1, VAULT_ORDER.indexOf('module') + 1)) patch[deeper] = '';
    if (key === 'subject') setSelectedSubject(value ? (subjects.find(s => s.name === value) || { name: value }) : null);
    setVaultFilter(v => ({ ...v, ...patch }));
  };

  const clearVaultFilters = () => {
    setVaultFilter({ department: '', semester: '', subject: '', module: '', type: '' });
    setSelectedSubject(null);
    setSearch('');
  };

  const renderResources = () => {
    const source = vaultData?.resources || serverData?.resources || filteredResources || [];
    const uniq = (list) => Array.from(new Set(list.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
    /* Each dropdown only offers values that exist beneath the levels above it. */
    const keep = (key) => (r) => !vaultFilter[key] || r[key] === vaultFilter[key];
    const departmentOptions = uniq(source.map(r => r.department));
    const semesterOptions = uniq(source.filter(keep('department')).map(r => r.semester));
    const subjectOptions = uniq(source.filter(keep('department')).filter(keep('semester')).map(r => r.subject));
    const moduleOptions = uniq(source.filter(keep('department')).filter(keep('semester')).filter(keep('subject')).map(r => r.module));
    const typeOptions = uniq(source.filter(keep('department')).filter(keep('semester')).filter(keep('subject')).map(r => r.type));

    const query = search.trim().toLowerCase();
    const vaultResources = source
      .filter(keep('department')).filter(keep('semester')).filter(keep('subject')).filter(keep('module')).filter(keep('type'))
      /* Subject tiles on the dashboard still drive `selectedSubject` directly. */
      .filter(r => !selectedSubject || r.subject === selectedSubject.name)
      .filter(r => !query || `${r.title} ${r.type} ${r.subject} ${r.module} ${r.department} ${r.semester}`.toLowerCase().includes(query));

    const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''));
    const sorted = vaultResources.slice().sort(
      vaultSort === 'title' ? byTitle
        : vaultSort === 'type' ? ((a, b) => String(a.type || '').localeCompare(String(b.type || '')) || byTitle(a, b))
          : vaultSort === 'module' ? ((a, b) => String(a.module || '').localeCompare(String(b.module || '')) || byTitle(a, b))
            : ((a, b) => String(a.subject || '').localeCompare(String(b.subject || '')) || String(a.module || '').localeCompare(String(b.module || '')) || byTitle(a, b))
    );
    const grouped = sorted.reduce((acc, r) => { const key = `${r.subject || 'General'} • ${r.module || 'Module 1'}`; (acc[key] ??= []).push(r); return acc; }, {});

    /* Counts match the type options above, so a chip never advertises a total
       that the current scope does not have. */
    const typeCounts = source.filter(keep('department')).filter(keep('semester')).filter(keep('subject'))
      .reduce((acc, r) => { const k = r.type || 'Other'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const subjectTotal = uniq(source.map(r => r.subject)).length;
    const moduleTotal = uniq(source.map(r => `${r.subject}|${r.module}`)).length;
    const activeChips = [
      vaultFilter.department ? ['department', 'Department', vaultFilter.department] : null,
      vaultFilter.semester ? ['semester', 'Semester', vaultFilter.semester] : null,
      (vaultFilter.subject || selectedSubject) ? ['subject', 'Subject', vaultFilter.subject || selectedSubject.name] : null,
      vaultFilter.module ? ['module', 'Module', vaultFilter.module] : null,
      vaultFilter.type ? ['type', 'Type', vaultFilter.type] : null,
      query ? ['search', 'Search', search.trim()] : null,
    ].filter(Boolean);

    const field = (key, label, options, allLabel) => (
      <label className={`vault-field ${vaultFilter[key] ? 'is-set' : ''}`} key={key}>
        <span className="vault-field-label">{label}</span>
        <span className="vault-select">
          <select value={vaultFilter[key]} onChange={e => setVaultLevel(key, e.target.value)} aria-label={label}>
            <option value="">{allLabel}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <i aria-hidden="true">⌄</i>
        </span>
      </label>
    );

    return <div className="tool-page vault-page">
      <header className="vault-hero">
        <span className="vault-hero-glow" aria-hidden="true"></span>
        <span className="vault-hero-mark" aria-hidden="true">▤</span>
        <div className="vault-hero-text">
          <div className="vault-eyebrow">Structured Resource Vault</div>
          <h1>Resource Vault</h1>
          <p>Every note, PPT, PYQ and lecture mapped to Department &gt; Semester &gt; Subject &gt; Module &gt; Resource Type.</p>
        </div>
        <div className="vault-hero-stats">
          <div><b>{source.length}</b><span>Resources</span></div>
          <div><b>{subjectTotal}</b><span>Subjects</span></div>
          <div><b>{moduleTotal}</b><span>Modules</span></div>
        </div>
        <button className="vault-refresh" onClick={() => { setSelectedSubject(null); loadVault(); }}>Refresh Vault</button>
      </header>

      <section className="vault-console" aria-label="Resource Vault filters">
        <div className="vault-console-head">
          <div><h2>Filter the vault</h2><p>Pick a level — each dropdown only lists what exists below the one above it.</p></div>
          <span className="vault-result-count"><b>{vaultResources.length}</b> of {source.length} shown</span>
        </div>

        <div className="vault-fields">
          {field('department', 'Department', departmentOptions, 'All departments')}
          {field('semester', 'Semester', semesterOptions, 'All semesters')}
          {field('subject', 'Subject', subjectOptions, 'All subjects')}
          {field('module', 'Module', moduleOptions, 'All modules')}
          {field('type', 'Resource Type', typeOptions, 'All types')}
          <label className="vault-field">
            <span className="vault-field-label">Sort by</span>
            <span className="vault-select">
              <select value={vaultSort} onChange={e => setVaultSort(e.target.value)} aria-label="Sort resources">
                <option value="hierarchy">Subject &amp; module</option>
                <option value="title">Title A–Z</option>
                <option value="type">Resource type</option>
                <option value="module">Module</option>
              </select>
              <i aria-hidden="true">⌄</i>
            </span>
          </label>
        </div>

        <div className="vault-searchbar">
          <span className="vault-searchbar-icon" aria-hidden="true">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes, PYQs, PPTs, lectures, topics..." aria-label="Search resources" />
          {search && <button className="vault-searchbar-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>}
        </div>

        <div className="vault-types" role="group" aria-label="Filter by resource type">
          {typeOptions.map(t => { const look = vaultTypeLook(t); return <button key={t} className={`vault-type tone-${look.tone} ${vaultFilter.type === t ? 'is-on' : ''}`} onClick={() => setVaultLevel('type', vaultFilter.type === t ? '' : t)} aria-pressed={vaultFilter.type === t}><span aria-hidden="true">{look.icon}</span>{t}<b>{typeCounts[t] || 0}</b></button>; })}
        </div>

        <div className="vault-chips">
          {activeChips.length
            ? activeChips.map(([key, label, value]) => <button key={key} className="vault-chip" onClick={() => (key === 'search' ? setSearch('') : setVaultLevel(key, ''))}><span>{label}</span>{value}<i aria-hidden="true">✕</i></button>)
            : <span className="vault-chips-empty">No filters applied — showing the full vault.</span>}
          {activeChips.length > 1 && <button className="vault-chips-clear" onClick={clearVaultFilters}>Clear all</button>}
        </div>
      </section>

      <div className="vault-banner">
        <div><span>Computer Science &amp; Engineering (IoT) • Semester I</span><h2>GEC Madhubani Resource Vault</h2><small>{vaultResources.length} resources mapped to the academic hierarchy.</small></div>
        <div className="vault-banner-live">Live Backend</div>
      </div>

      {Object.entries(grouped).map(([group, items]) => {
        const look = vaultTypeLook(items[0]?.type);
        return <section className="panel vault-group" key={group}>
          <div className="vault-group-head">
            <span className={`vault-group-mark tone-${look.tone}`} aria-hidden="true">{look.icon}</span>
            <div className="panel-heading">
              <div><span className="eyebrow">{items[0]?.department || 'CSE (IoT)'} / {items[0]?.semester || 'Semester I'}</span><h2>{group}</h2><p>Open the actual stored resource record. Nothing is a dead link.</p></div>
            </div>
            <span className="vault-group-count">{items.length} {items.length === 1 ? 'resource' : 'resources'}</span>
          </div>
          <div className="resource-grid vault-grid">
            {items.map((r, i) => {
              const card = vaultTypeLook(r.type);
              return <article className={`resource-card vault-card tone-${card.tone}`} key={r.id || i}>
                <div className="resource-file" aria-hidden="true">{card.icon}</div>
                <div className="resource-content">
                  <span className="resource-type">{r.type}</span>
                  <h3>{r.title}</h3>
                  <p>{r.subject} • {r.module}</p>
                  <small>{r.size} • Backend resource ID {r.id}</small>
                </div>
                <button className="open-resource" onClick={() => openResource(r)}>Open →</button>
              </article>;
            })}
          </div>
        </section>;
      })}

      {!vaultResources.length && <div className="empty-state">No resource matches this filter yet. Faculty can publish a new resource into the same hierarchy.</div>}
    </div>;
  };

  const renderAssignments = () => <div className="tool-page">
    <div className="page-title"><div><div className="eyebrow">ASSIGNMENT EVALUATION ENGINE</div><h1>Assignments</h1><p>Deadline lockout • PDF preview • submission tracking • similarity checks • faculty grading.</p></div><button className="secondary-button" onClick={refreshDashboard}>Refresh</button></div>
    <div className="assignment-list">{(serverData?.assignments || assignments).map((item,index)=>{const locked=Boolean(item.locked)||(item.deadline&&new Date(`${item.deadline}T23:59:59+05:30`).getTime()<Date.now());const mine=(item.submittedBy||[]).includes('CSE26-001');return <div className="large-assignment" key={item.id||index}><div className="large-assignment-icon">📝</div><div className="large-assignment-info"><span>{item.subject}</span><h2>{item.title}</h2><p>Deadline: <b>{item.deadline}</b> {locked?<strong> • LOCKED</strong>:<span> • Open for submission</span>}</p><small>{item.submissions?.length||0} submission(s) • Status: {item.status}</small></div><div className="assignment-action"><span className={`badge ${locked?'pending':'pending'}`}>{locked?'Locked':item.status}</span>{mine?<button className="secondary-button" onClick={()=>showToast('Your submission is already recorded in the backend.')}>Submitted ✓</button>:locked?<button className="secondary-button" disabled>Submission Locked</button>:<label className="primary-small upload-label">Preview &amp; Submit<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" hidden onChange={e=>e.target.files?.[0]&&previewAssignmentFile(item,e.target.files[0])}/></label>}</div></div>})}</div>
    {submitted&&<div className="success-message">✓ Submission saved. Faculty evaluation and similarity checks are available from the faculty dashboard.</div>}
  </div>;

  const renderFaculty = () => <><div className="page-title"><div><div className="eyebrow">FACULTY WORKSPACE</div><h1>Faculty Dashboard</h1><p>Manage resources, assignments and student submissions.</p></div></div><div className="stats-grid"><div className="stat-card"><div className="stat-icon blue-bg">👥</div><div><span>Students</span><strong>60</strong><small>Enrolled</small></div></div><div className="stat-card"><div className="stat-icon orange-bg">📝</div><div><span>Submissions</span><strong>48</strong><small>Received</small></div></div><div className="stat-card"><div className="stat-icon green-bg">✓</div><div><span>Evaluated</span><strong>36</strong><small>60% completed</small></div></div><div className="stat-card"><div className="stat-icon purple-bg">📚</div><div><span>Resources</span><strong>42</strong><small>Published</small></div></div></div><div className="panel faculty-panel"><div className="panel-heading"><div><h2>Recent Assignment Submissions</h2><p>Review and evaluate student work</p></div><button className="primary-small" onClick={() => runAction("New assignment form opened.")}>+ New Assignment</button></div>{["Rahul Kumar","Priya Singh","Aman Jha","Neha Sharma"].map(name=><div className="submission-row" key={name}><div className="avatar">{name.charAt(0)}</div><div><strong>{name}</strong><span>Programming Assignment 02 • Submitted today</span></div><button className="secondary-button" onClick={() => runAction(`Reviewing ${name}'s PDF.`)}>Review PDF</button></div>)}</div></>;

  const renderCR = () => <><div className="page-title"><div><div className="eyebrow">CLASS REPRESENTATIVE</div><h1>CR Dashboard</h1><p>Keep your class informed and connected.</p></div></div><div className="two-columns"><div className="panel"><div className="panel-heading"><div><h2>Class Announcements</h2><p>Share important updates</p></div></div><input className="full-input" placeholder="Announcement title"/><textarea className="full-input" rows="4" placeholder="Write your class announcement..." value={announcement} onChange={(e)=>setAnnouncement(e.target.value)}/><button className="login-button" onClick={()=>{if(announcement.trim()){publishAnnouncement("Class Announcement", announcement);setAnnouncement("");}}}>Publish Announcement</button>{announcements.map((a,i)=><div className="update" key={i}><div className="update-dot blue-dot">📢</div><div><strong>{a.title || a}</strong><span>Just now</span></div></div>)}</div><div className="panel"><div className="panel-heading"><div><h2>Upcoming</h2><p>Important class events</p></div></div><div className="update"><div className="update-dot blue-dot">📅</div><div><strong>Internal Assessment</strong><span>30 September</span></div></div><div className="update"><div className="update-dot orange-dot">📝</div><div><strong>Assignment submissions</strong><span>28 September</span></div></div></div></div></>;

  const renderAI = () => <div className="ai-page">
    <div className="ai-icon-large">✦</div><div className="eyebrow">CAMPUSLMS INTELLIGENCE</div><h1>AI Academic Assistant</h1><p>Ask about your subjects, resources, assignments, study plans and exams.</p>
    <div className="ai-chat">
      <div className="ai-thread">{aiMessages.map((m,i)=><div className={`ai-message ${m.role === "user" ? "user" : "bot"}`} key={i}><span className="ai-avatar">{m.role === "user" ? "SP" : "✦"}</span><div><strong>{m.role === "user" ? "You" : "CampusAI"}</strong><p>{m.text}</p>{m.data?.items && <div className="ai-data">{m.data.items.map((x,j)=><span key={j}>{x}</span>)}</div>}</div></div>)}</div>
      <div className="suggestions"><button onClick={()=>setAiInput("Show my pending assignments")}>📋 Pending assignments</button><button onClick={()=>setAiInput("Make me a 30 minute study plan")}>⏱ 30-minute plan</button><button onClick={()=>setAiInput("What should I study next?")}>🧭 What next?</button></div>
      <div className="ai-composer"><input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Ask CampusAI anything about your academics..."/><button onClick={askAI}>Send →</button></div>
    </div></div>;

  const renderStudentTool = (tool) => {
    const rescueSteps = ['Review your current weak topic','Practice 5 targeted questions','Complete a PYQ set','Take a mini test'];
    const examChecklist = ['Open AI Summary','Review important formulas','Attempt PYQ rapid test','Take quick mock test','Start a 10-minute focus session'];
    if (tool==='Academic Twin') {
      const a=studentToolState.analysis || smartToolsData?.twin || {};
      const profile=a.profile || subjects.map(s=>({name:s.name,progress:s.progress,status:s.status}));
      /* Alerts name a destination; the Twin only owns navigation when that
         destination is one of the existing student tools, otherwise it hands
         over to the shared `go` router so routing stays untouched. */
      const twinPages=['Academic Records','Assignments','Question Practice','Subjects','Help & Support'];
      const goTwinTarget=(t)=>twinPages.includes(t)?go(t):openStudentTool(t);
      /* Every panel below reads the same analysis payload plus the assignments
         and resources the dashboard already holds, so nothing here invents data. */
      const allAssignments=serverData?.assignments || assignments.map(x=>({...x,submittedBy:[]}));
      const availableResources=serverData?.resources || resources;
      const live={avg:clampPct(a.avg),attendance:clampPct(a.attendance?.percentage ?? a.attendancePct),assignmentCompletion:clampPct(a.assignmentCompletion),practiceAccuracy:clampPct(a.practiceAccuracy),consistency:clampPct(a.consistency),weakestProgress:clampPct(a.weakest?.progress)};
      const pendingAssignments=allAssignments.filter(x=>!(Array.isArray(x.submittedBy)&&x.submittedBy.includes(TWIN_ID)));
      const health=twinSubjectHealth(profile,{allAssignments,resources:availableResources,avg:live.avg});
      const trend=twinWeeklyTrend(twinFocusLog,twinRange);
      const alerts=twinRiskAlerts(a,{allAssignments,trend});
      /* A stored but empty goal list would leave the panel with no recovery
         path, so the seeded goals are re-offered instead. */
      const storedGoals=Array.isArray(studentToolState.goals)?studentToolState.goals:[];
      const goals=storedGoals.length?storedGoals:twinSeedGoals(a);
      const sim=twinSimulate({...live,totalAssignments:allAssignments.length,pendingAssignments:pendingAssignments.length},twinSim);
      const selected=health.find(x=>x.name===twinSubject) || health.slice().sort((x,y)=>x.score-y.score)[0] || null;
      const strongest=health.slice().sort((x,y)=>y.score-x.score);
      const weakest=health.slice().sort((x,y)=>x.score-y.score);
      const overdue=pendingAssignments.filter(x=>x.locked||twinDaysLeft(x.deadline)===0);
      const highAlerts=alerts.filter(x=>x.level==='high').length;
      const openGoals=goals.filter(g=>!g.done && twinGoalProgress(g,live)<g.target).length;
      /* The ranked list is the personalised synthesis: server focus plan first,
         then live risk signals, then anything the user has not yet completed. */
      const nextActions=[
        ...(a.focusPlan||[]).map((step,i)=>({id:`plan-${i}`,tone:'blue',label:step,why:'From your refreshed focus plan',run:()=>openStudentTool(i<2?'30-Min Rescue':'Learning Path')})),
        ...alerts.filter(x=>x.level!=='clear').slice(0,3).map(al=>({id:al.id,tone:al.level==='high'?'red':'amber',label:al.title,why:al.detail,run:()=>goTwinTarget(al.action)})),
        ...(overdue.length?[{id:'due',tone:'red',label:`Submit or request re-open for ${overdue[0].title}`,why:`Deadline ${overdue[0].deadline}`,run:()=>go('Assignments')}]:[]),
        ...(trend.total?[]:[{id:'log',tone:'amber',label:'Log your first focus block of the week',why:'The weekly trend is empty until you log study time',run:()=>openStudentTool('30-Min Rescue')}]),
        ...goals.filter(g=>!g.done && twinGoalProgress(g,live)<g.target).slice(0,2).map(g=>({id:g.id,tone:'violet',label:g.label,why:`${twinGoalProgress(g,live)}% of ${g.target}% target reached`,run:()=>setTwinGoalDraft({label:'',target:g.target})})),
      ].slice(0,7);
      const saveGoals=async(next)=>{try{await saveStudentTool('Academic Twin',{goals:next,updatedAt:new Date().toISOString()});showToast('Academic Twin goals saved to the backend.');}catch{setStudentToolState(v=>({...v,goals:next}));}};
      const toggleGoal=(g)=>saveGoals(goals.map(x=>x.id===g.id?{...x,done:!x.done}:x));
      return <div className="tool-page smart-tool-page">
        <div className="tool-hero twin-hero"><span className="tool-icon">🧠</span><div><div className="eyebrow">PERSONAL LEARNING PROFILE</div><h1>Academic Twin</h1><p>A living academic snapshot built from your subject progress, attendance, practice and assignment activity.</p></div><div className="twin-status"><span>●</span> Live profile</div></div>
        <div className="twin-grid">
          <div className="tool-panel twin-main"><div className="panel-kicker">AT A GLANCE</div><div className="twin-score-row"><div className="twin-score"><strong>{a.avg ?? '—'}%</strong><span>academic progress</span></div><div><b>{a.risk || 'On track'}</b><p>{a.recommendation || 'Refresh your analysis to calculate your next focus.'}</p></div></div>
            <div className="twin-metrics"><div><b>{a.attendance?.percentage ?? a.attendancePct ?? '—'}%</b><span>Attendance</span></div><div><b>{a.assignmentCompletion ?? '—'}%</b><span>Assignments</span></div><div><b>{a.practiceAccuracy ?? '—'}%</b><span>Practice accuracy</span></div><div><b>{a.consistency ?? '—'}%</b><span>Study consistency</span></div></div>
          </div>
          <div className="tool-panel twin-focus"><div className="panel-kicker">NEXT BEST ACTION</div><h3>{a.weakest?.name || 'Choose a subject'}</h3><p>{a.weakest?.progress ?? '—'}% progress • {a.weakest?.status || 'Needs focus'}</p><div className="focus-list">{(a.focusPlan||['Refresh analysis to get a personalised focus plan.']).map((x,i)=><div key={i}><span>{i+1}</span>{x}</div>)}</div></div>
        </div>

        <div className="tool-panel twin-section twin-health-panel">
          <div className="panel-kicker">SUBJECT HEALTH</div>
          <p className="twin-lede">Each subject is scored from its syllabus progress, the assignments still outstanding on it and the study material available to you.</p>
          <div className="twin-health-grid">{health.map(h=><button key={h.name} className={`twin-health-card ${selected?.name===h.name?'active':''}`} onClick={()=>setTwinSubject(h.name)}>
            <div className="twin-health-top"><span className="twin-topic">{h.code || h.name}</span><em className={`twin-band ${h.band.toLowerCase().replace(' ','-')}`}>{h.band}</em></div>
            <div className="twin-health-score"><strong>{h.score}</strong><span>health</span></div>
            <div className="twin-bar"><i style={{width:`${h.score}%`}} /></div>
            <div className="twin-health-foot"><span>{h.progress}% syllabus</span><span className={h.delta<0?'neg':'pos'}>{h.delta>0?'+':''}{h.delta} vs avg</span></div>
            {h.outstanding.length>0&&<div className="twin-health-load">{h.outstanding.length} assignment{h.outstanding.length===1?'':'s'} open{h.locked?` • ${h.locked} locked`:''}</div>}
          </button>)}</div>
          {selected&&<div className="twin-detail">
            <div className="twin-detail-head"><div><div className="panel-kicker">SUBJECT BREAKDOWN</div><h3>{selected.name}</h3></div><div className="twin-detail-actions"><button className="secondary-button" onClick={()=>{setPracticeSubject(selected.name);go('Question Practice');}}>Practise questions</button><button className="solid-button" onClick={()=>openStudentTool('30-Min Rescue')}>Start focus block</button></div></div>
            <div className="twin-detail-grid">
              <div><span>Syllabus progress</span><b>{selected.progress}%</b></div>
              <div><span>Open assignments</span><b>{selected.outstanding.length}</b></div>
              <div><span>Locked deadlines</span><b>{selected.locked}</b></div>
              <div><span>Study material</span><b>{selected.materials}</b></div>
              <div><span>Workload penalty</span><b>−{selected.loadPenalty}</b></div>
              <div><span>Material bonus</span><b>+{selected.supportBonus}</b></div>
            </div>
            {selected.next&&<p className="twin-detail-next">Next deadline — <b>{selected.next.title}</b> on {selected.next.deadline}{twinDaysLeft(selected.next.deadline)!=null&&` (${twinDaysLeft(selected.next.deadline)} day${twinDaysLeft(selected.next.deadline)===1?'':'s'} left)`}</p>}
            {selected.faculty&&<p className="twin-detail-next">Mapped faculty — <b>{selected.faculty}</b></p>}
          </div>}
        </div>

        <div className="twin-grid twin-grid-mid">
          <div className="tool-panel twin-section twin-trend-panel">
            <div className="twin-section-head"><div><div className="panel-kicker">WEEKLY PROGRESS TREND</div><h3>Logged study time</h3></div><div className="twin-range">{[7,14].map(d=><button key={d} className={twinRange===d?'active':''} onClick={()=>setTwinRange(d)}>{d}d</button>)}</div></div>
            {trend.total===0
              ? <div className="empty-state">No focus sessions logged in the last {twinRange} days. Start a Pomodoro block in 30-Min Rescue and this chart fills with your real study time.</div>
              : <><div className="twin-chart">{trend.series.map(x=><div className="twin-chart-col" key={x.key} title={`${x.minutes} min • ${x.sessions} session${x.sessions===1?'':'s'}`}><span className="twin-chart-value">{x.minutes||''}</span><i style={{height:`${Math.max(3,Math.round(x.minutes/Math.max(1,trend.best.minutes)*100))}%`}} /><em>{x.label}</em></div>)}</div>
                <div className="twin-trend-stats"><div><b>{trend.total}</b><span>minutes logged</span></div><div><b>{trend.sessions}</b><span>focus blocks</span></div><div><b>{trend.dailyAvg}</b><span>avg / day</span></div><div><b>{trend.activeDays}/{trend.days}</b><span>active days</span></div><div className={trend.change==null?'':(trend.change<0?'neg':'pos')}><b>{trend.change==null?'—':`${trend.change>0?'+':''}${trend.change}%`}</b><span>vs previous {twinRange}d</span></div></div></>}
          </div>
          <div className="tool-panel twin-section twin-alert-panel">
            <div className="panel-kicker">SMART RISK ALERTS</div>
            <div className="twin-alert-summary"><strong>{highAlerts}</strong><span>high-priority signal{highAlerts===1?'':'s'} of {alerts.length}</span></div>
            <div className="twin-alert-list">{alerts.map(al=><button key={al.id} className={`twin-alert ${al.level}`} onClick={()=>goTwinTarget(al.action)}>
              <span className="twin-alert-icon">{al.level==='high'?'!':al.level==='medium'?'▲':al.level==='low'?'•':'✓'}</span>
              <div><b>{al.title}</b><p>{al.detail}</p><em>Open {al.action} →</em></div>
            </button>)}</div>
          </div>
        </div>

        <div className="twin-grid twin-grid-mid">
          <div className="tool-panel twin-section twin-sw-panel">
            <div className="panel-kicker">STRENGTHS &amp; WEAKNESSES</div>
            <div className="twin-sw-split">
              <div><div className="twin-sw-head pos"><span>▲ Strengths</span><small>Top {Math.min(3,strongest.length)}</small></div><div className="twin-sw-list">{strongest.slice(0,3).map(x=><button key={x.name} onClick={()=>setTwinSubject(x.name)}><b>{x.name}</b><span>{x.score} health • {x.progress}% syllabus</span><i><em style={{width:`${x.score}%`}} /></i></button>)}</div></div>
              <div><div className="twin-sw-head neg"><span>▼ Needs work</span><small>Bottom {Math.min(3,weakest.length)}</small></div><div className="twin-sw-list">{weakest.slice(0,3).map(x=><button key={x.name} onClick={()=>setTwinSubject(x.name)}><b>{x.name}</b><span>{x.score} health • {x.outstanding.length} open</span><i><em style={{width:`${x.score}%`}} /></i></button>)}</div></div>
            </div>
            <div className="twin-gap"><span>Spread between strongest and weakest</span><b>{strongest[0]&&weakest[0]?`${strongest[0].score-weakest[0].score} points`:'—'}</b></div>
          </div>
          <div className="tool-panel twin-section twin-goal-panel">
            <div className="panel-kicker">GOAL TRACKER</div>
            <div className="twin-goal-head"><strong>{goals.filter(g=>g.done||twinGoalProgress(g,live)>=g.target).length}/{goals.length}</strong><span>goals met • {openGoals} open</span></div>
            <div className="twin-goal-list">{goals.map(g=>{const p=twinGoalProgress(g,live);const met=g.metric?p>=g.target:!!g.done;return <div key={g.id} className={`twin-goal ${met?'done':''}`}>
              <button className="twin-goal-check" onClick={()=>toggleGoal(g)} aria-label={`Mark ${g.label} ${g.done?'incomplete':'complete'}`}>{met?'✓':''}</button>
              <div className="twin-goal-body"><b>{g.label}</b><div className="twin-bar"><i style={{width:`${Math.min(100,p)}%`}} /></div><span>{g.metric?`${p}% of ${g.target}% target${g.done?' • marked done':''}`:'Tracked manually — tick when complete'}</span></div>
              {!g.metric&&<button className="twin-goal-remove" onClick={()=>saveGoals(goals.filter(x=>x.id!==g.id))} aria-label={`Remove ${g.label}`}>✕</button>}
            </div>;})}</div>
            <div className="twin-goal-add">
              <input value={twinGoalDraft.label} onChange={e=>setTwinGoalDraft(v=>({...v,label:e.target.value}))} placeholder="Add a goal, e.g. Revise Integration"/>
              <input className="twin-goal-target" type="number" min="1" max="100" value={twinGoalDraft.target} onChange={e=>setTwinGoalDraft(v=>({...v,target:Math.max(1,Math.min(100,Number(e.target.value)||1))}))} aria-label="Goal target percentage"/>
              <button className="solid-button" disabled={!twinGoalDraft.label.trim()} onClick={()=>{const g={id:`g-${Date.now()}`,metric:null,label:twinGoalDraft.label.trim(),target:twinGoalDraft.target,done:false};saveGoals([...goals,g]);setTwinGoalDraft({label:'',target:80});}}>Add</button>
            </div>
          </div>
        </div>

        <div className="tool-panel twin-section twin-sim-panel">
          <div className="twin-section-head"><div><div className="panel-kicker">WHAT-IF STUDY SIMULATOR</div><h3>Model your next two weeks</h3></div><div className="twin-sim-verdict">{sim.readinessDelta>=0?'+':''}{sim.readinessDelta} readiness</div></div>
          <p className="twin-lede">Adjust the levers and the projected readiness is recomputed with the same weighting the server uses for your real readiness score.</p>
          <div className="twin-sim-grid">
            <div className="twin-sim-controls">
              <label><span>Extra study hours per week <b>{twinSim.hours}h</b></span><input type="range" min="0" max="15" step="1" value={twinSim.hours} onChange={e=>setTwinSim(v=>({...v,hours:Number(e.target.value)}))}/><small>{sim.weeklyMinutes} focused minutes each week</small></label>
              <label><span>Practice questions per week <b>{twinSim.questions}</b></span><input type="range" min="0" max="60" step="5" value={twinSim.questions} onChange={e=>setTwinSim(v=>({...v,questions:Number(e.target.value)}))}/><small>{Math.round(twinSim.questions/2)} practice sets</small></label>
              <label><span>Assignments to submit <b>{twinSim.assignments}</b></span><input type="range" min="0" max={Math.max(1,pendingAssignments.length)} step="1" value={twinSim.assignments} onChange={e=>setTwinSim(v=>({...v,assignments:Number(e.target.value)}))}/><small>{sim.remaining} still open afterwards</small></label>
              <label><span>Classes to attend <b>{twinSim.classes}</b></span><input type="range" min="0" max="20" step="1" value={twinSim.classes} onChange={e=>setTwinSim(v=>({...v,classes:Number(e.target.value)}))}/><small>Keeps you clear of the 75% line</small></label>
            </div>
            <div className="twin-sim-output">
              <div className="twin-sim-readiness"><div><span>Projected readiness</span><strong>{sim.readinessNext}</strong><small>from {sim.readinessNow} today</small></div><i><em style={{width:`${sim.readinessNext}%`}} /></i></div>
              {sim.rows.map(r=><div className="twin-sim-row" key={r.key}><span>{r.label}</span><div className="twin-sim-bar"><i style={{width:`${r.now}%`}} /><em style={{width:`${r.next}%`}} /></div><b className={r.next>r.now?'pos':r.next<r.now?'neg':''}>{r.now}% → {r.next}%</b></div>)}
            </div>
          </div>
          <div className="twin-sim-actions"><button className="solid-button" onClick={()=>{const g={id:`g-sim-${Date.now()}`,metric:null,label:`Study ${twinSim.hours}h/week and clear ${twinSim.assignments} assignment${twinSim.assignments===1?'':'s'}`,target:100,done:false};saveGoals([...goals,g]);}}>Turn this plan into a goal</button><button className="secondary-button" onClick={()=>openStudentTool('Learning Path')}>Build My Next Path →</button></div>
        </div>

        <div className="twin-grid twin-grid-mid">
          <div className="tool-panel twin-section twin-nba-panel">
            <div className="panel-kicker">PERSONALISED NEXT BEST ACTIONS</div>
            <p className="twin-lede">Ranked from your focus plan, live risk signals, deadlines and unfinished goals.</p>
            <div className="twin-nba-list">{nextActions.map((x,i)=><button key={x.id} className={`twin-nba ${x.tone}`} onClick={x.run}><span>{i+1}</span><div><b>{x.label}</b><small>{x.why}</small></div><em>→</em></button>)}</div>
            {!nextActions.length&&<div className="empty-state">Nothing outstanding. Refresh your Twin to re-evaluate.</div>}
          </div>
          <div className="tool-panel twin-section twin-subject-map">
            <div className="panel-kicker">SUBJECT MAP</div>
            <div className="workspace-list">{profile.map(x=><div key={x.name}><b>{x.name}</b><span>{x.progress}% • {x.status} • {x.faculty||'Faculty mapped'}</span><i style={{width:`${x.progress}%`}} /></div>)}</div>
            <div className="workspace-actions"><button className="solid-button" onClick={async()=>{const r=await api('/api/student-dashboard/academic-twin');await saveStudentTool('Academic Twin',{analysis:r,updatedAt:new Date().toISOString()});setStudentToolState(v=>({...v,analysis:r}));showToast('Academic Twin refreshed from your latest academic data.');}}>Refresh My Twin</button><button className="secondary-button" onClick={()=>openStudentTool('Learning Path')}>Build My Next Path →</button></div>
          </div>
        </div>
      </div>;
    }
    if (tool==='Learning Path') {
      const states=studentToolState.steps || [false,false,false,false]; const labels=['Review current weak topic','Practice 5 targeted questions','Complete a PYQ set','Take a mini test']; const done=states.filter(Boolean).length;
      return <div className="tool-page"><span className="tool-icon">🧭</span><div className="eyebrow">LEARNING PATH</div><h1>Learning Path</h1><p>Concept → Learn → Practice → PYQ → Test, with progress stored in the backend.</p><div className="tool-panel"><div className="workflow-progress"><div><strong>{done}/4</strong><span>steps completed</span></div><div className="workflow-bar"><i style={{width:`${done*25}%`}}/></div></div><div className="workspace-list">{labels.map((x,i)=><button key={x} className={`workflow-step ${states[i]?'done':''} ${!states[i]&&i===done?'current':''}`} disabled={states[i]||i!==done} onClick={async()=>{await api(`/api/workflows/${i}`,{method:'PATCH',body:JSON.stringify({done:true})});setStudentToolState(v=>({...v,steps:[...(v.steps||[false,false,false,false]).map((z,j)=>j===i?true:z)]}));showToast(`Step ${i+1} completed and saved.`);}}><b>{states[i]?'✓':i+1}</b><span>{x}</span>{i===done&&!states[i]&&<em>Complete</em>}</button>)}</div>{done===4&&<div className="success-message">✓ Learning Path completed and saved.</div>}</div></div>;
    }
    if (tool==='30-Min Rescue') {
      const done = Number(studentToolState.step || 0);
      const phaseLabel = pomo.phase === 'focus' ? 'Focus' : 'Break';
      return <div className="tool-page smart-tool-page">
        <div className="tool-hero rescue-hero"><span className="tool-icon">⏱</span><div><div className="eyebrow">LIVE WORKSPACE</div><h1>30-Min Rescue</h1><p>Run a real focus block with a Pomodoro timer, then finish the four-stage rescue plan.</p></div><span className="live-chip">● {minutesToday} min today</span></div>
        <div className="rescue-layout">
          <div className="tool-panel pomo-panel">
            <div className="panel-kicker">FOCUS SESSION</div>
            <div className="pomo-ring-wrap"><div className={`pomo-ring ${pomo.phase} ${pomo.running?'running':''}`} style={{'--elapsed':`${Math.min(100, Math.round((pomoElapsed / Math.max(1, pomoTotal)) * 100))}%`}}><strong>{pomoClock}</strong><span>{phaseLabel}</span></div></div>
            <div className="pomo-controls"><button className="solid-button" onClick={()=>setPomo(v=>({...v,running:!v.running}))}>{pomo.running?'❚❚ Pause':'▶ Start focus'}</button><button className="secondary-button" onClick={()=>setPomo(v=>({...v,running:false,remaining:v.remaining}))} onDoubleClick={()=>setPomo(v=>({...v,running:false,completed:null,remaining:v.focusLength*60,phase:'focus'}))}>↺ Reset</button><button className="secondary-button" disabled={pomo.running} onClick={()=>logFocusSession(Math.max(1, Math.round((pomoTotal - pomo.remaining)/60)) || 1, 'Manual focus session')}>✓ Log session</button></div>
            <div className="pomo-lengths">{[15,25,45].map(m=><button key={m} className={pomo.focusLength===m?'active':''} disabled={pomo.running} onClick={()=>setPomo(v=>({...v,focusLength:m,remaining:m*60,phase:'focus'}))}>{m} min</button>)}</div>
            <p className="muted">Leaving this tool pauses the timer so your session is never left running unattended.</p>
          </div>
          <div className="rescue-side">
            <div className="tool-panel daily-target"><div className="panel-kicker">DAILY STUDY TARGET</div><div className="target-head"><strong>{minutesToday}</strong><span>/ {dailyTarget} min today</span></div><div className="target-bar"><i style={{width:`${targetPct}%`}} /></div><small>{targetPct>=100?'✓ Daily target reached — great work.':`${Math.max(0,dailyTarget-minutesToday)} minutes to go to hit today's target.`}</small><label className="target-input">Daily target (minutes)<input type="number" min="15" step="15" value={dailyTarget} onChange={async e=>{const v=Math.max(15,Number(e.target.value)||15);setPomo(x=>({...x}));await saveStudentTool('30-Min Rescue',{...rescueStore(studentToolState),dailyTarget:v});}}/></label></div>
            <div className="tool-panel session-log"><div className="panel-kicker">FOCUS SESSION LOG</div>{(rescueState.sessions||[]).length?<div className="workspace-list">{(rescueState.sessions||[]).map((s,i)=><div key={s.at||i}><b>{s.minutes} min</b><span>{s.label} • {new Date(s.at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>)}</div>:<div className="empty-state">No focus sessions logged yet. Start the timer or log a completed block.</div>}</div>
          </div>
        </div>
        <div className="tool-panel rescue-steps"><h2>Smart Academic Workflow</h2><p>Complete the four stages in order. Your progress remains saved after refresh.</p><div className="workflow-progress"><div><strong>{Math.min(done,4)}/4</strong><span>steps completed</span></div><div className="workflow-bar"><i style={{width:`${Math.min(done,4)*25}%`}}/></div></div><div className="workspace-list">{rescueSteps.map((x,i)=><button key={x} className={`workflow-step ${i<done?'done':''} ${i===done?'current':''}`} disabled={i!==done} onClick={async()=>{const next=i+1;await saveStudentTool('30-Min Rescue',{...rescueStore(studentToolState),step:next});showToast(`Step ${next} completed and saved.`);}}><b>{i<done?'✓':i+1}</b><span>{x}</span>{i===done&&<em>Complete</em>}</button>)}</div>{done>=4?<div className="success-message">✓ 30-Min Rescue completed. Your progress is saved.</div>:<p className="muted">Next: {rescueSteps[done]}</p>}</div>
      </div>;
    }
    if (tool==='Smart Revision Hub') {
      const cards = studentToolState.cards || [];
      const notes = resources.filter(r=>r.type==='Notes'), pyqs = resources.filter(r=>r.type==='PYQ');
      const quickRevise = async (subject) => {
        setToolBusy(true);
        try {
          const r = await api('/api/ai/chat',{method:'POST',body:JSON.stringify({role,message:`Create a fast one-page revision card for ${subject}: 5 must-know points, 3 formulas or key definitions, and 3 self-test questions.`})});
          const card = {id:`RC-${Date.now()}`,subject,body:r.reply,createdAt:new Date().toISOString()};
          await saveStudentTool('Smart Revision Hub',{cards:[card,...cards].slice(0,8)});
          showToast(`Revision card ready for ${subject}.`);
        } catch(e){ showToast(e.message); } finally { setToolBusy(false); }
      };
      return <div className="tool-page smart-tool-page">
        <div className="tool-hero revision-hero"><span className="tool-icon">✦</span><div><div className="eyebrow">ONE-CLICK REVISION</div><h1>Smart Revision Hub</h1><p>Notes, PYQs and AI revision cards in one place. Pick a subject and revise without hunting through modules.</p></div><span className="live-chip">● {cards.length} cards</span></div>
        <div className="revision-grid">
          {revisionSubjects.map(s=>{
            const hasNotes=notes.some(n=>n.subject.includes(s.code.slice(0,3))||n.subject===s.name), hasPyq=pyqs.some(p=>p.subject.includes(s.code.slice(0,3))||p.subject===s.name);
            const card = cards.find(c=>c.subject===s.name);
            return <div className="revision-card" key={s.code}><div className="revision-card-head"><b>{s.name}</b><span>{s.code}</span></div><p>{s.focus}</p><div className="revision-tags"><span className={hasNotes?'ok':''}>Notes {hasNotes?'✓':'—'}</span><span className={hasPyq?'ok':''}>PYQs {hasPyq?'✓':'—'}</span></div><div className="workspace-actions"><button className="solid-button" disabled={toolBusy} onClick={()=>quickRevise(s.name)}>{toolBusy?'Working…':'Quick Revise'}</button><button className="secondary-button" onClick={()=>{openStudentTool('AI Summary');setTimeout(()=>{},0);}}>Notes →</button></div>{card&&<div className="revision-card-body"><b>Saved card</b><p>{card.body}</p><button className="secondary-button" onClick={()=>speakText(card.body)}>🔊 Read aloud</button></div>}</div>;
          })}
        </div>
        <div className="tool-panel revision-lib"><div className="panel-kicker">NOTES & PYQS IN YOUR VAULT</div><div className="revision-lib-grid"><div><h3>Notes</h3>{notes.length?notes.map(n=><button className="deadline-row" key={n.title} onClick={()=>openStudentTool('AI Summary')}><span className="deadline-dot">📖</span><div><b>{n.title}</b><small>{n.subject} • {n.size}</small></div><em>Revise</em></button>):<div className="empty-state">No notes in your vault yet.</div>}</div><div><h3>Previous Year Questions</h3>{pyqs.length?pyqs.map(p=><button className="deadline-row" key={p.title} onClick={()=>openStudentTool('Mock Tests')}><span className="deadline-dot">✍️</span><div><b>{p.title}</b><small>{p.subject} • {p.size}</small></div><em>Practice</em></button>):<div className="empty-state">No PYQs in your vault yet.</div>}</div></div></div>
      </div>;
    }
    if (tool==='Placement & Career Hub') {
      const career = studentToolState || {};
      const resume = resumeDraft || career.resume || { name: 'Satya Prakash', email: 'satya.prakash@gec.edu.in', branch: 'B.Tech Computer Science & Engineering — Semester I', cgpa: '8.4', skills: 'C, Python, DBMS, MS Office', projects: 'No major project yet — add your first semester project.', objective: 'To secure a software engineering internship while strengthening my DSA and core engineering subjects.' };
      const interests = career.interests || [];
      const roadmap = career.roadmap || {};
      const aptitudeAttempts = career.aptitude || [];
      const q = aptitudeQuestions[aptIndex] || aptitudeQuestions[0];
      const aptitudeScore = aptitudeAttempts.length ? Math.round((aptitudeAttempts.filter(x=>x.correct).length / aptitudeAttempts.length) * 100) : 0;
      const pick = (k, v) => setResumeDraft({ ...resume, [k]: v });
      const saveResume = async () => { await saveStudentTool('Placement & Career Hub', { ...career, resume }); showToast('Resume saved to the backend.'); };
      const checkAptitude = async () => {
        if (!aptPicked) return showToast('Choose an option first.');
        const correct = aptPicked === q.answer;
        const attempt = { id: q.id, section: q.section, picked: aptPicked, correct, at: new Date().toISOString() };
        const next = [...aptitudeAttempts, attempt];
        await saveStudentTool('Placement & Career Hub', { ...career, aptitude: next });
        setAptResult({ correct, answer: q.answer });
        showToast(correct ? 'Correct — logged to your aptitude record.' : `Not quite. The answer is ${q.answer}.`);
      };
      return <div className="tool-page smart-tool-page">
        <div className="tool-hero career-hero"><span className="tool-icon">🚀</span><div><div className="eyebrow">PLACEMENT & CAREER</div><h1>Placement &amp; Career Hub</h1><p>Resume, internships, aptitude practice and a semester-by-semester career roadmap — saved in your student workspace.</p></div><span className="live-chip">● Aptitude {aptitudeScore}%</span></div>
        <div className="career-grid">
          <div className="tool-panel resume-panel">
            <div className="panel-kicker">RESUME</div>
            <label>Full name<input value={resume.name} onChange={e=>pick('name',e.target.value)} /></label>
            <label>Email<input value={resume.email} onChange={e=>pick('email',e.target.value)} /></label>
            <label>Branch &amp; semester<input value={resume.branch} onChange={e=>pick('branch',e.target.value)} /></label>
            <label>CGPA<input value={resume.cgpa} onChange={e=>pick('cgpa',e.target.value)} /></label>
            <label>Skills<input value={resume.skills} onChange={e=>pick('skills',e.target.value)} /></label>
            <label>Projects<textarea rows="3" value={resume.projects} onChange={e=>pick('projects',e.target.value)} /></label>
            <label>Objective<textarea rows="3" value={resume.objective} onChange={e=>pick('objective',e.target.value)} /></label>
            <div className="workspace-actions"><button className="solid-button" onClick={saveResume}>Save Resume</button><button className="secondary-button" disabled={toolBusy} onClick={async()=>{setToolBusy(true);try{const r=await api('/api/ai/chat',{method:'POST',body:JSON.stringify({role,message:`Improve this student resume for software engineering placements. Give 5 specific fixes, then a polished rewrite.\nName: ${resume.name}\nBranch: ${resume.branch}\nCGPA: ${resume.cgpa}\nSkills: ${resume.skills}\nProjects: ${resume.projects}\nObjective: ${resume.objective}`})});await saveStudentTool('Placement & Career Hub',{...career,resumeFeedback:r.reply});showToast('Resume feedback generated and saved.');}catch(e){showToast(e.message)}finally{setToolBusy(false)}}}>{toolBusy?'Reviewing…':'AI Resume Review'}</button></div>
            {career.resumeFeedback&&<div className="ai-result"><h3>AI Resume Feedback</h3><p>{career.resumeFeedback}</p></div>}
          </div>
          <div className="career-side">
            <div className="tool-panel"><div className="panel-kicker">INTERNSHIP OPPORTUNITIES</div><div className="workspace-list">{internshipOpportunities.map(o=>{const marked=interests.includes(o.id);return <div key={o.id}><b>{o.role} — {o.company}</b><span>{o.mode} • {o.duration} • {o.stipend} • {o.skills} • closes {o.closes}</span><button className={marked?'career-tag on':'career-tag'} onClick={async()=>{const next=marked?interests.filter(x=>x!==o.id):[...interests,o.id];await saveStudentTool('Placement & Career Hub',{...career,interests:next});showToast(marked?'Removed from your shortlist.':'Added to your internship shortlist.');}}>{marked?'✓ Shortlisted':'Shortlist'}</button></div>;})}</div></div>
            <div className="tool-panel"><div className="panel-kicker">APTITUDE PRACTICE</div><div className="apt-head"><span>{q.section}</span><b>Question {aptIndex+1} of {aptitudeQuestions.length}</b></div><p className="apt-question">{q.question}</p><div className="apt-options">{q.options.map(o=><label key={o} className={aptPicked===o?'picked':''}><input type="radio" name="apt" checked={aptPicked===o} onChange={()=>{setAptPicked(o);setAptResult(null);}} />{o}</label>)}</div><div className="workspace-actions"><button className="solid-button" onClick={checkAptitude}>Check Answer</button><button className="secondary-button" onClick={()=>{setAptIndex((aptIndex+1)%aptitudeQuestions.length);setAptPicked(null);setAptResult(null);}}>Next Question →</button></div>{aptResult&&<div className={`success-message ${aptResult.correct?'':'wrong'}`}>{aptResult.correct?'✓ Correct answer.':'✗ Correct answer: '+aptResult.answer}</div>}<small className="muted">Attempted {aptitudeAttempts.length} • Accuracy {aptitudeScore}%</small></div>
            <div className="tool-panel"><div className="panel-kicker">CAREER ROADMAP</div><div className="workspace-list">{careerStages.map(s=>{const st=roadmap[s.id]||s.status;return <button key={s.id} className={`career-stage ${st}`} onClick={async()=>{const nxt=st==='done'?'next':'done';await saveStudentTool('Placement & Career Hub',{...career,roadmap:{...roadmap,[s.id]:nxt}});showToast(`${s.title} marked as ${nxt}.`);}}><b>{s.stage}</b><span>{s.title} — {s.detail}</span><em>{st}</em></button>;})}</div></div>
          </div>
        </div>
      </div>;
    }
    if (tool==='Exam Night Mode') {
      const checked = studentToolState.checked || [];
      return <div className="tool-page"><span className="tool-icon">☾</span><div className="eyebrow">FINAL REVISION</div><h1>Exam Night Mode</h1><p>One focused revision workspace instead of separate showpiece buttons.</p><div className="tool-panel"><h2>Revision Checklist</h2>{examChecklist.map((x,i)=><label className="workflow-check" key={x}><input type="checkbox" checked={checked.includes(i)} onChange={async(e)=>{const next=e.target.checked?[...new Set([...checked,i])]:checked.filter(n=>n!==i);await saveStudentTool('Exam Night Mode',{checked:next});}}/><span>{x}</span></label>)}<div className="workspace-actions"><button className="solid-button" onClick={()=>openStudentTool('AI Summary')}>Open AI Summary</button><button className="secondary-button" onClick={()=>openStudentTool('Mock Tests')}>Open Mock Test</button></div></div></div>;
    }
    if (tool==='My Timetable') {
      const timetable = smartToolsData?.timetable || [];
      return <div className="tool-page"><span className="tool-icon">🗓</span><div className="eyebrow">SMART SCHEDULE</div><h1>My Timetable</h1><p>Your Semester-I class schedule is loaded from the CampusLMS backend.</p><div className="tool-panel"><div className="timetable-list">{timetable.length ? timetable.map((c,i)=><div className="timetable-row" key={c.id || i}><span className="timetable-time">{c.time || 'Today'}</span><div><b>{c.title}</b><small>{c.faculty || c.detail || 'CSE (IoT) • Semester I'}</small></div><em>{c.detail?.split('•').slice(-1)[0]?.trim() || 'Class'}</em></div>) : <div className="empty-state">No timetable is available yet.</div>}</div><div className="workspace-actions"><button className="solid-button" onClick={async()=>{try{const r=await api('/api/student-dashboard/timetable');setSmartToolsData(v=>({...v,timetable:r.timetable||[]}));await saveStudentTool('My Timetable',{lastSyncedAt:new Date().toISOString(),classes:r.timetable||[]});showToast('Timetable synced and saved.');}catch(e){showToast(e.message)}}}>Sync & Save Timetable</button><button className="secondary-button" onClick={()=>openStudentTool('30-Min Rescue')}>Plan Study Time →</button></div></div></div>;
    }
    if (tool==='AI Summary') return <div className="tool-page"><span className="tool-icon">✦</span><div className="eyebrow">AI STUDY TOOL</div><h1>AI Summary</h1><p>Paste notes or enter a topic. CampusAI will generate a revision-ready summary and save the session.</p><div className="tool-panel"><textarea className="workspace-answer" value={studentToolState.input || ''} onChange={e=>setStudentToolState(v=>({...v,input:e.target.value}))} rows="8" placeholder="Paste your notes or type a topic..."/><button className="solid-button" disabled={toolBusy} onClick={async()=>{const input=(studentToolState.input||'').trim();if(!input)return showToast('Enter notes or a topic first.');setToolBusy(true);try{const r=await api('/api/ai/chat',{method:'POST',body:JSON.stringify({role,message:`Create a concise exam revision summary with key points, formulas/examples and 5 quick questions for: ${input}`})});await saveStudentTool('AI Summary',{input,summary:r.reply});setStudentToolState(v=>({...v,input,summary:r.reply}));}catch(e){showToast(e.message)}finally{setToolBusy(false)}}}>{toolBusy?'Generating...':'Generate Summary & Save'}</button>{studentToolState.summary&&<div className="ai-result"><h3>Saved Revision Summary</h3><p>{studentToolState.summary}</p></div>}</div></div>;
    if (tool==='AI Viva Simulator') {
      const q=vivaQuestions[vivaIndex]?.question || 'Choose a subject and start your viva.';
      const subjectOptions=['Introduction to AI','Programming for Problem Solving (PPS)','Engineering Physics','Basic Electrical & Electronics Engineering (BEEE)','Engineering Mathematics-I','Universal Human Values'];
      return <div className="tool-page smart-tool-page">
        <div className="tool-hero viva-hero"><span className="tool-icon">🎙</span><div><div className="eyebrow">VOICE + TEXT VIVA</div><h1>AI Viva Simulator</h1><p>The AI asks, you answer — by voice or by typing. Every evaluated answer is saved.</p></div><span className="live-chip">● AI examiner</span></div>
        <div className="tool-panel viva-panel">
          <div className="viva-toolbar"><label>Subject<select value={vivaSubject} onChange={async e=>{setVivaSubject(e.target.value);setVivaIndex(0);setVivaAnswer('');setVivaFeedback('');setVivaInputMode('text');const r=await api(`/api/student-dashboard/viva/questions?subject=${encodeURIComponent(e.target.value)}`);setVivaQuestions(r.questions||[]);}}>{subjectOptions.map(x=><option key={x}>{x}</option>)}</select></label><span>Question {Math.min(vivaIndex+1,Math.max(1,vivaQuestions.length))} / {Math.max(1,vivaQuestions.length)}</span></div>
          <div className="viva-question premium"><div><span className="question-badge">AI QUESTION</span><h3>{q}</h3></div><button className="voice-circle" onClick={()=>speakText(q)} aria-label="Speak question">🔊</button></div>
          <div className="answer-mode"><button className={`mode-pill ${vivaListening?'active':''}`} onClick={()=>startSpeechCapture((text)=>{setVivaInputMode('voice');setVivaAnswer(text)},setVivaListening)}>🎤 {vivaListening?'Listening…':'Answer by Voice'}</button><span>or type your answer below</span></div>
          <textarea className="workspace-answer viva-answer-box" value={vivaAnswer} onChange={e=>setVivaAnswer(e.target.value)} rows="6" placeholder="Explain your answer in your own words..."/>
          <div className="workspace-actions"><button className="solid-button" disabled={toolBusy} onClick={async()=>{if(!vivaAnswer.trim())return showToast('Speak or write an answer first.');setToolBusy(true);try{const r=await api('/api/student-dashboard/viva/evaluate',{method:'POST',body:JSON.stringify({studentId:'CSE26-001',subject:vivaSubject,question:q,answer:vivaAnswer,mode:vivaInputMode})});setVivaFeedback(r.attempt.feedback);const next=Math.min(vivaIndex+1,vivaQuestions.length-1);setVivaAnswer('');if(vivaIndex<vivaQuestions.length-1)setVivaIndex(vivaIndex+1);showToast(r.message);}catch(e){showToast(e.message)}finally{setToolBusy(false)}}}>{toolBusy?'Evaluating…':vivaIndex<vivaQuestions.length-1?'Evaluate & Next':'Evaluate Final Answer'}</button><button className="secondary-button" onClick={()=>{setVivaAnswer('');setVivaFeedback('');}}>Clear</button></div>
          {vivaFeedback&&<div className="ai-result viva-feedback"><div><span className="feedback-label">AI FEEDBACK</span><h3>How you answered</h3><p>{vivaFeedback}</p></div><button className="secondary-button" onClick={()=>speakText(vivaFeedback)}>🔊 Hear Feedback</button></div>}
        </div>
      </div>;
    }
    if (tool==='AI Assistant') return null;
    if (tool==='Exam Readiness') {
      const r=studentToolState.readiness || smartToolsData?.readiness || {score:0,weakTopics:[],recommended:[]};
      const twin=studentToolState.analysis || smartToolsData?.twin || {};
      const subjectRows=(twin.profile || []).map(s=>({...s, flag:(s.progress||0)<60?'Weak':(s.progress||0)<75?'Watch':'Strong'}));
      const quizPct=Number(twin.practiceAccuracy ?? 0), attPct=Number(twin.attendance?.percentage ?? twin.attendancePct ?? 0), asgPct=Number(twin.assignmentCompletion ?? 0);
      const drivers=[{key:'Quiz & practice',value:quizPct,note:`${twin.practiceAccuracy!=null?`${quizPct}% accuracy`:'Run practice to score'}`,tone:'blue'},{key:'Attendance',value:attPct,note:`${attPct?`${attPct}% present`:'Not synced'}`,tone:'green'},{key:'Assignments',value:asgPct,note:`${asgPct?`${asgPct}% submitted`:'Not synced'}`,tone:'purple'}];
      return <div className="tool-page smart-tool-page"><div className="tool-hero readiness-hero"><span className="tool-icon">◎</span><div><div className="eyebrow">PERSONAL PREPARATION METER</div><h1>Exam Readiness</h1><p>A preparation score built from subject progress, practice, assignments and attendance.</p></div><span className="live-chip">● Live score</span></div><div className="readiness-premium"><div className="readiness-ring-wrap"><div className="readiness-ring" style={{'--score':`${r.score}%`}}><strong>{r.score}%</strong><span>ready</span></div><b>{r.score>=80?'Strong position':r.score>=65?'Building momentum':'Needs focused revision'}</b></div><div className="readiness-details"><div className="readiness-stat-row"><span>Weak focus</span><b>{r.weakTopics?.[0]||'Refresh analysis'}</b></div>{(r.recommended||[]).map((x,i)=><div className="readiness-action" key={i}><span>{i+1}</span><p>{x}</p></div>)}<div className="workspace-actions"><button className="solid-button" onClick={async()=>{const smart=await api('/api/student-dashboard/smart-tools');setStudentToolState(v=>({...v,readiness:smart.readiness}));await saveStudentTool('Exam Readiness',{readiness:smart.readiness,checkedAt:new Date().toISOString()});showToast('Readiness recalculated from your latest data.');}}>Recalculate</button><button className="secondary-button" onClick={()=>openStudentTool('Learning Path')}>Open Learning Path →</button></div></div></div>
        <div className="tool-panel readiness-drivers"><div className="panel-kicker">WHAT IS DRIVING YOUR SCORE</div><div className="driver-grid">{drivers.map(d=><div className={`driver-card ${d.tone}`} key={d.key}><div className="driver-head"><b>{d.key}</b><span>{d.value?`${d.value}%`:'—'}</span></div><div className="driver-bar"><i style={{width:`${Math.min(100,d.value)}%`}} /></div><small>{d.note}</small></div>)}</div></div>
        <div className="tool-panel readiness-weak"><div className="panel-kicker">WEAK SUBJECT ANALYSIS</div><div className="workspace-list">{subjectRows.length?subjectRows.map(s=><div key={s.name}><b>{s.name}</b><span className={`weak-flag ${s.flag.toLowerCase()}`}>{s.flag} • {s.progress}%</span><i style={{width:`${s.progress||0}%`}} /></div>):<div className="empty-state">Subject progress is not synced yet. Recalculate to build the weak-subject map.</div>}</div></div>
      </div>;
    }
    if (tool==='AI Mentorship') {
      const aarTools=[
        {k:AAR_CHAT_TAB,i:'💬',d:'Talk it through, anytime',c:'blue'},
        {k:'Mood Check',i:'🌤️',d:'Name how you feel today',c:'amber'},
        {k:'Calm Mode',i:'🌿',d:'Breathe and settle down',c:'green'},
        {k:'Study Recovery',i:'📚',d:'Rebuild your study rhythm',c:'violet'},
        {k:'Hope Journal',i:'✍️',d:'Write down what is going well',c:'rose'},
        {k:'Trusted Circle',i:'🤝',d:'Reach a person you trust',c:'teal'},
        {k:'Life Timeline',i:'🌱',d:'See your progress so far',c:'indigo'},
        {k:'Smart Suggestions',i:'💡',d:'Small steps for right now',c:'orange'},
      ];
      const aarMoods=[
        {k:'Great',e:'😄',c:'#4fbfa0',v:92},{k:'Good',e:'🙂',c:'#5b9bf0',v:80},{k:'Okay',e:'😐',c:'#f0a94a',v:68},
        {k:'Low',e:'😔',c:'#dd7f9a',v:48},{k:'Rough',e:'😣',c:'#c76ae0',v:38},{k:'Anxious',e:'😰',c:'#7b6ae8',v:44},
      ];
      const aarSuggest=[
        {i:'💙',t:'Emotional Support',d:'Feeling low, anxious or overwhelmed',tool:'Calm Mode',q:'I feel overwhelmed and could use a calm space',c:'#e8ecff',b:'#4f5fd7'},
        {i:'📘',t:'Academic Help',d:'Plan studies and clear weak subjects',tool:'Study Recovery',q:'Help me plan my studies for this week',c:'#ece9ff',b:'#6b5ce0'},
        {i:'🚀',t:'Skill Development',d:'Projects, career and new skills',tool:'Smart Suggestions',q:'I want to build a new skill this semester',c:'#f4ecff',b:'#8a5ce0'},
      ];
      /* Right-rail "Questions & Answers" — the same personal student topics, one
         per card, each opening the tool that best matches and pre-filling the
         question so the student sends it from the VIDYA input. */
      const aarQA=[
        {i:'💙',t:'Emotional Support',d:'Feeling low, anxious or overwhelmed',tool:'Calm Mode',q:'I feel overwhelmed and could use a calm space',c:'#e8ecff',b:'#4f5fd7'},
        {i:'📘',t:'Academic Help',d:'Plan studies and clear weak subjects',tool:'Study Recovery',q:'Help me plan my studies for this week',c:'#ece9ff',b:'#6b5ce0'},
        {i:'😴',t:'Sleep & Anxiety',d:'Restless nights and a racing mind',tool:'Calm Mode',q:'I keep losing sleep because my mind races at night',c:'#e6f0ff',b:'#3f7fd0'},
        {i:'🔥',t:'Stress & Burnout',d:'Too much pressure, no energy left',tool:'Study Recovery',q:'I am burnt out and everything feels like too much pressure',c:'#ffeae4',b:'#d1683f'},
        {i:'🫧',t:'Loneliness',d:'Surrounded by people, still alone',tool:'Trusted Circle',q:'I feel lonely even though there are people around me',c:'#e4f6f1',b:'#2f9c86'},
        {i:'🏠',t:'Family Problems',d:'Home tension affecting your studies',tool:'Mood Check',q:'There is tension at home and it is affecting my studies',c:'#fdeaf3',b:'#c2558c'},
        {i:'🎯',t:'Career Confusion',d:'Not sure which path fits you',tool:'Life Timeline',q:'I am confused about which career path actually fits me',c:'#f4ecff',b:'#8a5ce0'},
        {i:'🌟',t:'Motivation',d:'Lost the drive and cannot focus',tool:'Hope Journal',q:'I have lost my motivation and cannot focus on anything',c:'#fff4dd',b:'#c99022'},
      ];
      const AAR_MOOD_V = Object.fromEntries(aarMoods.map(m=>[m.k,m.v]));
      const AAR_INFO={
        private:{t:'Private by default',b:'Your check-ins, journal and chats stay on this device. Nothing is shared with your college or classmates.'},
        judgement:{t:'No judgement',b:`You can say anything, repeat yourself, or change your mind. ${VIDYA.name} never scores or ranks you.`},
        anytime:{t:'Anytime',b:`Open ${VIDYA.name} whenever you need — late night, between classes, or before an exam. There is no schedule.`},
      };
      const AAR_BREATH=['Breathe in','Hold','Breathe out','Rest'];
      const AAR_RECOVERY=[
        {k:'Set one 25-minute focus block',d:'Phone face down, one subject only.'},
        {k:'Take a 10-minute screen break',d:'Walk, stretch, look away from the desk.'},
        {k:'Review yesterday in 3 bullet points',d:'What you finished, what carried over.'},
        {k:'Write tomorrow’s first task',d:'One line is enough to lower anxiety.'},
      ];
      const AAR_CIRCLE=[
        {n:'Priya — Classmate',r:'Studies · same batch'},{n:'Dr. Rao — Subject Faculty',r:'Academic guidance'},
        {n:'Hostel Warden',r:'Campus support'},{n:'Campus Counsellor',r:'Confidential · booked slots'},
      ];
      const AAR_SUGGESTIONS=[
        {k:'Take a 5-minute Calm Mode break',d:'Short reset before your next class.'},
        {k:'Log one thing that went well today',d:'Hope Journal · about 2 minutes.'},
        {k:'Check in with your mood',d:'Takes one tap and updates your week.'},
        {k:'Try one 25-minute focus block',d:'Smallest useful unit of study.'},
      ];
      const AAR_BASE_WEEK=[58,66,52,70,64,78];
      // Mock history — local only, no AI or backend calls.
      const AAR_MOOD_HISTORY=[{d:'Mon',m:'Okay'},{d:'Tue',m:'Good'},{d:'Wed',m:'Low'},{d:'Thu',m:'Okay'},{d:'Fri',m:'Good'},{d:'Sat',m:'Great'},{d:'Sun',m:aarMood}];

      // Snapshot reacts to chat volume and the latest mood check.
      const chatBoost=Math.min(5,mentorMessages.length);
      const aarScore=aarMood?Math.min(97,Math.round(72*0.4+AAR_MOOD_V[aarMood]*0.6)+chatBoost):Math.min(97,72+chatBoost);
      const aarWeek=[...AAR_BASE_WEEK,aarScore];
      const aarSummary=!aarMood&&!mentorMessages.length&&!aarJournal.length
        ? 'Sleep dipped midweek, mood recovered by Sunday.'
        : aarMood
          ? `Feeling ${aarMood.toLowerCase()} today${mentorMessages.length?` · ${mentorMessages.length} message${mentorMessages.length===1?'':'s'} shared`:''}${aarJournal.length?` · ${aarJournal.length} journal entr${aarJournal.length===1?'y':'ies'}`:''}.`
          : `${mentorMessages.length} message${mentorMessages.length===1?'':'s'} shared with ${VIDYA.name}${aarJournal.length?`, ${aarJournal.length} journal entr${aarJournal.length===1?'y':'ies'}`:''}.`;
      const aarHead=aarScore>=78?'Steady week.':aarScore>=58?'Holding steady.':'Tough week — be kind to yourself.';

      // Recent chats gain a live row whenever you talk or check in.
      const aarLive=[];
      if(mentorMessages.length){
        const last=mentorMessages[mentorMessages.length-1];
        aarLive.push({t:AAR_CHAT_TAB,m:'Just now',n:mentorMessages.length,u:true,p:String(last.message||last.reply||'').slice(0,44)});
      }
      if(aarMood)aarLive.push({t:`Mood check — ${aarMood}`,m:'Today',n:1,u:!mentorMessages.length,p:'Check-in recorded for today'});
      if(aarJournal.length)aarLive.push({t:'Hope Journal',m:'Today',n:aarJournal.length,p:aarJournal[0].text.slice(0,44)});
      if(aarRecovery.length)aarLive.push({t:'Study Recovery',m:'Today',n:aarRecovery.length,p:`${aarRecovery.length} step${aarRecovery.length===1?'':'s'} done`});
      const aarThreads=[...aarLive,
        {t:'Exam pressure is building up',m:'2 min ago',n:2,u:!aarLive.length},
        {t:'Could not focus this evening',m:'Yesterday',n:4,u:false},
        {t:'Feeling better about CSE',m:'Mon',n:6,u:false},
      ];

      const aarToolPanel=()=>{
        if(aarTool==='Mood Check')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Your check-in history</b><span>This week</span></div>
          <div className="aar-moodhist">{AAR_MOOD_HISTORY.map((h,i)=>{const mm=aarMoods.find(x=>x.k===h.m);return <div key={i} className={i===6?'now':''}><span>{h.d}</span><i style={{'--mc':mm?mm.c:'#c9d2e6'}}>{mm?mm.e:'·'}</i><b>{h.m||'—'}</b></div>})}</div>
          <p className="aar-panel-note">{aarMood?`Today is logged as <b>${aarMood}</b>. You can change it with the cards above.`:'No check-in yet today. Use the mood cards in Today’s Check-in to log one — your week updates instantly.'}</p>
          <button className="aar-mini-btn" onClick={()=>setAarTool(AAR_CHAT_TAB)}>Talk it through with {VIDYA.name} →</button>
        </div>;
        if(aarTool==='Calm Mode')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Calm Mode</b><span>{aarCalmRounds} round{aarCalmRounds===1?'':'s'} completed</span></div>
          <div className={`aar-breathe ${aarCalm?'on':''}`}><div className="aar-breath-orb"><span>{aarCalm?AAR_BREATH[aarCalmStep]:'🌿'}</span></div><p>{aarCalm?`${AAR_BREATH[aarCalmStep]} · follow the circle`:'A slow 4–4–6 breathing circle. Nothing is sent anywhere.'}</p></div>
          <button className="aar-mini-btn solid" onClick={()=>{setAarCalm(v=>!v);setAarCalmStep(0);}}>{aarCalm?'Stop':'Start Calm Mode'}</button>
        </div>;
        if(aarTool==='Study Recovery')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Rebuild your study rhythm</b><span>{aarRecovery.length} of {AAR_RECOVERY.length} done</span></div>
          <div className="aar-progress"><i style={{width:`${(aarRecovery.length/AAR_RECOVERY.length)*100}%`}}></i></div>
          <div className="aar-checks">{AAR_RECOVERY.map(s=>{const on=aarRecovery.includes(s.k);return <button key={s.k} className={on?'on':''} onClick={()=>setAarRecovery(v=>on?v.filter(x=>x!==s.k):[...v,s.k])}><i>{on?'✓':''}</i><div><b>{s.k}</b><small>{s.d}</small></div></button>})}</div>
        </div>;
        if(aarTool==='Hope Journal')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Hope Journal</b><span>{aarJournal.length} entr{aarJournal.length===1?'y':'ies'}</span></div>
          <div className="aar-journal-add"><textarea rows="2" value={aarDraft} onChange={e=>setAarDraft(e.target.value)} placeholder="One thing that went well today…"/><button className="aar-mini-btn solid" disabled={!aarDraft.trim()} onClick={()=>{setAarJournal(v=>[{text:aarDraft.trim(),at:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})},...v]);setAarDraft('');}}>Save</button></div>
          {aarJournal.length?<div className="aar-journal-list">{aarJournal.map((e,i)=><div key={i}><b>{e.text}</b><small>{e.at}</small></div>)}</div>:<p className="aar-panel-note">Nothing saved yet. Even a small win counts — name it.</p>}
        </div>;
        if(aarTool==='Trusted Circle')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Your Trusted Circle</b><span>{aarCircle?`Reached out to ${aarCircle.split(' — ')[0]}`:'Nobody contacted yet'}</span></div>
          <div className="aar-circle-list">{AAR_CIRCLE.map(c=><button key={c.n} className={aarCircle===c.n?'on':''} onClick={()=>setAarCircle(v=>v===c.n?null:c.n)}><span>{c.n.split(' ')[0][0]}</span><div><b>{c.n}</b><small>{c.r}</small></div><em>{aarCircle===c.n?'Reached out':'Reach out'}</em></button>)}</div>
          <p className="aar-panel-note">A demo list stored on this device. A real campus directory is not connected yet.</p>
        </div>;
        if(aarTool==='Life Timeline')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Your journey so far</b><span>{3+aarTimeline.length} milestones</span></div>
          <div className="aar-timeline">
            {[['Aug 2026','Started CSE (IoT)','enrolled'],['Sep 2026','First assignment submitted','done'],['This week',`Reached out to ${VIDYA.name}`,'now'],...aarTimeline.map(t=>[t.at,t.text,'new'])].map(([d,txt,kind],i)=><div key={i} className={kind==='now'?'now':''}><i></i><div><b>{txt}</b><small>{d}</small></div></div>)}
          </div>
          <button className="aar-mini-btn" onClick={()=>setAarTimeline(v=>[{at:'Today',text:'Checked in with my mood'},...v])}>+ Mark today</button>
        </div>;
        if(aarTool==='Smart Suggestions')return <div className="aar-panel">
          <div className="aar-panel-head"><b>Small steps for right now</b><span>{aarDone.length} of {AAR_SUGGESTIONS.length} applied</span></div>
          <div className="aar-sugg-list">{AAR_SUGGESTIONS.map(s=>{const on=aarDone.includes(s.k);return <button key={s.k} className={on?'on':''} onClick={()=>setAarDone(v=>on?v.filter(x=>x!==s.k):[...v,s.k])}><span>💡</span><div><b>{s.k}</b><small>{s.d}</small></div><em>{on?'Applied':'Apply'}</em></button>})}</div>
        </div>;
        return null;
      };

      return <div className="tool-page aar-page">
        <section className="aar-hero">
          <div className="aar-id">
            <span className="aar-id-av"><img src="/images/vidya-avatar.jpg" alt={VIDYA.name}/><i className="aar-online"></i></span>
            <div><b>{VIDYA.name}</b><small><i className="aar-dot"></i>Online now</small></div>
          </div>
          <div className="aar-hero-copy"><span className="aar-eyebrow">WELLBEING &amp; MENTORSHIP</span><h1>Your space to feel better</h1><div className="aar-hero-chips">{[['private','🔒','Private by default'],['judgement','💬','No judgement'],['anytime','🕓','Anytime']].map(([k,i,l])=><span className="aar-chip-wrap" key={k}><button className={`aar-chip ${aarInfo===k?'on':''}`} onClick={()=>setAarInfo(v=>v===k?null:k)} aria-expanded={aarInfo===k}>{i} {l} <em>?</em></button>{aarInfo===k&&<span className="aar-chip-pop">{AAR_INFO[k].t} — {AAR_INFO[k].b}</span>}</span>)}</div></div>
          <div className="aar-hero-right">
            <div className="aar-snap">
              <div className="aar-ring sm" style={{'--p':`${aarScore}%`}}><strong>{aarScore}</strong></div>
              <div className="aar-snap-txt"><div className="aar-mini-chart sm">{aarWeek.map((h,i)=><i key={i} style={{height:`${h}%`}} className={i===6?'now':''}></i>)}</div><p><b>{aarHead}</b> {aarSummary}</p></div>
            </div>
            <div className="aar-checkin">
              <div className="aar-card-head"><h2>Today’s Check-in</h2><small>How are you feeling today?</small></div>
              <div className="aar-moods">{aarMoods.map(m=><button key={m.k} className={aarMood===m.k?'active':''} style={{'--mc':m.c}} onClick={()=>setAarMood(m.k)}><span>{m.e}</span><b>{m.k}</b></button>)}</div>
              {aarMood ? <p className="aar-mood-note">Thanks for checking in. Feeling <b>{aarMood.toLowerCase()}</b> is a real signal, not a problem. {VIDYA.name} is here to help with the next small step.</p> : <p className="aar-mood-note muted">Pick how you feel — this stays on your screen and is not shared.</p>}
            </div>
          </div>
        </section>

        <section className="aar-tools">{aarTools.map(t=><button key={t.k} className={`aar-tool ${t.c} ${aarTool===t.k?'active':''}`} onClick={()=>setAarTool(t.k)}><span className="aar-tool-ic">{t.i}</span><b>{t.k}</b><small>{t.d}</small></button>)}</section>

        <section className="aar-main">
          <aside className="aar-card aar-recent">
            <div className="aar-card-head"><h2>Recent Chats</h2><small>{aarThreads.length} conversations</small></div>
            <div className="aar-thread-list">{aarThreads.map((t,i)=><button key={t.t} className={aarThread===i?'active':''} onClick={()=>setAarThread(i)}><div><b>{t.t}</b><small>{t.p||t.m}</small></div><em className={t.u?'unread':''}>{t.n}</em></button>)}</div>
            <button className="aar-ghost-btn">View all chats</button>
          </aside>

          <div className="aar-center">
            <div className="aar-card aar-voice">
              <div className="aar-voice-glow"></div>
              <div className="aar-voice-top">
                <span className="aar-voice-av"><img src="/images/vidya-avatar.jpg" alt={VIDYA.name}/><i className="aar-online"></i></span>
                <div className="aar-voice-id"><b>{VIDYA.name}</b><small><i className="aar-dot"></i>Online now</small></div>
                <button className="aar-voice-act" onClick={()=>speakText('I am here to listen. Tell me how your day has been, and we will take it one step at a time.')} aria-label={`Play a greeting from ${VIDYA.name}`}>🔊</button>
              </div>

              <div className="aar-voice-core">
                <button className={`aar-voice-mic ${aarVoice}`} onClick={toggleAarVoice} aria-pressed={aarVoice==='live'} aria-label={`Tap to Talk to ${VIDYA.name}`}>
                  <span className="aar-voice-halo h1"></span>
                  <span className="aar-voice-halo h2"></span>
                  <span className="aar-voice-halo h3"></span>
                  <span className="aar-voice-ic">🎙️</span>
                </button>
                <b className="aar-voice-cta">{aarVoice==='live'?'Listening…':`Tap to Talk to ${VIDYA.name}`}</b>
                <p className="aar-voice-status">{aarVoice==='live'?'I am listening — speak now':mentorBusy?`${VIDYA.name} is thinking…`:'Ready to help'}</p>
              </div>

              <div className="aar-voice-chips">
                {aarSuggest.map(s=><button key={s.t} style={{'--bg':s.c,'--bd':s.b}} onClick={()=>setMentorInput(s.q)}><span>{s.i}</span>{s.t}</button>)}
              </div>

              {aarTool!==AAR_CHAT_TAB&&<div className="aar-voice-log tool">{aarToolPanel()}</div>}

              {(aarTool===AAR_CHAT_TAB&&mentorMessages.length>0)&&<div className="aar-voice-log">{mentorMessages.map((m,i)=><div key={m.id||i} className={`aar-bub-row ${m.role==='user'?'mine':''}`}><div className="aar-bub"><p>{m.message||m.reply}</p>{m.plan?.length?<div className="mentor-plan">{m.plan.map((x,j)=><span key={j}>{j+1}. {x}</span>)}</div>:null}{m.pressure&&<em className="pressure-badge">Pressure-aware support</em>}</div></div>)}</div>}

              <div className="aar-composer">
                <input value={mentorInput} onChange={e=>setMentorInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMentorMessage()} placeholder={`Or type a message to ${VIDYA.name}…`}/>
                <button className="aar-send" disabled={mentorBusy||!mentorInput.trim()} onClick={()=>sendMentorMessage()} aria-label="Send message">{mentorBusy?'…':'➤'}</button>
              </div>
            </div>
          </div>

          <aside className="aar-card aar-suggest">
            <div className="aar-card-head"><h2>Questions &amp; Answers</h2><small>Pick a topic to ask {VIDYA.name}</small></div>
            <div className="aar-suggest-list">{aarQA.map(s=><button key={s.t} style={{'--bg':s.c,'--bd':s.b}} onClick={()=>{setAarTool(s.tool);setMentorInput(s.q);showToast(`${s.t} — question added, send when you are ready.`);}}><span>{s.i}</span><div><b>{s.t}</b><small>{s.d}</small></div><em>→</em></button>)}</div>
          </aside>
        </section>
      </div>;
    }
    if (tool==='Mock Tests') return <div className="tool-page"><span className="tool-icon">📝</span><div className="eyebrow">EXAM PRACTICE</div><h1>Mock Test</h1><p>Submit an answer and save your result to the backend.</p><div className="tool-panel"><div className="mock-question"><b>Q1. Which data structure follows LIFO?</b><label><input type="radio" name="quickmock" value="Stack"/> Stack</label><label><input type="radio" name="quickmock" value="Queue"/> Queue</label><label><input type="radio" name="quickmock" value="Tree"/> Tree</label></div><button className="solid-button" onClick={async()=>{const chosen=document.querySelector('input[name="quickmock"]:checked')?.value;if(!chosen)return showToast('Choose an answer.');const score=chosen==='Stack'?100:0;await saveStudentTool('Mock Tests',{lastAnswer:chosen,score,submittedAt:new Date().toISOString()});showToast(score?'Correct! Result saved: 100%.':'Submitted. Result saved.');}}>Submit & Save Result</button>{studentToolState.score!=null&&<div className="success-message">Last saved score: {studentToolState.score}%</div>}</div></div>;
    return renderSimpleTool(tool, 'Continue your academic workflow with saved progress.', '✦', 'This feature is connected to the CampusLMS backend.');
  };

  const renderSimpleTool = (title, subtitle, icon, body, buttonText = "Start Now →") => <div className="tool-page"><span className="tool-icon">{icon}</span><div className="eyebrow">CAMPUSLMS SMART TOOL</div><h1>{title}</h1><p>{subtitle}</p><div className="tool-panel"><h2>{body}</h2><p>This interactive demo is connected to your student workspace. Use the action below to continue.</p><button className="solid-button" onClick={()=>runAction(`${title} started for Satya.`)}>{buttonText}</button></div></div>;

  const renderFacultyDashboard = () => {
    const faculty = serverData?.user?.role === 'Faculty' ? serverData.user : facultyDirectory.find(f=>f.id===facultyId) || facultyDirectory[0];
    const facultySubjects = faculty?.subjects || [];
    const facultyCourseLabel = facultySubjects.length ? facultySubjects.join(' • ') : 'No Semester-I student course assigned in this prototype';
    const quick = [
      ['📄','Create Assignment'],['📝','Question Paper Generator'],['📅','Schedule Class'],
      ['📢','Send Announcement'],['👥','Attendance'],['📊','Class Analytics'],
      ['🎯','Remedial Session Planner'],['🤖','Faculty AI Assistant'],
      ['♨','AI Doubt Heatmap'],['🚨','AI Concept Rescue'],
      ['👨‍👩‍👧','AI Parent Connect'],['🎯','AI Personalized Learning']
    ];
    const facultyOpen = async (title) => {
      const resolved = title === 'Content Recommendations' ? 'AI Personalized Learning' : title;
      if (resolved === 'At-Risk Students') { setWorkspace({title:'Real AI Risk',action:'Real AI Risk',data:facultyIntel}); return; }
      if (['AI Doubt Heatmap','AI Concept Rescue','AI Parent Connect','AI Personalized Learning'].includes(resolved)) { setWorkspace({title:resolved,action:resolved,data:facultyIntel}); return; }
      if (resolved === 'Class Analytics' || resolved === 'AI Reports') { try { const r=await api(`/api/faculty/analytics?facultyId=${encodeURIComponent(facultyId)}`); setWorkspace({title:resolved,action:resolved,data:{...r,courses:(r.courses||[]).map(c=>({...c,average:facultyIntel.subjectMetrics.find(m=>m.name===c.name)?.progress??c.average,derived:true})),intel:facultyIntel}}); } catch(e){showToast(e.message);} return; }
      if (resolved === 'Doubt Tickets') { let r = null; try { r = await api('/api/doubt-tickets'); } catch(e) { r = null; } setWorkspace({title:resolved,action:resolved,data:r||{tickets:facultyIntel.tickets,intel:facultyIntel}}); return; }
      if (resolved === 'Attendance') { try { const r=await api('/api/attendance'); setWorkspace({title:resolved,action:resolved,data:{...r,intel:facultyIntel}}); } catch(e){showToast(e.message);} return; }
      if (resolved === 'Schedule Class') { try { const r=await api('/api/schedules'); setWorkspace({title:resolved,action:resolved,data:r}); } catch(e){showToast(e.message);} return; }
      if (resolved === 'My Courses') setWorkspace({title:resolved,action:resolved,data:{courses:facultySubjects,intel:facultyIntel}});
      else if (resolved === 'Assessments') setWorkspace({title:resolved,action:resolved,data:{assignments:(serverData?.assignments||[]).filter(a=>!facultySubjects.length||facultySubjects.includes(a.subject)),intel:facultyIntel}});
      else if (resolved === 'Resources' || resolved === 'Open Resources') setWorkspace({title:'Resources',action:'Faculty Resources',data:{resources:(serverData?.resources||[]).filter(r=>!facultySubjects.length||facultySubjects.includes(r.subject)),intel:facultyIntel}});
      else if (resolved === 'Announcements') setWorkspace({title:resolved,action:resolved,data:{announcements:serverData?.announcements||[]}});
      else if (resolved === 'Feedback & Surveys') setWorkspace({title:resolved,action:resolved,data:{polls:serverData?.polls||[]}});
      else if (resolved === 'Notification Center') await openNotifications();
      else if (resolved === 'Create Practice') openRoleWorkspace('Question Paper Generator',{area:'Faculty Dashboard'});
      else openRoleWorkspace(resolved, {area:'Faculty Dashboard'});
    };
    return <div className={`faculty-page ${dark ? 'role-dark' : ''}`}>
      <div className="faculty-layout">
        <aside className="faculty-sidebar">
          <div className="faculty-brand"><div className="faculty-cap">◆</div><div><strong>CampusLMS</strong><span>Teach. Inspire. Transform.</span></div></div>
          {/* Streamlined nav. Labels are shortened, but each item still calls the
              same facultyOpen module it did before, so endpoints are unchanged. */}
          {[
            { key: 'Dashboard',         icon: '⌂',  label: 'Dashboard',         onClick: () => setActive('Dashboard') },
            { key: 'Faculty Analytics', icon: '📊', label: 'Faculty Analytics', onClick: () => facultyOpen('Class Analytics') },
            { key: 'Attendance',        icon: '✓',  label: 'Attendance',        onClick: () => facultyOpen('Attendance') },
            { key: 'Academic Records',  icon: '▤',  label: 'Academic Records',  onClick: () => setActive('Academic Records') },
            { key: 'Help & Support',    icon: '?',  label: 'Help & Support',    onClick: () => setActive('Help & Support') },
          ].map(({ key, icon, label, onClick }) => (
            <button key={key} className={active === key ? 'faculty-nav active' : 'faculty-nav'} onClick={onClick}>
              <span className="faculty-nav-ic">{icon}</span>{label}
            </button>
          ))}
          <div className="faculty-sidebar-bottom">
            <button className="faculty-nav" onClick={()=>runAction("Settings panel opened.")}><span className="faculty-nav-ic">⚙</span>Settings</button>
            <button className="faculty-nav faculty-logout" onClick={logout}>↪ <span>Logout</span></button>
            <div className="faculty-user"><span className="faculty-avatar">{faculty.short || faculty.name?.split(' ').map(x=>x[0]).join('').slice(0,3)}</span><div><strong>{faculty.name}</strong><small>{faculty.department}</small><em>● Online</em></div></div>
          </div>
        </aside>
        <main className="faculty-main">
          <header className="faculty-topbar"><div className="faculty-search">⌕ <input placeholder="Search students, assignments, questions, resources..."/><kbd>Ctrl K</kbd></div><div className="faculty-actions"><button onClick={()=>setDark(v=>!v)}>{dark?'☀':'☼'}</button><button className="faculty-bell" onClick={openNotifications}>♧<b>{notifications}</b></button><div className="faculty-profile"><span className="faculty-avatar">{faculty.short || faculty.name?.split(' ').map(x=>x[0]).join('').slice(0,3)}</span><div><strong>{faculty.name}</strong><small>{faculty.department}</small></div><button className="faculty-top-logout" onClick={logout}>Logout</button></div></div></header>
          <div className="faculty-content">
            <section className="faculty-hero"><div><span className="faculty-eyebrow">FACULTY WORKSPACE</span><h1>Good Morning, {faculty.name}! 👋</h1><p>{faculty.department} • {facultyCourseLabel}</p><div className="faculty-quote">“A teacher doesn’t just deliver content,<br/>they build futures.”<small>— CampusLMS</small></div></div><div className="faculty-sem-wrap"><div className="faculty-sem-label">SEMESTER SCOPE</div><div className="faculty-sem-switch" role="tablist" aria-label="Semester switcher">{FACULTY_V16.semesters.map((s)=><button key={s} role="tab" aria-selected={facultySemester===s} className={facultySemester===s?'active':''} onClick={()=>{setFacultySemester(s);v16Persist({});}}>{s.replace('Semester ','S')}</button>)}</div><div className="faculty-sem-note">All risk, heatmap and personalized-learning views recalculate for <b>{facultySemester}</b>. Progress, attendance and assignment figures are read live from the CampusLMS backend.</div></div><div className="faculty-hero-message"><b>Track<br/>Understand<br/>Support<br/>Make an Impact</b><div><small>Cohort Recorded Today</small><strong>{facultyIntel.attendance.present} / {facultyIntel.attendance.total}</strong><span>{facultyIntel.attendancePct==null?'Attendance not published':`${facultyIntel.attendancePct}% attendance · ${facultyIntel.cohort} enrolled`}</span></div></div></section>
            <section className="faculty-stats">{[['📖','My Courses',String(facultySubjects.length),facultySubjects.slice(0,2).join(' • ') || 'College faculty / support role'],['👥','IoT Cohort',String(facultyIntel.cohort||0),'Backend enrolment record'],['📝','Pending Evaluations',facultyIntel.pendingEvaluations==null?'—':String(facultyIntel.pendingEvaluations),'Submitted assignments awaiting review'],['📊','Avg Subject Progress',facultyIntel.avgProgress==null?'—':`${facultyIntel.avgProgress}%`,'Live from subjects profile'],['❓','Doubt Queries',String(facultyIntel.tickets.length),'Backend tickets']].map(([i,t,n,s])=><div className="faculty-stat" key={t}><span>{i}</span><div><small>{t}</small><strong>{n}</strong><em>{s}</em></div></div>)}</section>
            <section className="faculty-grid faculty-grid-top"><div className="faculty-panel performance"><div className="faculty-panel-head"><div><h2>Class Performance Overview</h2><p>Course progress and attention signals, measured from live backend records.</p></div><button onClick={()=>facultyOpen('Class Analytics')}>View Details →</button></div>{facultyIntel.subjectMetrics.filter(s=>s.known).length ? <div className="bars">{facultyIntel.subjectMetrics.filter(s=>s.known).slice(0,6).map((s)=><div key={s.name}><div className="bar-wrap"><i style={{height:`${s.progress}%`}}></i><b>{s.progress}%</b></div><span>{s.name.length>18?`${s.name.slice(0,17)}…`:s.name}</span></div>)}</div> : <div className="empty-state">No subject progress is published for these courses yet.</div>}<div className="perf-foot"><span>▤ {facultyIntel.resourceCount} resources mapped</span><span>▧ {facultyIntel.scope.length} subjects</span><span>◎ {facultyIntel.attendancePct==null?'—':`${facultyIntel.attendancePct}%`} attendance</span></div></div>
              <div className="faculty-panel risk"><div className="faculty-panel-head"><div><h2>Real AI Risk</h2><p>Exposure computed from live subject, attendance and assignment records</p></div><button onClick={()=>facultyOpen('At-Risk Students')}>View Details →</button></div>{facultyIntel.exposure==null ? <div className="empty-state">No risk signal is available yet — publish subject progress or attendance to activate this model.</div> : <><div className="risk-body"><div className="risk-ring" style={{'--ring':`${Math.max(4,Math.min(100,facultyIntel.exposure))}`}}><strong>{facultyIntel.exposure}</strong><small>Exposure</small><span>{FACULTY_V16.riskBands.find(b=>b.key===facultyIntel.band(facultyIntel.exposure))?.label}</span></div><div className="risk-list">{facultyIntel.bands.filter(b=>b.count!=null&&b.count>0).map((b)=><p key={b.key}><i style={{background:b.color}}></i><b>{b.label}</b><strong>{b.count}</strong></p>)}{facultyIntel.bands.filter(b=>b.count!=null&&b.count>0).length===0&&<p><i style={{background:'#30a46c'}}></i><b>All clear</b><strong>0</strong></p>}</div></div><div className="risk-drivers">{facultyIntel.drivers.filter(d=>d.value!=null).map(d=><div className="risk-driver" key={d.label}><div><b>{d.label}</b><small>{d.source}</small></div><div className="risk-driver-bar"><i style={{width:`${Math.min(100,d.value)}%`}}></i></div><strong>{d.value}%</strong></div>)}</div><div className="risk-alert">⚠ {facultyIntel.atRiskCohort==null?'No':facultyIntel.atRiskCohort} of {facultyIntel.cohort} enrolled students sit above the attention threshold. <button onClick={()=>facultyOpen('Remedial Session Planner')}>Plan Support →</button></div></>}</div>
              <div className="faculty-panel quick-actions"><div className="faculty-panel-head"><h2>Quick Actions</h2><p>Start a complete workflow</p></div><div className="faculty-actions-grid">{quick.map(([i,t])=><button key={t} onClick={()=>facultyOpen(t)}><span>{i}</span>{t}</button>)}</div></div></section>
            <section className="faculty-grid faculty-grid-mid"><div className="faculty-panel insights"><div className="faculty-panel-head"><div><h2>Teaching Focus</h2><p>Course-focused actions for your assigned Semester I subjects.</p></div></div>{(facultySubjects.length?facultySubjects.map((subject,idx)=>['🧠',`${subject} focus area`,`${subject} is currently mapped to your CampusLMS teaching workspace. Use Question Paper Generator and Resources to build course-specific material.`,idx===0?'Create Practice':'Open Resources']):[['ℹ','College faculty profile','No Semester I student course is assigned to this login. This account is retained for important college-faculty access.','View Profile']]).map(([i,t,d,a])=><div className="insight-row" key={t}><span>{i}</span><div><b>{t}</b><p>{d}</p></div><button onClick={()=>facultyOpen(a)}>{a}</button></div>)}</div>
              <div className="faculty-panel classes"><div className="faculty-panel-head"><h2>📅 Upcoming Classes</h2><button onClick={()=>facultyOpen('Schedule Class')}>View Timetable →</button></div>{(serverData?.schedules||[]).filter(c=>!facultySubjects.length || facultySubjects.includes(c.subject)).slice(0,4).map(c=><div className="class-row" key={c.id}><b>{c.time}</b><div><strong>{c.title}</strong><small>{c.detail}</small></div></div>)}</div>
              <div className="faculty-panel tickets"><div className="faculty-panel-head"><h2>🎟 Recent Doubt Tickets</h2><button onClick={()=>facultyOpen('Doubt Tickets')}>View All →</button></div>{(serverData?.tickets||[]).length?(serverData.tickets.slice(0,3).map(t=><div className="ticket-row" key={t.id}><span>?</span><div><strong>{t.title}</strong><small>{t.description||'Faculty follow-up requested'}</small></div><time>{new Date(t.createdAt).toLocaleDateString()}</time><em className={String(t.status||'Open').toLowerCase()}>{t.status}</em></div>)):<div className="empty-state">No new doubt tickets for this faculty workspace.</div>}</div></section>
            <section className="faculty-grid faculty-grid-ai"><div className="faculty-panel heat"><div className="faculty-panel-head"><div><h2>AI Doubt Heatmap</h2><p>Concept-level heat built from subject progress gaps, doubt tickets and evaluation backlog.</p></div><button onClick={()=>facultyOpen('AI Doubt Heatmap')}>Open Heatmap →</button></div>{facultyIntel.concepts.length ? <div className="heat-grid">{facultyIntel.concepts.map((c,i)=><button key={`${c.subject}-${c.concept}`} className="heat-cell" title={`${c.concept} — heat ${c.heat ?? 'n/a'}`} style={{'--h':c.heat==null?'#2b3240':`hsl(${Math.max(6,120-(c.heat/100)*120)} 72% ${38+(c.heat/100)*22}%)`,opacity:c.heat==null?.35:1}} onClick={()=>facultyOpen('AI Concept Rescue')}><span>{c.concept.split(' ')[0]}</span>{c.doubts>0&&<b>{c.doubts}</b>}</button>)}</div> : <div className="empty-state">Assign a course to generate the concept heatmap.</div>}<div className="heat-legend"><span>Calm</span><i className="heat-scale"></i><span>Critical</span><em>{facultyIntel.tickets.length?`${facultyIntel.tickets.length} live doubt tickets folded in`:'No doubt tickets recorded — heat reflects progress gap only'}</em></div></div>
              <div className="faculty-panel ai-launch"><div className="faculty-panel-head"><div><h2>AI Assistance Suite</h2><p>Generated from the same live records as this dashboard.</p></div></div><div className="ai-launch-grid">{[['🤖','AI Concept Rescue','Generate a rescue explanation for a weak concept and publish it to the class.',c=>facultyOpen('AI Concept Rescue')],['👨‍👩‍👧','AI Parent Connect','Compose a grounded progress update for guardians from real attendance and submission data.',c=>facultyOpen('AI Parent Connect')],['🎯','AI Personalized Learning','Build per-topic remediation plans from each course’s measured progress gap.',c=>facultyOpen('AI Personalized Learning')],['♨','AI Doubt Heatmap','Trace every hot concept back to the record that produced it.',c=>facultyOpen('AI Doubt Heatmap')]].map(([i,t,d,f])=><button key={t} onClick={f}><span>{i}</span><b>{t}</b><small>{d}</small></button>)}</div></div></section>
            <section className="faculty-grid faculty-grid-bottom"><div className="faculty-panel dept"><h2>🏢 CSE Department Snapshot</h2><div className="dept-stats"><div><b>60</b><span>CSE (IoT) annual intake</span></div><div><b>4</b><span>Computer labs</span></div><div><b>175+</b><span>Computers</span></div><div><b>100 Mbps</b><span>Internet lease line</span></div></div></div><div className="faculty-panel notices"><div className="faculty-panel-head"><h2>📢 Important Notifications</h2><button onClick={()=>facultyOpen('Announcements')}>View All →</button></div>{(serverData?.announcements||[]).slice(0,3).map((a,i)=><div className="notice-row" key={a.id||a.title}><span>{['🔴','🟠','🟡'][i]}</span><strong>{a.title}</strong><small>{a.createdAt?new Date(a.createdAt).toLocaleDateString():'Recent'}</small></div>)}</div><div className="faculty-panel build-card"><div>🏆</div><h2>Together We Build<br/>Better Learners</h2><p>Guide · Support · Empower</p></div></section>
          </div>
        </main>
      </div>
    </div>;
  };


  const renderCRDashboard = () => {
    const crAnnouncements = announcements.length ? announcements.slice(0,4) : [
      {title:'End-Sem Exam Schedule Released',body:'Check dates and syllabus.'},
      {title:'Lab Manual Updated',body:'For all first year students.'},
      {title:'AI/ML Workshop',body:'Registration open now!'}
    ];
    const issues = serverData?.issues || [];
    const polls = serverData?.polls || [];
    const crOpen = async (title) => {
      const resolved = title === 'My Class' ? 'Student Manager'
        : title === 'Class Updates' ? 'Class Analytics'
        : title === 'Class Schedule' ? 'Timetable & Events'
        : title;
      if (['AI Class Command Center','Anonymous Issue Box','Smart Announcement Generator','Class Analytics','Student Manager','Timetable & Events'].includes(resolved)) { setWorkspace({title:resolved,action:resolved,data:crIntel}); return; }
      if (resolved === 'Notification Center') return openNotifications();
      if (resolved === 'Open Issues') { try { const r = await api('/api/issues'); setWorkspace({title:'Open Issues',action:'Anonymous Issue Box',data:{...r,intel:crIntel}}); } catch(e){ setWorkspace({title:'Open Issues',action:'Anonymous Issue Box',data:{issues:crIntel.issues,intel:crIntel}}); } return; }
      if (resolved === 'Announcements') { try { const r = await api('/api/announcements'); setWorkspace({title:'Announcements',action:'Smart Announcement Generator',data:{...r,intel:crIntel}}); } catch(e){ setWorkspace({title:'Announcements',action:'Smart Announcement Generator',data:{announcements:crIntel.recentAnnouncements,intel:crIntel}}); } return; }
      if (resolved === 'Attendance') { try { const r = await api('/api/attendance'); setWorkspace({title:'Attendance',action:'Class Analytics',data:{...r,intel:crIntel}}); } catch(e){ showToast(e.message); } return; }
      if (resolved === 'Assignments') { setWorkspace({title:'Assignments',action:'Student Manager',data:{intel:crIntel}}); return; }
      openRoleWorkspace(resolved, {area:'CR Dashboard'});
    };
    return <div className={`cr-page ${dark ? 'role-dark' : ''}`}>
      <div className="cr-layout">
        <aside className="cr-sidebar">
          <div className="cr-brand"><div className="cr-cap">◆</div><div><strong>CampusLMS</strong><span>Learn. Lead. Together.</span></div></div>
          {/* Streamlined nav. Each item calls the same crOpen module as before. */}
          {[
            { key: 'Dashboard',       icon: '⌂',  label: 'Dashboard',        onClick: () => setActive('Dashboard') },
            { key: 'Class Management', icon: '👥', label: 'Class Management', onClick: () => crOpen('Student Manager') },
            { key: 'Notices',         icon: '📢', label: 'Notices',          onClick: () => crOpen('Announcements') },
            { key: 'Attendance',      icon: '✓',  label: 'Attendance',       onClick: () => crOpen('Attendance') },
            { key: 'Reports',         icon: '📊', label: 'Reports',          onClick: () => crOpen('Class Analytics') },
            { key: 'Help & Support',  icon: '?',  label: 'Help & Support',   onClick: () => setActive('Help & Support') },
          ].map(({ key, icon, label, onClick }) => (
            <button key={key} className={active === key ? 'cr-nav active' : 'cr-nav'} onClick={onClick}>
              <span className="cr-nav-ic">{icon}</span>{label}
            </button>
          ))}
          <div className="cr-side-quote"><span>“</span><b>Same Students<br/>Bigger Possibilities</b></div>
          <div className="cr-sidebar-bottom">
            <button className="cr-nav" onClick={()=>runAction("Settings panel opened.")}><span className="cr-nav-ic">⚙</span>Settings</button>
            <button className="cr-nav cr-logout" onClick={logout}>↪ <span>Logout</span></button>
            <div className="cr-user"><div className="cr-avatar">SP</div><div><b>Satya Prakash</b><small>CR | CSE Sem 1</small><span>● Online</span></div></div>
          </div>
        </aside>
        <main className="cr-main">
          <header className="cr-topbar"><div className="cr-search">⌕ <input placeholder="Search students, announcements, assignments..."/></div><div className="cr-actions"><button onClick={()=>setDark(v=>!v)}>{dark?'☀':'☼'}</button><button onClick={() => setNotifications(0)} className="cr-bell">♧<b>{notifications || 0}</b></button><div className="cr-profile"><span className="cr-avatar">SP</span><div><strong>Satya Prakash</strong><small>Class Representative</small></div><button className="cr-top-logout" onClick={logout}>Logout</button></div></div></header>
          <div className="cr-content">
            <section className="cr-hero"><div className="cr-hero-copy"><h1>Good Morning, Satya! 👋</h1><p>Lead. Coordinate. Support.</p><div className="cr-quote">“A good CR isn’t just informed, but involved.”<small>— CampusLMS</small></div></div><div className="cr-hero-message"><strong>Same Class<br/>Stronger Together</strong><span>CSE<br/><b>Sem 1</b></span></div></section>
            <section className="cr-stats">{[['👥','Total Students',serverData?.stats?.students || 62,''],['✓','Present Today',serverData?.stats?.present || 54,`${Math.round(((serverData?.stats?.present || 54)/(serverData?.stats?.students || 62))*100)}% Attendance`],['▤','Pending Submissions',serverData?.stats?.pendingSubmissions || 0,'Assignments & Labs'],['!','Open Issues',serverData?.stats?.openIssues || 0,'Need Attention']].map(([i,t,n,s]) => <div className="cr-stat" key={t}><span>{i}</span><div><small>{t}</small><strong>{n}</strong><em>{s}</em></div></div>)}</section>
            <section className="cr-grid">
              <div className="cr-panel schedule"><div className="cr-panel-head"><h2>▣ Semester I Schedule</h2><button onClick={()=>crOpen('Timetable & Events')}>View All →</button></div>{crIntel.schedules.length ? crIntel.schedules.slice(0,4).map((c,i)=><div className="cr-schedule-row" key={c.id}><b className={['green','blue','purple','orange'][i%4]}>{c.time}</b><div><strong>{c.title}</strong><small>{c.detail}</small></div></div>) : <div className="empty-state">No timetable published yet.</div>}</div>
              <div className="cr-panel"><div className="cr-panel-head"><h2>⚡ Quick Actions</h2><small>Actions that update your class data</small></div><div className="cr-actions-grid"><button onClick={()=>document.querySelector('.cr-publish')?.scrollIntoView({behavior:'smooth'})}><span>📢</span>Make<br/>Announcement</button><button onClick={()=>crOpen('Share with Class')}><span>👥</span>Share with<br/>Class</button><button onClick={createPoll}><span>▤</span>Create<br/>Poll / Feedback</button><button onClick={raiseIssue}><span>!</span>Raise<br/>an Issue</button></div></div>
              <div className="cr-panel announcements-panel"><div className="cr-panel-head"><h2>📢 Recent Announcements</h2><button onClick={()=>crOpen('Announcements')}>View All →</button></div>{crAnnouncements.map((a,i)=><div className="cr-announcement" key={`${a.id || a.title}-${i}`}><span>{i===0?'▤':i===1?'▣':'👥'}</span><div><strong>{a.title || a}</strong><small>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'Recent'}</small><p>{a.body || ''}</p></div></div>)}</div>
            </section>
            <section className="cr-command">
              <div className="cr-panel cr-command-panel"><div className="cr-panel-head"><div><h2>🤖 AI Class Command Center</h2><small>Today’s priority queue, built from live class records.</small></div><button onClick={()=>crOpen('AI Class Command Center')}>Open →</button></div><div className="cr-queue">{crIntel.queue.slice(0,4).map(q=><button key={q.key} className={`cr-queue-item ${q.level}`} onClick={()=>crOpen(q.to)}><i></i><div><b>{q.label}</b><small>{q.detail}</small></div><span>›</span></button>)}</div><div className="cr-command-actions"><button className="cr-primary" disabled={crBusy==='brief'} onClick={()=>crAsk('brief',`Give the class representative a short morning briefing. Real data: ${crIntel.openIssues.length} open issues, ${crIntel.byStatus('Pending')} assignments pending submission, attendance ${crIntel.present} of ${crIntel.cohort} (${crIntel.attendancePct}%), average subject progress ${crIntel.avgProgress}%, weakest subject ${crIntel.weakest[0]?.name||'none'}, ${crIntel.polls.length} active polls. Give 3 prioritised actions in 4 short sentences.`)}>{crBusy==='brief'?'Briefing…':'Generate today’s briefing'}</button><button className="cr-ghost" onClick={()=>crOpen('Anonymous Issue Box')}>🕶 Issue Box ({crIntel.openIssues.length})</button><button className="cr-ghost" onClick={()=>crOpen('Timetable & Events')}>🗓 Events ({crEvents.length})</button></div>{crOut&&<pre className="cr-ai-out">{crOut}</pre>}</div>
              <div className="cr-panel cr-events-panel"><div className="cr-panel-head"><div><h2>🗓 Upcoming Events</h2><small>Events you manage as CR.</small></div><button onClick={()=>crOpen('Timetable & Events')}>Manage →</button></div>{crEvents.length ? <div className="cr-event-list">{crEvents.slice(0,4).map(e=><div className="cr-event" key={e.id}><time>{e.date||'TBD'}</time><div><b>{e.title}</b><small>{e.type} • {e.venue||'Campus'}</small></div></div>)}</div> : <div className="empty-state">No events yet. Add one from Timetable &amp; Events.</div>}</div>
            </section>
            <section className="cr-bottom-grid">
              <div className="cr-panel cr-publish"><div className="cr-panel-head"><div><h2>Make an Announcement</h2><small>Publish it to the backend and class feed.</small></div><button className="cr-ai-gen" disabled={crBusy==='gen'} onClick={async()=>{const t=await crAsk('gen',`Write a short class announcement for CSE Semester I. Real situation: ${crIntel.byStatus('Pending')} assignments pending submission, attendance ${crIntel.attendancePct}%, weakest subject ${crIntel.weakest[0]?.name||'none'}. Reply with exactly two lines: a TITLE line starting with "TITLE: " and a BODY line starting with "BODY: ". Keep the body under 60 words and end with one clear ask.`);if(!t)return;const m=t.match(/TITLE:\s*(.+)\n[\s\S]*?BODY:\s*([\s\S]+)/i);const title=m?m[1].trim().split('\n')[0]:'Class Update — Reminder';const body=m?m[2].trim():t;setAnnouncement(body);const el=document.getElementById('cr-title');if(el)el.value=title;showToast('AI draft ready — review and publish.');setCrOut('');}}>{crBusy==='gen'?'✦ Generating…':'✨ Generate with AI'}</button></div><input className="cr-input" id="cr-title" placeholder="Announcement title"/><textarea className="cr-input" rows="3" placeholder="Write your class announcement..." value={announcement} onChange={e => setAnnouncement(e.target.value)} /><button className="cr-primary" onClick={async()=>{const title=document.getElementById('cr-title')?.value?.trim() || 'Class Announcement';if(!announcement.trim())return showToast('Write an announcement first.');await publishAnnouncement(title,announcement.trim());setAnnouncement('');document.getElementById('cr-title').value='';}}>Publish to Class →</button></div>
              <div className="cr-panel cr-upcoming"><div className="cr-panel-head"><h2>Class Data</h2><small>Live backend records</small></div><div className="cr-item"><span>📊</span><div><strong>{polls.length} Active Polls</strong><small>Create and collect class feedback.</small></div></div><div className="cr-item"><span>!</span><div><strong>{issues.length} Issues Raised</strong><small>{issues.filter(i=>i.status==='Open').length} currently open.</small></div></div><div className="cr-item"><span>📢</span><div><strong>{announcements.length} Announcements</strong><small>Stored in the class feed.</small></div></div></div>
            </section>
            <section className="cr-banner"><span>🌱</span><strong>Together We Make a Better Class.</strong><em>“Student Voice. Stronger Campus.”</em></section>
          </div>
        </main>
      </div>
    </div>;
  };

  let content = renderDashboard();
  if (active === "Resources") content = renderResources();
  else if (active === "Syllabus") { if (!syllabusData) loadSyllabus(); content = renderSyllabus(); }
  else if (active === "Assignments") content = renderAssignments();
  else if (active === "Question Practice") content = renderQuestionPractice();
  else if (active === "Academic Records") content = renderAcademicRecords();
  else if (active === "Certificates") content = renderCertificates();
  else if (active === "Help & Support") content = renderSupport();
  else if (active === "Community") content = renderCommunity();
  else if (active === "Faculty") content = renderFaculty();
  else if (active === "CR") content = renderCR();
  else if (active === "AI Assistant") content = renderAI();
  else if (["Academic Twin","Exam Readiness","30-Min Rescue","Exam Night Mode","AI Summary","AI Viva Simulator","Learning Path","AI Mentorship","My Timetable","Mock Tests","Subjects","Smart Revision Hub","Placement & Career Hub"].includes(active)) {
    const data = {
      "Academic Twin": ["Academic Twin", "Your personal learning profile and weak-topic map.", "🧠", "Programming is currently your strongest area. Integration in Engineering Mathematics needs attention."],
      "Exam Readiness": ["Exam Readiness", "Know how prepared you are before exam day.", "◎", "Overall readiness: 78%. Recommended next step: revise Integration and solve 10 PYQs."],
      "30-Min Rescue": ["30-Min Rescue", "A focused emergency plan when time is short.", "⏱", "10 min formulas + 10 min PYQs + 10 min self-test. Stay focused and avoid distractions."],
      "Smart Revision Hub": ["Smart Revision Hub", "Notes, PYQs and AI revision cards in one place.", "✦", "Pick a subject and generate a one-page revision card instantly."],
      "Placement & Career Hub": ["Placement & Career Hub", "Resume, internships, aptitude and roadmap.", "🚀", "Build your placement profile and practise aptitude rounds."],
      "Exam Night Mode": ["Exam Night Mode", "Your final revision kit in one place.", "☾", "AI summary, formulas, PYQs, mock test and focus timer are ready."],
      "AI Summary": ["AI Summary", "Turn long notes into quick revision material.", "✦", "Choose a resource and CampusAI will prepare a concise revision outline in this demo."],
      "AI Viva Simulator": ["AI Viva Simulator", "Practice questions before the real viva.", "🎙", "Engineering Physics • 5 questions • instant feedback mode."],
      "Learning Path": ["Learning Path", "Follow Concept → Learn → Practice → PYQ → Test.", "🧭", "Your next recommended step is Practice: solve 10 Programming questions before moving to PYQs."],
      "AI Mentorship": ["Live AI Mentorship", "Get guidance when you are stuck.", "👩🏻‍💻", "Next session: Today, 5:00 PM — DSA Problem Solving."],
      "Mock Tests": ["Mock Tests", "Practice under exam-like conditions.", "📝", "Your Engineering Mathematics mini mock is ready with 20 questions."],
      "Subjects": ["My Subjects", "Six active subjects for Semester 1.", "▦", "Select a subject below to open its resources."]
    }[active];
    content = active === "Subjects" ? <><div className="page-title"><div><div className="eyebrow">MY LEARNING</div><h1>My Subjects</h1><p>{data[1]}</p></div></div><div className="subject-grid">{(serverData?.subjects || subjects).map(s=><div className="subject-card" key={s.code} onClick={()=>openSubject(s)}><div className={`subject-icon ${s.color}`}>{s.icon}</div><div className="subject-info"><span>{s.code}</span><h3>{s.name}</h3><small>Faculty: {s.faculty || 'Campus Faculty'}</small><div className="progress-row"><div className="progress"><i style={{width:`${s.progress}%`}}/></div><b>{s.progress}%</b></div></div><span className="arrow">→</span></div>)}</div></> : renderStudentTool(active);
  }

  const saveAssignmentFromWorkspace = async () => {
    const title = document.getElementById('ws-title')?.value?.trim();
    const subject = document.getElementById('ws-subject')?.value?.trim() || 'Programming';
    const deadline = document.getElementById('ws-deadline')?.value || '2026-10-05';
    if (!title) return showToast('Assignment title is required.');
    try { const r=await api('/api/assignments',{method:'POST',body:JSON.stringify({title,subject,deadline,role:'Faculty'})}); await refreshDashboard(); closeWorkspace(); showToast(`Assignment '${r.assignment.title}' saved successfully.`); } catch(e){showToast(e.message);}
  };
  const generateQuestionPaper = async () => {
    const subject=document.getElementById('qp-subject')?.value || 'Programming';
    const count=Number(document.getElementById('qp-count')?.value || 10);
    const difficulty=document.getElementById('qp-level')?.value || 'Mixed';
    try { const r=await api('/api/question-papers',{method:'POST',body:JSON.stringify({subject,count,difficulty,role:'Faculty'})}); setWorkspace(w=>({...w,generatedPaper:r.paper})); showToast('Question paper generated and saved.'); } catch(e){showToast(e.message);}
  };
  const downloadResource = (resource) => {
    const text=`CampusLMS Resource\n\n${resource.title}\nSubject: ${resource.subject}\nType: ${resource.type}\n\n${resource.content || 'Resource content available in CampusLMS.'}`;
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${resource.title.replace(/[^a-z0-9]+/gi,'_')}.txt`; a.click(); URL.revokeObjectURL(url); showToast('Resource downloaded successfully.');
  };
  const updateWorkflowStep = async (step) => {
    try { const done = workflowStep === step ? true : step < workflowStep; await api(`/api/workflows/${step}`,{method:'PATCH',body:JSON.stringify({done:true})}); setWorkflowStep(Math.max(workflowStep,step+1)); showToast(`Step ${step+1} completed and saved.`); } catch(e){showToast(e.message);}
  };

  const renderWorkspace = () => {
    if (!workspace) return null;
    const a = workspace.action || workspace.title || "";
    const isAssignment = role === 'Faculty' && /assignment/i.test(a) && !/submit/i.test(a);
    const isCRAssignment = role === 'CR' && /assignment/i.test(a);
    const isSchedule = /schedule|timetable/i.test(a) || a === 'My Class Schedule';
    const isAttendance = role === 'Faculty' && /attendance/i.test(a);
    const isCRAttendance = role === 'CR' && /attendance/i.test(a);
    const isQuestion = /question paper/i.test(a);
    const isResource = a === "resource";
    const isAssignmentPreview = a === 'assignment-preview';
    const isAssignmentEvaluation = a === 'assignment-evaluation';
    const isNotifications = a === 'Notification Center';
    const isAcademicTwin = a === 'academic-twin';
    const isStudentSubjects = a === 'student-subjects';
    const isStudentAssignmentsSummary = a === 'student-assignments-summary';
    const isStudentProgress = a === 'student-progress';
    const isStudentExams = a === 'student-exams';
    const isAcademicInsights = a === 'academic-insights';
    const isStudentTimetable = a === 'student-timetable';
    const isMentorship = a === 'mentorship';
    const isFacultyHandoff = a === 'faculty-handoff';
    const isFacultyAnalytics = /Class Analytics|AI Reports/i.test(a);
    const isFacultyRisk = /Real AI Risk|At-Risk Students/i.test(a);
    const isV16Heat = a === 'AI Doubt Heatmap';
    const isV16Rescue = a === 'AI Concept Rescue';
    const isV16Parent = a === 'AI Parent Connect';
    const isV16Plans = /AI Personalized Learning|Content Recommendations/i.test(a);
    const isCrCommand = a === 'AI Class Command Center';
    const isCrIssueBox = a === 'Anonymous Issue Box';
    const isCrAnnounce = a === 'Smart Announcement Generator';
    const isCrAnalytics = a === 'Class Analytics';
    const isCrStudents = a === 'Student Manager';
    const isCrEvents = a === 'Timetable & Events';
    const isFacultyTickets = /Doubt Tickets/i.test(a);
    const isFacultyRemedial = /Remedial Session Planner|Plan Support|Remedial Session/i.test(a);
    const isFacultyGrading = /Smart Grading|Review PDF/i.test(a);
    const isFacultyCourses = a === 'My Courses';
    const isFacultyAssessments = a === 'Assessments';
    const isFacultyResources = a === 'Faculty Resources';
    const isFacultyAnnouncements = a === 'Announcements';
    const isFacultyFeedback = a === 'Feedback & Surveys';
    const isFacultyAttendance = a === 'Attendance';
    const isFacultySchedule = a === 'Schedule Class';
    const isAI = /AI Assistant|Faculty AI|AI Reports|Content Recommendations|Smart Grading|Remedial/i.test(a);
    const isViva = /Viva/i.test(a);
    const isMock = /Mock/i.test(a);
    const isSummary = /Summary/i.test(a);
    const isStudy = /Learning Path|Study Planner|30-Min|Exam Night|Readiness|Academic Twin|Mentorship/i.test(a);
    const isAnnouncement = /Announcement|Share with Class/i.test(a);
    const isPoll = /Poll/i.test(a);
    const isIssue = /Issue|Doubt Ticket/i.test(a);
    const title = workspace.title || "CampusLMS Workspace";
    const currentFacultySubjects = facultyDirectory.find(f=>f.id===facultyId)?.subjects || [];
    const steps=["Review your current weak topic","Practice 5 targeted questions","Complete a PYQ set","Take a mini test"];
    return <div className="workspace-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeWorkspace()}><div className="workspace-modal">
      <div className="workspace-head"><div><span className="eyebrow">LIVE WORKSPACE</span><h2>{title}</h2></div><button onClick={closeWorkspace}>✕</button></div>
      {isStudentSubjects ? <div className="workspace-body"><h3>My Subjects — Live Backend Data</h3><p>These subjects are loaded from the CampusLMS backend.</p><div className="workspace-list">{(workspace.data?.subjects||[]).map(s=><div key={s.code}><b>{s.code}</b><span><strong>{s.name}</strong> • {s.progress}% • {s.status}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Subject Data</button></div>
      : isStudentAssignmentsSummary ? <div className="workspace-body"><h3>Pending Assignments — Live Backend Data</h3><p>{workspace.data?.count||0} assignment(s) currently require action.</p><div className="workspace-list">{(workspace.data?.pending||[]).map(a=><div key={a.id}><b>{a.status}</b><span><strong>{a.title}</strong> • {a.subject} • Due {a.deadline}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Assignment Data</button></div>
      : isStudentProgress ? <div className="workspace-body"><h3>Learning Progress — Live Backend Data</h3><div className="attendance-big"><strong>{workspace.data?.progress||0}%</strong><span>Average progress across all subjects</span></div><div className="workspace-list">{(workspace.data?.subjects||[]).map(s=><div key={s.code}><b>{s.progress}%</b><span><strong>{s.name}</strong> • {s.status}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Progress</button></div>
      : isStudentExams ? <div className="workspace-body"><h3>Upcoming Exams — Live Backend Data</h3><p>{workspace.data?.count||0} upcoming exam(s) are scheduled.</p><div className="workspace-list">{(workspace.data?.exams||[]).map(e=><div key={e.id}><b>{e.date}</b><span><strong>{e.title}</strong> • {e.subject}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Exam Data</button></div>
      : isAcademicTwin ? <div className="workspace-body"><h3>Academic Twin — Live Analysis</h3><p>This analysis is calculated from the backend student profile.</p><div className="workspace-list">{(workspace.data?.profile||[]).map(x=><div key={x.name}><b>{x.name}</b><span>{x.progress}% • {x.status}</span></div>)}</div><div className="ai-result"><b>Strongest:</b> {workspace.data?.strongest?.name} ({workspace.data?.strongest?.progress}%)<br/><b>Needs attention:</b> {workspace.data?.weakest?.name} ({workspace.data?.weakest?.progress}%)<p>{workspace.data?.recommendation}</p></div><button className="solid-button" onClick={async()=>{await saveStudentTool('Academic Twin',{analysis:workspace.data,updatedAt:new Date().toISOString()});showToast('Academic Twin analysis saved to backend.');}}>Save Analysis</button></div>
      : isAcademicInsights ? <div className="workspace-body"><h3>Academic Insights</h3><p>Live recommendations generated from backend academic data.</p><div className="workspace-list">{(workspace.data?.insights||[]).map(x=><div key={x.id}><b>{x.title}</b><span>{x.detail}</span><em>{x.action}</em></div>)}</div><button className="solid-button" onClick={async()=>{await saveStudentTool('Academic Insights',{insights:workspace.data?.insights||[],viewedAt:new Date().toISOString()});showToast('Insights viewed and saved.');}}>Save Insight Review</button></div>
      : isStudentTimetable ? <div className="workspace-body"><h3>Upcoming Classes</h3><p>Timetable loaded from the CampusLMS backend.</p><div className="workspace-list">{(workspace.data?.timetable||[]).map(x=><div key={x.id}><b>{x.time}</b><span><strong>{x.title}</strong> • {x.detail}</span></div>)}</div><button className="solid-button" onClick={()=>showToast('Timetable is already loaded from the backend.')}>Confirm Timetable</button></div>
      : isMentorship ? <div className="workspace-body"><h3>Live AI Mentorship</h3><p>Join or book a real session record. The action is saved in the backend.</p><div className="ai-result"><b>{workspace.data?.next?.title}</b><p>{workspace.data?.next?.time} • {workspace.data?.next?.mentor}</p></div>{workspace.data?.latest&&<div className="success-message">✓ Latest action: {workspace.data.latest.status}</div>}<div className="workspace-actions"><button className="solid-button" onClick={()=>mentorshipAction('join')}>Join Session</button><button className="secondary-button" onClick={()=>mentorshipAction('book')}>Book Session</button></div><h3>Saved Sessions</h3><div className="workspace-list">{(workspace.data?.sessions||[]).slice(0,5).map(x=><div key={x.id}><b>{x.status}</b><span>{x.title} • {x.time}</span></div>)}</div></div>
      : isFacultyHandoff ? <div className="workspace-body"><h3>AI → Faculty Handoff</h3><p>Create a real support ticket so a faculty member can follow it up.</p><input className="workspace-answer" id="handoff-title" placeholder="What do you need help with?"/><textarea className="workspace-answer" id="handoff-description" rows="5" placeholder="Describe your doubt or problem..."></textarea><button className="solid-button" onClick={createFacultyHandoff}>Send to Faculty</button></div>
      : isNotifications ? <div className="workspace-body"><h3>Notification Center</h3><p>New materials and assignment deadlines create backend notification records. Telegram/WhatsApp bridge endpoints can receive the same event payload.</p><div className="attendance-big"><strong>{workspace.data?.health?.records?.notifications||0}</strong><span>notification records • DB schema v{workspace.data?.health?.schemaVersion||'?'}</span></div><div className="workspace-form"><label>Provider<select id="webhook-provider"><option>Telegram Bridge</option><option>WhatsApp Bridge</option><option>Generic Webhook</option></select></label><label>Name<input id="webhook-name" placeholder="College notification bridge"/></label><label>Webhook URL<input id="webhook-url" placeholder="https://your-bridge.example/webhook"/></label><label>Secret (optional)<input id="webhook-secret" type="password" placeholder="Shared secret"/></label></div><div className="workspace-actions"><button className="solid-button" onClick={configureWebhook}>Save Webhook</button><button className="secondary-button" onClick={sendNotificationTest}>Send Test Notification</button><button className="secondary-button" onClick={openNotifications}>Refresh</button></div><div className="workspace-list">{(workspace.data?.webhooks||[]).map(h=><div key={h.id}><b>{h.provider}</b><span>{h.name} • {h.url}</span><em>{h.enabled===false?'Disabled':'Enabled'}</em></div>)}</div><div className="workspace-list">{(workspace.data?.notifications||[]).map(n=><div key={n.id}><b>{n.type}</b><span><strong>{n.title}</strong> • {n.body}</span><em>{n.deliveries?.length?`${n.deliveries.length} webhook delivery attempt(s)`:'Outbox only'}</em></div>)}</div><div className="ai-result"><b>Database:</b> {workspace.data?.health?.integrity||'unknown'} • {workspace.data?.health?.records?.assignments||0} assignments • {workspace.data?.health?.records?.resources||0} resources • {workspace.data?.health?.records?.submissions||0} submissions.</div></div>
      : isAssignmentPreview ? <div className="workspace-body"><h3>{workspace.assignment?.title}</h3><p>{workspace.assignment?.subject} • Deadline {workspace.assignment?.deadline}</p>{workspace.file?.type==='application/pdf'?<iframe title="Assignment PDF preview" src={workspace.previewUrl} style={{width:'100%',height:'480px',border:'1px solid #ddd',borderRadius:'12px'}}/>:<div className="ai-result"><b>Selected file:</b> {workspace.file?.name} • {Math.round((workspace.file?.size||0)/1024)} KB<br/>Browser preview is available for PDF files.</div>}<textarea className="workspace-answer" id="submission-answer-text" rows="5" placeholder="Optional answer text for similarity detection across student submissions..."/><div className="workspace-actions"><button className="solid-button" onClick={()=>submitAssignment(workspace.assignment.id,workspace.file,document.getElementById('submission-answer-text')?.value||'')}>Submit Assignment</button><button className="secondary-button" onClick={closeWorkspace}>Cancel</button></div></div>
      : isAssignmentEvaluation ? <div className="workspace-body"><h3>{workspace.data?.assignment?.title}</h3><p>{workspace.data?.assignment?.subject} • Due {workspace.data?.assignment?.deadline} • {workspace.data?.submissions?.length||0} submission(s)</p>{(workspace.data?.submissions||[]).map(s=><div className="submission-row" key={s.id}><div className="avatar">{String(s.studentId||'ST').slice(-2)}</div><div style={{flex:1}}><strong>{s.studentId}</strong><span>{s.fileName} • {new Date(s.submittedAt).toLocaleString()} • {s.similarityFlags?.length?'Similarity flag':'No similarity flag'}</span>{s.similarityFlags?.length?<small>Potential duplicate/similar submission detected for faculty review.</small>:null}<input className="workspace-answer" id={`grade-${s.id}`} defaultValue={s.grade||''} placeholder="Grade (e.g. 8/10 or A)"/><textarea className="workspace-answer" id={`feedback-${s.id}`} defaultValue={s.feedback||''} rows="2" placeholder="Faculty feedback"/></div><div className="workspace-actions">{s.fileType==='application/pdf'&&s.content?<button className="secondary-button" onClick={()=>setWorkspace(w=>({...w,previewSubmission:s}))}>Preview PDF</button>:null}<button className="solid-button" onClick={()=>gradeSubmission(workspace.data.assignment.id,s.id)}>Save Grade</button></div></div>)}{workspace.previewSubmission?.content&&<div className="reader-content"><h4>In-browser PDF Preview</h4><iframe title="Submission PDF" src={workspace.previewSubmission.content} style={{width:'100%',height:'420px',border:'1px solid #ddd',borderRadius:'12px'}}/></div>}<button className="secondary-button" onClick={()=>openAssignmentEvaluation(workspace.data.assignment.id)}>Refresh Evaluation</button></div>
      : isResource ? <div className="workspace-body"><div className="resource-preview"><div className="resource-file large">{workspace.resource?.type === "Lecture" ? "▶" : workspace.resource?.type === "PYQ" ? "Q" : workspace.resource?.type === "PPT" ? "P" : "N"}</div><h3>{workspace.resource?.title}</h3><p>{workspace.resource?.subject} • {workspace.resource?.type} • {workspace.resource?.size || "Online"}</p>{readerOpen ? <div className="reader-content"><h3>CampusLMS Reader</h3><p>{workspace.resource?.content || 'This resource is ready for reading.'}</p><div className="reader-note">✓ Reading session opened from the backend resource record.</div></div> : null}<div className="workspace-actions"><button className="solid-button" onClick={async()=>{setReaderOpen(true);await runAction('Resource reader opened',{resourceId:workspace.resource?.id});}}> {readerOpen ? 'Reader Opened ✓' : 'Open Reader'} </button><button className="secondary-button" onClick={()=>downloadResource(workspace.resource)}>Download</button><button className="secondary-button" onClick={()=>{setWorkspace(null);setAiInput(`Summarize ${workspace.resource?.title}`);go("AI Assistant");}}>Ask CampusAI</button></div></div></div>
      : isAssignment ? <div className="workspace-body"><h3>Assignment workflow</h3><p>Create, publish and then track submissions from the backend.</p><div className="workspace-form"><label>Title<input defaultValue="New CSE Assignment" id="ws-title"/></label><label>Subject<input defaultValue="Programming" id="ws-subject"/></label><label>Deadline<input type="date" defaultValue="2026-10-05" id="ws-deadline"/></label></div><button className="solid-button" onClick={saveAssignmentFromWorkspace}>Save & Publish Assignment</button></div>
      : isQuestion ? <div className="workspace-body"><h3>Question Paper Generator</h3><p>Generate a real question-paper record with questions and settings saved to the backend.</p><div className="workspace-form"><label>Subject<select id="qp-subject">{['Introduction to AI','Programming for Problem Solving (PPS)','Engineering Mathematics-I','Engineering Physics','Basic Electrical & Electronics Engineering (BEEE)','Universal Human Values'].filter(s=>!currentFacultySubjects.length||currentFacultySubjects.includes(s)).map(s=><option key={s}>{s}</option>)}</select></label><label>Questions<select id="qp-count"><option>10</option><option>20</option><option>30</option></select></label><label>Difficulty<select id="qp-level"><option>Mixed</option><option>Easy</option><option>Medium</option><option>Hard</option></select></label></div><button className="solid-button" onClick={generateQuestionPaper}>Generate & Save</button>{workspace.generatedPaper&&<div className="generated-paper"><h3>Generated Paper</h3>{workspace.generatedPaper.questions.map(q=><div key={q.number}><b>{q.number}.</b> {q.question}</div>)}</div>}</div>
      : isCRAssignment ? <div className="workspace-body"><h3>Class Assignments</h3><p>View assignment deadlines and submission status from the live backend.</p><div className="workspace-list">{(serverData?.assignments||[]).map(item=><div key={item.id}><b>{item.status}</b><span><strong>{item.title}</strong> • {item.subject} • Due {item.deadline}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Assignment Data</button></div>
      : isAttendance ? <div className="workspace-body"><h3>Live Attendance</h3><div className="attendance-big"><strong>{serverData?.attendance?.present || 54}/{serverData?.attendance?.total || 62}</strong><span>Present today</span></div><p>Update the attendance count and save it to the backend.</p><div className="workspace-form one"><label>Present students<input type="number" min="0" max={serverData?.attendance?.total || 62} id="present-count" defaultValue={serverData?.attendance?.present || 54}/></label></div><button className="solid-button" onClick={async()=>{const present=Number(document.getElementById('present-count')?.value);const r=await api('/api/attendance',{method:'POST',body:JSON.stringify({present,role:'Faculty'})});setServerData(d=>({...d,attendance:r.attendance}));showToast(`Attendance saved: ${r.attendance.present}/${r.attendance.total}.`);}}>Save Attendance</button></div>
      : isCRAttendance ? <div className="workspace-body"><h3>Class Attendance</h3><div className="attendance-big"><strong>{serverData?.attendance?.present || 54}/{serverData?.attendance?.total || 62}</strong><span>Present today</span></div><p>This view is read-only for the CR and is loaded from the backend.</p><button className="solid-button" onClick={refreshDashboard}>Refresh Attendance</button></div>
      : isSchedule ? <div className="workspace-body"><h3>Class & Timetable</h3><p>Live schedule records from the backend.</p><div className="workspace-list">{(serverData?.schedules||[]).map(c=><div key={c.id}><b>{c.time}</b><span><strong>{c.title}</strong> • {c.detail}</span></div>)}</div><button className="solid-button" onClick={()=>showToast('Timetable is loaded from the backend.')}>Confirm Schedule</button></div>
      : isViva ? <div className="workspace-body"><h3>AI Viva Simulator</h3><p>Answer the question and get feedback from CampusAI.</p><div className="viva-question"><b>Question 1</b><h3>Explain the difference between a stack and a queue.</h3></div><textarea className="workspace-answer" id="viva-answer" rows="4" placeholder="Type your answer here..."></textarea><button className="solid-button" onClick={async()=>{const v=document.getElementById('viva-answer')?.value||'';if(!v.trim())return showToast('Write an answer first.');setWorkspace(null);setAiInput(`Evaluate my viva answer: ${v}`);go('AI Assistant');}}>Submit for AI Feedback</button></div>
      : isMock ? <div className="workspace-body"><h3>Mock Test</h3><p>Complete the question, submit it, and receive a saved result.</p><div className="mock-question"><b>Q1.</b> Which data structure follows LIFO?<label><input type="radio" name="mock" value="Stack"/> Stack</label><label><input type="radio" name="mock" value="Queue"/> Queue</label><label><input type="radio" name="mock" value="Tree"/> Tree</label></div><button className="solid-button" onClick={async()=>{const chosen=document.querySelector('input[name="mock"]:checked')?.value||'Not answered';const r=await api('/api/student-dashboard/mock-tests',{method:'POST',body:JSON.stringify({answer:chosen,studentId:'CSE26-001'})});showToast(r.message);}}>Submit Test</button></div>
      : isSummary ? <div className="workspace-body"><h3>AI Summary</h3><p>Paste notes or a topic. CampusAI will create a concise revision response.</p><textarea className="workspace-answer" id="summary-text" rows="6" placeholder="Paste notes or type a topic..."></textarea><button className="solid-button" onClick={()=>{const v=document.getElementById('summary-text')?.value||'';if(!v.trim())return showToast('Add notes or a topic first.');setWorkspace(null);setAiInput(`Summarize this for revision: ${v}`);go('AI Assistant');}}>Generate Summary</button></div>
      : isStudy ? <div className="workspace-body"><h3>Smart Academic Workflow</h3><p>Complete each stage. Every completed step is saved to the CampusLMS backend.</p><div className="workflow-progress"><div><strong>{Math.min(workflowStep,4)}/4</strong><span>steps completed</span></div><div className="workflow-bar"><i style={{width:`${Math.min(workflowStep,4)*25}%`}}/></div></div><div className="workspace-list">{steps.map((step,i)=><button className={`workflow-step ${i<workflowStep?'done':''} ${i===workflowStep?'current':''}`} key={step} onClick={()=>i===workflowStep&&updateWorkflowStep(i)}><b>{i<workflowStep?'✓':i+1}</b><span>{step}</span>{i===workflowStep&&<em>Complete</em>}</button>)}</div>{workflowStep>=4?<div className="success-message">✓ Workflow completed and saved. Your next study session is ready.</div>:<button className="solid-button" onClick={()=>updateWorkflowStep(workflowStep)}>Complete Step {workflowStep+1} →</button>}</div>
      : isAnnouncement ? <div className="workspace-body"><h3>Announcement workflow</h3><p>Write, publish and verify the class announcement.</p><input className="workspace-answer" id="ws-ann-title" placeholder="Announcement title"/><textarea className="workspace-answer" id="ws-ann-body" rows="5" placeholder="Announcement message"></textarea><button className="solid-button" onClick={async()=>{const t=document.getElementById('ws-ann-title')?.value?.trim()||'Class Announcement';const b=document.getElementById('ws-ann-body')?.value?.trim();if(!b)return showToast('Write the announcement first.');await publishAnnouncement(t,b);closeWorkspace();}}>Publish to Backend</button></div>
      : isPoll ? <div className="workspace-body"><h3>Create Poll & Feedback</h3><p>Collect a real response from your class and store it in the backend.</p><input className="workspace-answer" id="poll-question" placeholder="Poll question"/><button className="solid-button" onClick={async()=>{const q=document.getElementById('poll-question')?.value?.trim();if(!q)return showToast('Enter a poll question.');await api('/api/polls',{method:'POST',body:JSON.stringify({question:q,options:['Mathematics','Physics','Programming'],createdBy:'CR-CSE-01'})});await refreshDashboard();closeWorkspace();showToast('Poll created and saved.');}}>Create Poll</button></div>
      : isIssue ? <div className="workspace-body"><h3>Issue / Doubt Ticket</h3><p>Create a trackable issue instead of a demo-only confirmation.</p><input className="workspace-answer" id="issue-title" placeholder="Issue title"/><textarea className="workspace-answer" id="issue-desc" rows="4" placeholder="Describe the issue"></textarea><button className="solid-button" onClick={async()=>{const t=document.getElementById('issue-title')?.value?.trim();const d=document.getElementById('issue-desc')?.value?.trim()||'';if(!t)return showToast('Enter an issue title.');const r=await api('/api/issues',{method:'POST',body:JSON.stringify({title:t,description:d,raisedBy:'CR-CSE-01'})});await refreshDashboard();closeWorkspace();showToast(`Issue #${r.issue.id} created and is now trackable.`);}}>Create Issue</button></div>
      : isFacultyCourses ? <div className="workspace-body"><h3>My Courses</h3><p>Courses are scoped to the logged-in faculty member.</p><div className="workspace-list">{(workspace.data?.courses||[]).map(c=><div key={c}><b>{c}</b><span>Semester I • CSE (IoT)</span></div>)}</div></div>
      : isFacultyAssessments ? <div className="workspace-body"><h3>Assessments & Evaluation Engine</h3><p>Deadline status, submissions, similarity flags and grading are all stored in the backend.</p><div className="workspace-list">{(workspace.data?.assignments||[]).map(x=><div key={x.id}><b>{x.title}</b><span>{x.subject} • Due {x.deadline} • {x.status} • {x.submissions?.length||0} submissions</span><button className="secondary-button" onClick={()=>openAssignmentEvaluation(x.id)}>Evaluate / Preview</button></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Assessments</button></div>
      : isFacultyResources ? <div className="workspace-body"><h3>Faculty Resource Vault</h3><p>Resources are published into Department &gt; Semester &gt; Subject &gt; Module and immediately appear for students.</p><div className="workspace-form"><label>Title<input id="resource-title" placeholder="e.g. AI Unit 2 Lecture Notes"/></label><label>Subject<select id="resource-subject">{currentFacultySubjects.map(s=><option key={s}>{s}</option>)}</select></label><label>Module<input id="resource-module" placeholder="Module 1: AI Foundations"/></label><label>Type<select id="resource-type"><option>Notes</option><option>PPT</option><option>PYQ</option><option>Lecture</option></select></label><label>Content<textarea id="resource-content" rows="4" placeholder="Paste notes/lecture summary or resource description"/></label></div><button className="solid-button" onClick={async()=>{const title=document.getElementById('resource-title')?.value?.trim();const subject=document.getElementById('resource-subject')?.value;const module=document.getElementById('resource-module')?.value?.trim()||'Module 1';const type=document.getElementById('resource-type')?.value;const content=document.getElementById('resource-content')?.value?.trim()||'Published faculty resource.';if(!title||!subject)return showToast('Title and subject are required.');try{const r=await api('/api/resources',{method:'POST',body:JSON.stringify({title,subject,module,type,content,department:'Computer Science & Engineering (IoT)',semester:'Semester I',role:'Faculty'})});setWorkspace(w=>({...w,data:{...w.data,resources:[r.resource,...(w.data?.resources||[])]}}));showToast('Resource published and student notification created.');}catch(e){showToast(e.message)}}}>Publish Resource</button><div className="workspace-list">{(workspace.data?.resources||[]).map(r=><div key={r.id}><b>{r.title}</b><span>{r.subject} • {r.module} • {r.type}</span></div>)}</div></div>
      : isFacultyAnnouncements ? <div className="workspace-body"><h3>Announcements</h3><p>Live announcements stored in the backend.</p><div className="workspace-list">{(workspace.data?.announcements||[]).map(x=><div key={x.id}><b>{x.title}</b><span>{x.body}</span></div>)}</div><button className="solid-button" onClick={()=>openRoleWorkspace('Announcement',{area:'Faculty Dashboard'})}>Create Announcement</button></div>
      : isFacultyFeedback ? <div className="workspace-body"><h3>Feedback & Surveys</h3><p>Poll records stored in the backend.</p><div className="workspace-list">{(workspace.data?.polls||[]).map(x=><div key={x.id}><b>{x.question}</b><span>{x.options?.join(' • ')}</span></div>)}</div><button className="solid-button" onClick={()=>openRoleWorkspace('Poll',{area:'Faculty Dashboard'})}>Create Survey</button></div>
      : isFacultyAttendance ? <div className="workspace-body"><h3>Attendance</h3><p>Current attendance record from the backend.</p><div className="attendance-big"><strong>{workspace.data?.attendance ? Math.round(workspace.data.attendance.present*100/workspace.data.attendance.total) : 0}%</strong><span>{workspace.data?.attendance?.present||0} present / {workspace.data?.attendance?.total||0} total</span></div><input className="workspace-answer" id="faculty-present" type="number" min="0" placeholder="Update present count"/><button className="solid-button" onClick={async()=>{const v=Number(document.getElementById('faculty-present')?.value);if(!Number.isFinite(v))return showToast('Enter a valid present count.');const r=await api('/api/attendance',{method:'POST',body:JSON.stringify({present:v,role:'Faculty'})});setWorkspace(w=>({...w,data:{attendance:r.attendance}}));showToast('Attendance updated and saved.');}}>Save Attendance</button></div>
      : isFacultySchedule ? <div className="workspace-body"><h3>Schedule Class</h3><p>View the live Semester I schedule or add a class record.</p><div className="workspace-list">{(workspace.data?.schedules||[]).map(c=><div key={c.id}><b>{c.time}</b><span>{c.title} • {c.detail}</span></div>)}</div><div className="workspace-form"><label>Title<input id="schedule-title" placeholder="Class title"/></label><label>Time<input id="schedule-time" placeholder="06:00 PM"/></label><label>Room<input id="schedule-room" placeholder="CSE Lab 1"/></label></div><button className="solid-button" onClick={async()=>{const title=document.getElementById('schedule-title')?.value?.trim();const time=document.getElementById('schedule-time')?.value?.trim();if(!title||!time)return showToast('Title and time are required.');const r=await api('/api/schedules',{method:'POST',body:JSON.stringify({title,time,room:document.getElementById('schedule-room')?.value,faculty:facultyId,subject:currentFacultySubjects[0]||''})});setWorkspace(w=>({...w,data:{schedules:[...(w.data?.schedules||[]),r.schedule]}}));showToast('Class added to the backend schedule.');}}>Add Class</button></div>
      : isFacultyAnalytics ? <div className="workspace-body"><h3>Faculty Analytics</h3><p>Course performance is loaded from the backend.</p><div className="workspace-list">{(workspace.data?.courses||[]).map(x=><div key={x.name}><b>{x.name}</b><span>{x.average}% class average</span></div>)}</div><button className="solid-button" onClick={async()=>{const r=await api(`/api/faculty/analytics?facultyId=${encodeURIComponent(facultyId)}`);setWorkspace(w=>({...w,data:r}));showToast('Analytics refreshed from backend.');}}>Refresh Analytics</button></div>
      : isFacultyRisk ? <div className="workspace-body v16-body">
        <h3>Real AI Risk</h3>
        <p>Every figure below is derived from records already stored in the CampusLMS backend. Nothing here is hardcoded.</p>
        <div className="v16-sem-row"><span>Scope</span>{FACULTY_V16.semesters.map(s=><button key={s} className={facultySemester===s?'active':''} onClick={()=>{setFacultySemester(s);v16Persist({});}}>{s}</button>)}</div>
        {facultyIntel.exposure==null ? <div className="empty-state">No risk signal yet. This model needs subject progress, attendance or assignment records.</div> : <>
          <div className="v16-risk-top">
            <div className="v16-exposure"><strong>{facultyIntel.exposure}</strong><span>Cohort exposure</span><em>{FACULTY_V16.riskBands.find(b=>b.key===facultyIntel.band(facultyIntel.exposure))?.label}</em></div>
            <div className="v16-bands">{facultyIntel.bands.map(b=><div key={b.key} className={b.count?'on':''}><i style={{background:b.color}}></i><b>{b.label}</b><strong>{b.count==null?'—':b.count}</strong><small>of {facultyIntel.cohort} enrolled</small></div>)}</div>
          </div>
          <h4>Risk drivers</h4>
          <div className="v16-drivers">{facultyIntel.drivers.map(d=><div key={d.label} className={d.value==null?'muted':''}><div><b>{d.label}</b><small>{d.note} — {d.source}</small></div><div className="v16-bar"><i style={{width:`${Math.min(100,d.value||0)}%`}}></i></div><strong>{d.value==null?'no data':`${d.value}%`}</strong></div>)}</div>
          <h4>Per-subject breakdown</h4>
          <div className="v16-table"><div className="v16-tr v16-th"><span>Subject</span><span>Progress</span><span>Gap</span><span>Assignments</span><span>Resources</span><span>Band</span></div>{facultyIntel.subjectMetrics.map(s=>{const g=s.gap==null?null:Math.max(0,Math.round(100-s.progress));const b=g==null?null:g>=40?'high':g>=25?'at':'support';return <div className="v16-tr" key={s.name}><span>{s.name}</span><span>{s.known?`${s.progress}%`:'—'}</span><span>{g==null?'—':`${g}%`}</span><span>{s.assignments}</span><span>{s.resources}</span><span><em className={`band band-${b||'none'}`}>{b?FACULTY_V16.riskBands.find(x=>x.key===b).label:'No data'}</em></span></div>})}</div>
          <p className="v16-note">Student-level risk requires per-student records. The backend currently exposes cohort-level aggregates only, so this view reports cohort exposure and course-level risk instead of inventing named students.</p>
          <button className="solid-button" onClick={async()=>{await v16Ask('risk',`Draft a support plan for a ${FACULTY_V16.riskBands.find(b=>b.key===facultyIntel.band(facultyIntel.exposure))?.label} cohort. Average subject progress ${facultyIntel.avgProgress}%, attendance ${facultyIntel.attendancePct}%, weakest course ${facultyIntel.subjectMetrics.filter(s=>s.known).sort((a,b)=>a.progress-b.progress)[0]?.name||'n/a'}.`);setWorkspace(w=>({...w,action:'AI Concept Rescue',title:'AI Concept Rescue'}));}}>Generate a support plan with AI →</button>
          {v16Out&&<pre className="v16-ai-out">{v16Out}</pre>}
        </>}
      </div>
      : isV16Heat ? <div className="workspace-body v16-body">
        <h3>AI Doubt Heatmap</h3>
        <p>Concept heat = subject mastery gap, lifted by matching doubt tickets and pending evaluations. Cells with no published data are shown greyed rather than filled in.</p>
        <div className="v16-sem-row"><span>Scope</span>{FACULTY_V16.semesters.map(s=><button key={s} className={facultySemester===s?'active':''} onClick={()=>{setFacultySemester(s);v16Persist({});}}>{s}</button>)}</div>
        {!facultyIntel.concepts.length ? <div className="empty-state">No courses are mapped to this faculty account, so there is nothing to heat-map yet.</div> : <div className="v16-heat-groups">{facultyIntel.scope.map(sub=><div className="v16-heat-group" key={sub}><h4>{sub}<small>{facultyIntel.subjectMetrics.find(m=>m.name===sub)?.known?`${facultyIntel.subjectMetrics.find(m=>m.name===sub).progress}% progress`:'no progress record'}</small></h4><div className="v16-heat-grid">{facultyIntel.concepts.filter(c=>c.subject===sub).map(c=><button key={c.concept} className="v16-heat-cell" style={{'--h':c.heat==null?'#2b3240':`hsl(${Math.max(6,120-(c.heat/100)*120)} 70% ${34+(c.heat/100)*26}%)`,opacity:c.heat==null?.4:1}} onClick={()=>{const el=document.getElementById('v16-concept');if(el)el.value=c.concept;const s=document.getElementById('v16-concept-subject');if(s)s.value=c.subject;showToast(`${c.concept} — heat ${c.heat ?? 'n/a'}`);setWorkspace(w=>({...w,action:'AI Concept Rescue',title:'AI Concept Rescue'}));}}><b>{c.concept}</b><span>{c.heat==null?'no data':`${c.heat} heat`}</span><em>{c.signals} signal{c.signals===1?'':'s'}</em></button>)}</div></div>)}</div>}
        <div className="v16-legend"><span>Calm</span><i className="heat-scale"></i><span>Critical</span><em>Signals in play: {facultyIntel.tickets.length} doubt tickets • {facultyIntel.pendingEvaluations==null?'—':facultyIntel.pendingEvaluations} pending evaluations</em></div>
        <h4>Open doubt tickets</h4>
        {facultyIntel.tickets.length ? <div className="workspace-list">{facultyIntel.tickets.slice(0,10).map(t=><div key={t.id}><b>#{t.id} • {t.status}</b><span>{t.title} — {t.description}</span></div>)}</div> : <div className="empty-state">No doubt tickets are recorded in the backend for this cohort. Heat is therefore derived from mastery gap alone.</div>}
      </div>
      : isV16Rescue ? <div className="workspace-body v16-body">
        <h3>AI Concept Rescue</h3>
        <p>Generate a rescue explanation for a concept that the heatmap flagged, then publish it to your class.</p>
        <div className="workspace-form"><label>Subject<select id="v16-concept-subject">{facultyIntel.scope.map(s=><option key={s}>{s}</option>)}</select></label><label>Concept<select id="v16-concept">{facultyIntel.concepts.map(c=><option key={`${c.subject}-${c.concept}`} value={c.concept}>{c.concept}{c.heat==null?' (no data)':` (heat ${c.heat})`}</option>)}</select></label></div>
        <button className="solid-button" disabled={v16Busy==='rescue'} onClick={async()=>{const s=document.getElementById('v16-concept-subject')?.value;const c=document.getElementById('v16-concept')?.value;const m=facultyIntel.subjectMetrics.find(x=>x.name===s);await v16Ask('rescue',`Explain ${c} from ${s} to first-year engineering students. The cohort is at ${m?.known?`${m.progress}% course progress`:'unrecorded progress'} and cohort attendance is ${facultyIntel.attendancePct==null?'unknown':`${facultyIntel.attendancePct}%`}. Give a definition, a worked example, one common mistake and a quick self-check question.`);}}>{v16Busy==='rescue'?'Generating…':'Generate rescue explanation'}</button>
        {v16Out&&<pre className="v16-ai-out">{v16Out}</pre>}
        <div className="v16-form"><label>Note for students<textarea rows="3" defaultValue={v16Out} placeholder="The generated explanation is pre-filled — edit before publishing."></textarea></label><button className="solid-button" disabled={!v16Out} onClick={async()=>{const c=document.getElementById('v16-concept')?.value;const s=document.getElementById('v16-concept-subject')?.value;const body=document.querySelector('.v16-form textarea')?.value?.trim();if(!body)return showToast('Nothing to publish yet.');await v16Persist({rescues:[{concept:c,subject:s,semester:facultySemester,body,at:new Date().toISOString()},...facultyV16.rescues]});setV16Out('');showToast(`Rescue note for ${c} published to ${facultySemester}.`);}}>Publish to class</button></div>
        <h4>Published rescue notes</h4>
        {facultyV16.rescues.length ? <div className="workspace-list">{facultyV16.rescues.map((r,i)=><div key={`${r.at}-${i}`}><b>{r.concept}</b><span>{r.subject} • {r.semester} • {new Date(r.at).toLocaleString()}</span><p>{String(r.body).slice(0,240)}{String(r.body).length>240?'…':''}</p></div>)}</div> : <div className="empty-state">No rescue notes published yet.</div>}
      </div>
      : isV16Parent ? <div className="workspace-body v16-body">
        <h3>AI Parent Connect</h3>
        <p>Compose a guardian update. The numbers are injected from the live backend record for {facultySemester} — the AI only turns them into readable prose.</p>
        <div className="v16-facts"><div><small>Attendance</small><b>{facultyIntel.attendancePct==null?'not published':`${facultyIntel.attendancePct}%`}</b><span>{facultyIntel.attendance.present||0} of {facultyIntel.attendance.total||0} present</span></div><div><small>Avg course progress</small><b>{facultyIntel.avgProgress==null?'not published':`${facultyIntel.avgProgress}%`}</b><span>{facultyIntel.scope.length} subject{facultyIntel.scope.length===1?'':'s'}</span></div><div><small>Pending evaluations</small><b>{facultyIntel.pendingEvaluations==null?'—':facultyIntel.pendingEvaluations}</b><span>awaiting faculty review</span></div></div>
        <div className="workspace-form"><label>Audience<select id="v16-parent-audience"><option>Entire cohort — {facultyIntel.cohort} students</option>{facultyIntel.scope.map(s=><option key={s}>{s}</option>)}</select></label><label>Channel<select id="v16-parent-channel">{FACULTY_V16.parentChannels.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <button className="solid-button" disabled={v16Busy==='parent'} onClick={()=>v16Ask('parent',`Write a short, warm guardian update for the ${document.getElementById('v16-parent-audience')?.value||'cohort'} in ${facultySemester}. Real data: attendance ${facultyIntel.attendance.present} of ${facultyIntel.attendance.total} present (${facultyIntel.attendancePct}%), average course progress ${facultyIntel.avgProgress}%, ${facultyIntel.pendingEvaluations} assignments awaiting evaluation, weakest course ${facultyIntel.subjectMetrics.filter(s=>s.known).sort((a,b)=>a.progress-b.progress)[0]?.name||'none'}. Keep it to 4 short sentences and end with one concrete ask.`)}>{v16Busy==='parent'?'Drafting…':'Draft update with AI'}</button>
        {v16Out&&<pre className="v16-ai-out">{v16Out}</pre>}
        <div className="v16-form"><label>Final message<textarea rows="4" defaultValue={v16Out} placeholder="Draft appears here — edit before sending."></textarea></label><button className="solid-button" disabled={!v16Out} onClick={async()=>{const body=document.querySelector('.v16-form textarea')?.value?.trim();if(!body)return showToast('Draft the message first.');const entry={audience:document.getElementById('v16-parent-audience')?.value,channel:document.getElementById('v16-parent-channel')?.value,semester:facultySemester,body,at:new Date().toISOString()};await v16Persist({parentLog:[entry,...facultyV16.parentLog]});setV16Out('');showToast(`Guardian update logged for ${entry.audience}.`);}}>Send & log</button></div>
        <h4>Recent guardian updates</h4>
        {facultyV16.parentLog.length ? <div className="workspace-list">{facultyV16.parentLog.map((m,i)=><div key={`${m.at}-${i}`}><b>{m.audience}</b><span>{m.channel} • {m.semester} • {new Date(m.at).toLocaleString()}</span><p>{m.body}</p></div>)}</div> : <div className="empty-state">No guardian updates sent yet.</div>}
      </div>
      : isV16Plans ? <div className="workspace-body v16-body">
        <h3>AI Personalized Learning</h3>
        <p>Per-course remediation plans built from the measured mastery gap of each subject, not from generic templates.</p>
        <div className="v16-sem-row"><span>Scope</span>{FACULTY_V16.semesters.map(s=><button key={s} className={facultySemester===s?'active':''} onClick={()=>{setFacultySemester(s);v16Persist({});}}>{s}</button>)}</div>
        <div className="v16-plan-courses">{facultyIntel.subjectMetrics.map(s=>{const g=s.known?Math.max(0,100-s.progress):null;return <div key={s.name} className="v16-plan-course"><div><b>{s.name}</b><small>{s.known?`${s.progress}% progress • ${g}% gap • ${s.assignments} assignments • ${s.resources} resources`:`No progress record • ${s.assignments} assignments • ${s.resources} resources`}</small></div><div className="v16-bar"><i style={{width:`${s.known?s.progress:0}%`}}></i></div><button className="secondary-button" disabled={!s.known} onClick={async()=>{const weak=facultyIntel.concepts.filter(c=>c.subject===s.name).sort((a,b)=>(b.heat||0)-(a.heat||0)).slice(0,2).map(c=>c.concept).join(' and ')||'the weakest measured areas';const t=await v16Ask('plan',`Create a 2-week personalized remediation plan for ${s.name}. Course progress is ${s.progress}%, so a ${g}% mastery gap remains. Weakest concepts: ${weak}. Give week 1 and week 2 goals, two practice activities, and a mastery check.`);if(t)await v16Persist({plans:[{subject:s.name,semester:facultySemester,progress:s.progress,gap:g,weak,body:t,at:new Date().toISOString()},...facultyV16.plans]});}}>Generate plan</button></div>})}</div>
        {v16Busy==='plan'&&<div className="v16-loading">Generating plan…</div>}
        <h4>Saved plans</h4>
        {facultyV16.plans.length ? <div className="v16-plan-saved">{facultyV16.plans.map((p,i)=><div key={`${p.at}-${i}`}><div className="v16-plan-head"><b>{p.subject}</b><span>{p.semester} • {p.progress}% progress • {p.gap}% gap • {new Date(p.at).toLocaleDateString()}</span></div><p>{p.weak}</p><pre>{p.body}</pre></div>)}</div> : <div className="empty-state">No plans generated yet. Use “Generate plan” on a course with a published progress record.</div>}
      </div>
      : isCrCommand ? <div className="workspace-body cr16-body">
        <h3>AI Class Command Center</h3>
        <p>One decision surface for the CR. Every count below comes from a record already in the CampusLMS backend.</p>
        <div className="cr16-pulse">{[['👥','Cohort',crIntel.cohort],['✓','Present',crIntel.present],['▤','Pending work',crIntel.byStatus('Pending')],['!','Open issues',crIntel.openIssues.length],['▤','Polls',crIntel.polls.length]].map(([i,t,n])=><div key={t}><span>{i}</span><small>{t}</small><b>{n}</b></div>)}</div>
        <h4>Priority queue</h4>
        <div className="cr16-queue">{crIntel.queue.map(q=><button key={q.key} className={q.level} onClick={()=>setWorkspace({title:q.to,action:q.to,data:crIntel})}><i></i><div><b>{q.label}</b><small>{q.detail}</small></div><span>›</span></button>)}</div>
        <button className="solid-button" disabled={crBusy==='brief'} onClick={()=>crAsk('brief',`Give the class representative a short morning briefing. Real data: ${crIntel.openIssues.length} open issues, ${crIntel.byStatus('Pending')} assignments pending submission, attendance ${crIntel.present} of ${crIntel.cohort} (${crIntel.attendancePct}%), average subject progress ${crIntel.avgProgress}%, weakest subject ${crIntel.weakest[0]?.name||'none'}, ${crIntel.polls.length} active polls, ${crIntel.schedules.length} classes scheduled. Give 3 prioritised actions in 4 short sentences.`)}>{crBusy==='brief'?'Briefing…':'Generate today’s briefing'}</button>
        {crOut&&<pre className="cr16-ai">{crOut}</pre>}
        <h4>Dispatch</h4>
        <div className="workspace-actions"><button className="secondary-button" onClick={()=>setWorkspace({title:'Smart Announcement Generator',action:'Smart Announcement Generator',data:crIntel})}>Draft an announcement</button><button className="secondary-button" onClick={()=>setWorkspace({title:'Anonymous Issue Box',action:'Anonymous Issue Box',data:crIntel})}>Triage issue box</button><button className="secondary-button" onClick={()=>setWorkspace({title:'Student Manager',action:'Student Manager',data:crIntel})}>Open student manager</button></div>
      </div>
      : isCrIssueBox ? <div className="workspace-body cr16-body">
        <h3>Anonymous Issue Box</h3>
        <p>Issues are stored with the raiser recorded as <b>Anonymous</b>, then shown behind a stable thread code so you can reply without ever seeing who raised it.</p>
        <div className="cr16-form"><label>Category<select id="cr-issue-cat">{CR_V16.issueCategories.map(c=><option key={c}>{c}</option>)}</select></label><label>Issue title<input id="cr-issue-title" placeholder="e.g. Lab 2 projector not working"/></label><label>Details<textarea rows="3" id="cr-issue-desc" placeholder="Describe the problem. Do not include your name — it is not stored."/></label><button className="solid-button" onClick={async()=>{const t=document.getElementById('cr-issue-title')?.value?.trim();if(!t)return showToast('Add a title first.');const category=document.getElementById('cr-issue-cat')?.value;try{const r=await api('/api/issues',{method:'POST',body:JSON.stringify({title:`[${category}] ${t}`,description:document.getElementById('cr-issue-desc')?.value?.trim()||'',raisedBy:'Anonymous'})});setWorkspace(w=>({...w,data:{...w.data,issues:[r.issue,...(w.data?.issues||crIntel.issues)]}}));await refreshDashboard();showToast('Submitted anonymously.');}catch(e){showToast(e.message)}}}>Submit anonymously</button></div>
        <h4>Incoming issues</h4>
        {(workspace.data?.issues||crIntel.issues).length ? <div className="cr16-issues">{(workspace.data?.issues||crIntel.issues).map(i=>{const anon=!i.raisedBy||i.raisedBy==='Anonymous';return <div className="cr16-issue" key={i.id}><div className="cr16-issue-head"><b>{i.title}</b><em className={String(i.status||'Open').toLowerCase().replace(/\s/g,'-')}>{i.status||'Open'}</em></div><small>{anon?CR_V16.mask(i.id):`Raised by ${i.raisedBy}`} • {new Date(i.createdAt).toLocaleDateString()}</small><p>{i.description||'No details provided.'}</p>{i.response&&<div className="cr16-response"><b>Your reply</b><p>{i.response}</p></div>}<div className="cr16-issue-actions"><select id={`cr-status-${i.id}`}>{CR_V16.issueStatuses.map(s=><option key={s} selected={s===(i.status||'Open')}>{s}</option>)}</select><input id={`cr-reply-${i.id}`} placeholder="Reply to the student (stays anonymous)"/><button className="solid-button" onClick={async()=>{const status=document.getElementById(`cr-status-${i.id}`)?.value;const response=document.getElementById(`cr-reply-${i.id}`)?.value?.trim();try{await api(`/api/issues/${i.id}`,{method:'PATCH',body:JSON.stringify({status,response,role:'CR'})});setWorkspace(w=>({...w,data:{...w.data,issues:(w.data?.issues||crIntel.issues).map(x=>x.id===i.id?{...x,status,response}:x)}}));showToast('Issue updated.');}catch(e){showToast(e.message)}}}>Update</button></div></div>})}</div> : <div className="empty-state">No issues have been submitted yet. Anonymous submissions will appear here with the raiser masked.</div>}
      </div>
      : isCrAnnounce ? <div className="workspace-body cr16-body">
        <h3>Smart Announcement Generator</h3>
        <p>CampusAI drafts the announcement from the real class situation. You keep full control — nothing is published until you press publish.</p>
        <div className="cr16-facts"><div><small>Pending assignments</small><b>{crIntel.byStatus('Pending')}</b><span>of {crIntel.allAssignments.length} total</span></div><div><small>Attendance</small><b>{crIntel.attendancePct==null?'—':`${crIntel.attendancePct}%`}</b><span>{crIntel.present} of {crIntel.cohort} present</span></div><div><small>Open issues</small><b>{crIntel.openIssues.length}</b><span>awaiting triage</span></div><div><small>Weakest subject</small><b>{crIntel.weakest[0]?`${crIntel.weakest[0].progress}%`:'—'}</b><span>{crIntel.weakest[0]?.name||'no data'}</span></div></div>
        <div className="workspace-form"><label>Angle<select id="cr-gen-angle"><option>Deadline reminder</option><option>Attendance nudge</option><option>Weak-topic revision slot</option><option>Event invite</option><option>General class update</option></select></label></div>
        <button className="solid-button" disabled={crBusy==='gen2'} onClick={()=>crAsk('gen2',`Write a class announcement for CSE Semester I about: ${document.getElementById('cr-gen-angle')?.value}. Real situation: ${crIntel.byStatus('Pending')} assignments pending submission, attendance ${crIntel.attendancePct}%, average subject progress ${crIntel.avgProgress}%, weakest subject ${crIntel.weakest[0]?.name||'none'} at ${crIntel.weakest[0]?.progress||0}%, ${crIntel.openIssues.length} open issues. Keep it under 60 words, warm but firm, and end with one clear ask.`)}>{crBusy==='gen2'?'Drafting…':'Draft with AI'}</button>
        {crOut&&<pre className="cr16-ai">{crOut}</pre>}
        <div className="cr16-form"><label>Title<input id="cr16-title" placeholder="Announcement title"/></label><label>Body<textarea rows="4" id="cr16-body" placeholder="Draft appears here — edit before publishing."/></label><div className="cr16-inline"><button className="secondary-button" disabled={!crOut} onClick={()=>{const t=document.getElementById('cr16-title');const b=document.getElementById('cr16-body');if(!t||!b)return;const m=crOut.match(/TITLE:\s*(.+)\n[\s\S]*?BODY:\s*([\s\S]+)/i);t.value=m?m[1].trim().split('\n')[0]:`Class Update — ${document.getElementById('cr-gen-angle')?.value||'Announcement'}`;b.value=m?m[2].trim():crOut;showToast('Draft moved into the editor.');}}>Move draft into editor</button><button className="solid-button" disabled={!crOut} onClick={async()=>{const t=document.getElementById('cr16-title')?.value?.trim();const b=document.getElementById('cr16-body')?.value?.trim();if(!t||!b)return showToast('Title and body are required.');await publishAnnouncement(t,b);setCrOut('');showToast('Announcement published to the class feed.');}}>Publish to Class →</button></div></div>
        <h4>Recent announcements</h4>
        <div className="workspace-list">{(workspace.data?.announcements||crIntel.recentAnnouncements).slice(0,6).map(a=><div key={a.id}><b>{a.title}</b><span>{a.createdAt?new Date(a.createdAt).toLocaleString():'Recent'}</span><p>{a.body}</p></div>)}</div>
      </div>
      : isCrAnalytics ? <div className="workspace-body cr16-body">
        <h3>Class Analytics</h3>
        <p>Cohort-level analytics computed from the dashboard response. No figure here is hardcoded.</p>
        <div className="cr16-kpis">{[['Attendance',crIntel.attendancePct==null?'—':`${crIntel.attendancePct}%`,`${crIntel.present} of ${crIntel.cohort} present`],['Avg subject progress',crIntel.avgProgress==null?'—':`${crIntel.avgProgress}%`,`${crIntel.subjects.length} subjects`],['Submission rate',crIntel.submissionRate==null?'no submissions':`${crIntel.submissionRate}%`,`${crIntel.submissions} submissions stored`],['Assignment backlog',String(crIntel.byStatus('Pending')),`${crIntel.byStatus('Upcoming')} upcoming`]].map(([t,v,s])=><div key={t}><small>{t}</small><b>{v}</b><span>{s}</span></div>)}</div>
        <h4>Subject progress</h4>
        {crIntel.subjects.length ? <div className="cr16-bars">{crIntel.subjects.map(s=><div key={s.name}><div className="cr16-bar"><i style={{width:`${s.progress}%`}}></i></div><b>{s.name}</b><span>{s.progress}%</span></div>)}</div> : <div className="empty-state">No subject progress published.</div>}
        <h4>Assignment pipeline</h4>
        {crIntel.allAssignments.length ? <div className="cr16-table"><div className="cr16-tr cr16-th"><span>Assignment</span><span>Subject</span><span>Deadline</span><span>Status</span><span>Subs</span></div>{crIntel.allAssignments.map(a=><div className="cr16-tr" key={a.id}><span>{a.title}</span><span>{a.subject}</span><span>{a.deadline}</span><span><em className={`st st-${String(a.status||'').toLowerCase()}`}>{a.status}</em></span><span>{a.submissions?.length||0}</span></div>)}</div> : <div className="empty-state">No assignment records.</div>}
        <h4>Participation</h4>
        <div className="cr16-facts"><div><small>Polls created</small><b>{crIntel.polls.length}</b><span>feedback instruments</span></div><div><small>Doubt tickets</small><b>{crIntel.tickets.length}</b><span>from the class</span></div><div><small>Open issues</small><b>{crIntel.openIssues.length}</b><span>of {crIntel.issues.length} total</span></div><div><small>Announcements</small><b>{crIntel.recentAnnouncements.length}</b><span>in the feed</span></div></div>
        <p className="cr16-note">Subject progress, attendance and assignment status are cohort aggregates. The backend does not yet store per-student marks, so this module reports class-level analytics rather than inventing an individual leaderboard.</p>
      </div>
      : isCrStudents ? <div className="workspace-body cr16-body">
        <h3>Student Manager</h3>
        <p>Cohort management for the class representative, grounded in stored records.</p>
        <div className="cr16-facts"><div><small>Enrolled</small><b>{crIntel.cohort||'—'}</b><span>CSE (IoT) Semester I</span></div><div><small>Present today</small><b>{crIntel.present||'—'}</b><span>{crIntel.attendancePct==null?'no attendance record':`${crIntel.attendancePct}% attendance`}</span></div><div><small>Assignment records</small><b>{crIntel.allAssignments.length}</b><span>{crIntel.submissions} submissions stored</span></div><div><small>Individual records</small><b>{crIntel.roster.length}</b><span>students with submissions</span></div></div>
        {crIntel.roster.length ? <><h4>Students with recorded activity</h4><div className="cr16-table"><div className="cr16-tr cr16-th"><span>Student</span><span>ID</span><span>Subs</span><span>Assignments</span></div>{crIntel.roster.map(s=><div className="cr16-tr" key={s.id}><span>{s.name}</span><span>{s.id}</span><span>{s.submitted}</span><span>{s.assignments.join(', ')||'—'}</span></div>)}</div></> : <div className="empty-state">No per-student submission records exist in the backend yet, so the roster table is empty rather than filled with invented names. It fills in automatically as soon as students submit work. The cohort size of {crIntel.cohort||'—'} comes from the attendance record.</div>}
        <h4>Class-wide status by subject</h4>
        <div className="cr16-table"><div className="cr16-tr cr16-th"><span>Subject</span><span>Progress</span><span>Assignments</span><span>Needs attention</span></div>{crIntel.subjects.map(s=>{const rows=crIntel.allAssignments.filter(a=>a.subject===s.name);return <div className="cr16-tr" key={s.name}><span>{s.name}</span><span>{s.progress}%</span><span>{rows.length}</span><span>{s.progress<70?'Yes — below 70%':s.progress<80?'Watch':'No'}</span></div>})}</div>
        <div className="workspace-actions"><button className="secondary-button" onClick={()=>setWorkspace({title:'Smart Announcement Generator',action:'Smart Announcement Generator',data:crIntel})}>Message the class →</button><button className="secondary-button" onClick={async()=>{try{const r=await api('/api/student-records');showToast(r.studentRecord?`Record for ${r.studentRecord.name} loaded.`:'No student record available.');}catch(e){showToast(e.message)}}}>Load student record</button></div>
      </div>
      : isCrEvents ? <div className="workspace-body cr16-body">
        <h3>Timetable &amp; Events</h3>
        <p>The weekly timetable already lives on your CR dashboard and is read from the backend. This module adds the <b>events</b> layer, which the backend does not have yet.</p>
        <h4>Weekly timetable (read-only)</h4>
        {crIntel.schedules.length ? <div className="workspace-list">{crIntel.schedules.map(c=><div key={c.id}><b>{c.time} • {c.title}</b><span>{c.detail} • {c.room||'Room TBC'}</span></div>)}</div> : <div className="empty-state">No timetable published.</div>}
        <h4>CR events</h4>
        <div className="cr16-form"><label>Event title<input id="cr-ev-title" placeholder="e.g. AI/ML Workshop"/></label><label>Type<select id="cr-ev-type">{CR_V16.eventTypes.map(t=><option key={t}>{t}</option>)}</select></label><label>Date<input id="cr-ev-date" type="date"/></label><label>Venue<input id="cr-ev-venue" placeholder="e.g. CSE Lab 1"/></label><label>Note<textarea id="cr-ev-note" rows="2" placeholder="Anything the class should know"/></label><button className="solid-button" onClick={async()=>{const title=document.getElementById('cr-ev-title')?.value?.trim();if(!title)return showToast('Event title is required.');const ev={id:`EV-${Date.now().toString(36).toUpperCase()}`,title,type:document.getElementById('cr-ev-type')?.value,date:document.getElementById('cr-ev-date')?.value,venue:document.getElementById('cr-ev-venue')?.value?.trim(),note:document.getElementById('cr-ev-note')?.value?.trim(),at:new Date().toISOString()};await crPersist({events:[ev,...crEvents]});showToast(`Event “${ev.title}” saved.`);['cr-ev-title','cr-ev-date','cr-ev-venue','cr-ev-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});}}>Add event</button></div>
        {crEvents.length ? <div className="cr16-event-list">{crEvents.map(e=><div key={e.id} className="cr16-event"><time>{e.date||'TBD'}</time><div><b>{e.title}</b><small>{e.type} • {e.venue||'Campus'}</small>{e.note&&<p>{e.note}</p>}</div><button className="secondary-button" onClick={async()=>{await crPersist({events:crEvents.filter(x=>x.id!==e.id)});showToast('Event removed.');}}>Remove</button></div>)}</div> : <div className="empty-state">No CR events yet. Events you add are saved to the backend.</div>}
        <div className="workspace-actions"><button className="secondary-button" onClick={()=>setWorkspace({title:'Smart Announcement Generator',action:'Smart Announcement Generator',data:crIntel})}>Announce an event →</button></div>
      </div>
      : isFacultyTickets ? <div className="workspace-body"><h3>Doubt Tickets</h3><p>Live tickets stored in the backend.</p><div className="workspace-list">{(serverData?.tickets||[]).slice(0,10).map(t=><div key={t.id}><b>#{t.id} • {t.status}</b><span>{t.title} — {t.description}</span></div>)}</div><button className="solid-button" onClick={refreshDashboard}>Refresh Tickets</button></div>
      : isFacultyRemedial ? <div className="workspace-body"><h3>Remedial Session Planner</h3><p>Create a support session and save it to the faculty backend.</p><input className="workspace-answer" id="remedial-student" placeholder="Student or group"/><input className="workspace-answer" id="remedial-topic" placeholder="Topic, e.g. Normalization"/><input className="workspace-answer" id="remedial-date" type="date"/><button className="solid-button" onClick={async()=>{const r=await api('/api/faculty/remedial',{method:'POST',body:JSON.stringify({student:document.getElementById('remedial-student')?.value,topic:document.getElementById('remedial-topic')?.value,date:document.getElementById('remedial-date')?.value})});showToast(r.message);}}>Save Remedial Plan</button></div>
      : isFacultyGrading ? <div className="workspace-body"><h3>Smart Grading</h3><p>Save grade and faculty feedback as a backend record.</p><input className="workspace-answer" id="grade-student" placeholder="Student name"/><select className="workspace-answer" id="grade-value"><option>A</option><option>B</option><option>C</option><option>D</option></select><textarea className="workspace-answer" id="grade-feedback" rows="4" placeholder="Feedback"></textarea><button className="solid-button" onClick={async()=>{const r=await api('/api/faculty/grading',{method:'POST',body:JSON.stringify({student:document.getElementById('grade-student')?.value,grade:document.getElementById('grade-value')?.value,feedback:document.getElementById('grade-feedback')?.value})});showToast(r.message);}}>Save Grade</button></div>
      : isAI ? <div className="workspace-body"><h3>AI-powered workflow</h3><p>This tool is connected to CampusAI. Ask a real question and continue in the AI workspace.</p><div className="ai-mini"><input id="mini-ai" placeholder="e.g. Explain normalization to my class"/><button className="solid-button" onClick={()=>{const el=document.getElementById('mini-ai');if(el?.value){setWorkspace(null);setAiInput(el.value);go('AI Assistant');}}}>Ask CampusAI</button></div></div>
      : <div className="workspace-body"><h3>{title}</h3><p>This feature now has a real workflow. Continue the action and save the result instead of only showing a toast.</p><div className="workspace-actions"><button className="solid-button" onClick={async()=>{await runAction(`${title} workflow started`,{source:'workspace'});showToast(`${title} started.`);}}>Start Workflow</button><button className="secondary-button" onClick={async()=>{await runAction(`${title} completed`,{source:'workspace'});}}>Complete & Save</button></div></div>}
    </div></div>;
  };

  if (role === "Faculty") return <>{renderFacultyDashboard()}{renderWorkspace()}{toast && <div className="campus-toast">{toast}</div>}</>;
  if (role === "CR") return <>{renderCRDashboard()}{renderWorkspace()}{toast && <div className="campus-toast">{toast}</div>}</>;

  return (
    <div className={`app-shell ${dark ? "theme-dark" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon cap">◆</div><div><strong>CampusLMS</strong><span>Learn. Grow. Succeed.</span></div></div>
        <div className="profile-mini"><div className="avatar big">SP</div><div><strong>Satya Prakash</strong><span>Student • CSE (Sem 1)</span></div><b>⌄</b></div>
        <nav>
          {/* Streamlined primary nav. Every item reuses an existing handler so
              no route or backend call is introduced here. */}
          {[
            { key: 'Dashboard',        icon: '⌂',  label: 'Dashboard',        onClick: () => go('Dashboard') },
            { key: 'Resources',        icon: '⌕',  label: 'Smart Search',     onClick: () => { go('Resources'); window.setTimeout(() => document.querySelector('.global-search input')?.focus(), 0); } },
            { key: 'Notification Center', icon: '🔔', label: 'Notifications',  onClick: () => openNotifications() },
            { key: 'Academic Records', icon: '▤',  label: 'Academic Records', onClick: () => go('Academic Records') },
            { key: 'Certificates',     icon: '◇',  label: 'Certificates',     onClick: () => go('Certificates') },
            { key: 'Help & Support',   icon: '?',  label: 'Help & Support',   onClick: () => go('Help & Support') },
          ].map(({ key, icon, label, onClick }) => (
            <button key={key} className={active === key ? 'nav-item active-nav' : 'nav-item'} onClick={onClick}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={()=>runAction("Settings panel opened.")}><span>⚙</span>Settings</button><button className="nav-item logout" onClick={logout}><span>↪</span>Logout</button><div className="side-user"><div className="avatar">SP</div><div><b>Satya Prakash</b><small>B.Tech CSE | Sem 1</small><span>● Keep Learning 💙</span></div><i>›</i></div></div>
      </aside>

      <main className={`main-content ${active==='AI Mentorship'?'aar-shell':''}`}>
        <header className="topbar">
          <div className="mobile-brand">CampusLMS</div>
          <div className="global-search"><span>⌕</span><input value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')go('Resources')}} placeholder="Search notes, PYQs, assignments, mentors, topics..."/><kbd>Ctrl K</kbd></div>
          <div className="top-actions"><button className={`exam-toggle ${examMode?'on':''}`} onClick={()=>{setExamMode(!examMode); if(!examMode) go('Exam Night Mode')}}>🔥 Exam Mode</button><button onClick={()=>setDark(!dark)}>{dark?'☀':'☼'}</button><button onClick={openNotifications} className="bell">♧<b>{notifications}</b></button><div className="top-profile"><span className="avatar">SP</span><div><b>Satya Prakash</b><small>Student • CSE (Sem 1)</small></div><span>⌄</span></div></div>
        </header>
        <div className="page-content">{content}</div>
        <footer className="footer"><div><b>◆ CampusLMS</b><small>Indian Students. Global Opportunities.</small></div><div className="footer-links"><span>About</span><span>Privacy</span><span>Help</span><span>Contact</span></div><div>🇮🇳 Learn Today. Lead Tomorrow.</div><span>Made for a Smarter India ❤️</span></footer>
        {role === "Student" && <>
          {/* Premium app-style launcher: a rounded-square gradient tile with a
              soft glow, glass highlight and a crisp sparkle mark. Presentation
              only — it toggles the compact voice assistant below. */}
          <button
            className={`vidya-fab ${aiLauncherOpen ? "is-open" : ""}`}
            aria-label={`${aiLauncherOpen ? "Close" : "Open"} ${VIDYA.name} AI assistant`}
            aria-expanded={aiLauncherOpen}
            aria-haspopup="dialog"
            onClick={() => setAiLauncherOpen(v => !v)}
          >
            <span className="vidya-fab-glow" aria-hidden="true"></span>
            <span className="vidya-fab-plate" aria-hidden="true">
              <span className="vidya-fab-sheen"></span>
            </span>
            <span className="vidya-fab-ring" aria-hidden="true"></span>
            <svg className="vidya-fab-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 1.4l1.94 5.31a4.6 4.6 0 0 0 2.66 2.66L22.3 11.3l-5.7 1.93a4.6 4.6 0 0 0-2.66 2.66L12 21.2l-1.94-5.31a4.6 4.6 0 0 0-2.66-2.66L1.7 11.3l5.7-1.93a4.6 4.6 0 0 0 2.66-2.66L12 1.4z" />
            </svg>
          </button>

          {/* Compact bottom-centre voice assistant, Google Assistant style.
              No backdrop and no side panel: a small floating card anchored above
              the launcher, driven by the mic orb. */}
          <div className={`vidya-hud ${aiLauncherOpen ? "is-open" : ""}`} aria-hidden={!aiLauncherOpen}>
            <section className="vidya-card" role="dialog" aria-label={`${VIDYA.name} AI assistant`}>
              <header className="vidya-card-top">
                <span className="vidya-av"><img src="/images/vidya-avatar.jpg" alt={VIDYA.name}/><i className="vidya-online" aria-hidden="true"></i></span>
                <div className="vidya-card-id">
                  <b>Hi, I&apos;m {VIDYA.name} 👋</b>
                  <small>How may I help you?</small>
                </div>
                <button className="vidya-close" onClick={() => { setAiLauncherOpen(false); speakRun.current += 1; try { window.speechSynthesis?.cancel(); } catch { /* not supported */ } }} aria-label={`Close ${VIDYA.name}`}>✕</button>
              </header>

              <div className="vidya-stage">
                <button
                  type="button"
                  className={`vidya-orb ${vidyaListening ? "live" : ""} ${vidyaThinking ? "thinking" : ""}`}
                  onClick={vidyaVoice}
                  aria-pressed={vidyaListening}
                  aria-label={`Speak to ${VIDYA.name}`}
                >
                  <span className="vidya-orb-halo" aria-hidden="true"></span>
                  <span className="vidya-orb-wave" aria-hidden="true"></span>
                  <span className="vidya-orb-wave d2" aria-hidden="true"></span>
                  <span className="vidya-orb-disc" aria-hidden="true"></span>
                  <svg className="vidya-orb-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 14.4a3.1 3.1 0 0 0 3.1-3.1V5.6a3.1 3.1 0 1 0-6.2 0v5.7a3.1 3.1 0 0 0 3.1 3.1z" />
                    <path d="M17.2 10.8v.5a5.2 5.2 0 0 1-10.4 0v-.5H5.1v.5a6.9 6.9 0 0 0 6 6.86V21H8.2v1.7h7.6V21h-2.9v-2.34a6.9 6.9 0 0 0 6-6.86v-.5h-1.7z" />
                  </svg>
                </button>
                <b className="vidya-stage-label">
                  {vidyaListening ? "Listening…" : vidyaThinking ? `${VIDYA.name} is thinking…` : "Tap to speak"}
                </b>
                <small className="vidya-stage-hint">
                  {vidyaListening ? "Say your question out loud" : `Ask ${VIDYA.name} with your voice`}
                </small>
              </div>

              <div className="vidya-log" ref={vidyaScrollRef}>
                {aiMessages.map((m, i) => (
                  <div key={i} className={`vidya-msg ${m.role === "user" ? "mine" : "theirs"}`}>
                    {m.role !== "user" && <span className="vidya-msg-av" aria-hidden="true">✦</span>}
                    <p>{m.text}</p>
                  </div>
                ))}
                {vidyaThinking && <div className="vidya-msg theirs"><span className="vidya-msg-av" aria-hidden="true">✦</span><p className="vidya-typing" aria-label={`${VIDYA.name} is typing`}><i></i><i></i><i></i></p></div>}
              </div>

              <div className="vidya-quick">
                {[['📚','Explain a concept'],['📝','Summarise my notes'],['🎯','Make a study plan'],['⏱','Rescue my 30 mins']].map(([i, t]) => (
                  <button key={t} onClick={() => vidyaAsk(t)}>{i}<span>{t}</span></button>
                ))}
                <button className="vidya-clear" onClick={() => setAiMessages([{ role: "assistant", text: "Hi, I'm VIDYA 👋 How may I help you?" }])} aria-label="Clear conversation">Clear</button>
              </div>

              <form className="vidya-composer" onSubmit={(e) => { e.preventDefault(); vidyaAsk(aiInput); }}>
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={vidyaListening ? "Listening…" : `Ask ${VIDYA.name} anything…`}
                  aria-label={`Message ${VIDYA.name}`}
                />
                <button type="submit" className="vidya-send" disabled={!aiInput.trim() || vidyaThinking} aria-label="Send message">➤</button>
              </form>
            </section>
          </div>
        </>}
        {renderWorkspace()}
        {toast && <div className="campus-toast">{toast}</div>}
      </main>
    </div>
  );
}

export default App;
