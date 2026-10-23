// Mirrors server/internal/sigaa/model.go — keep both in sync.
// Dates: "YYYY-MM-DD"; datetimes: "YYYY-MM-DDTHH:mm" (America/Sao_Paulo, no offset).

export interface Envelope<T> {
  data: T;
  fetchedAt: string; // RFC 3339, when the BFF scraped SIGAA (cache time)
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "SIGAA_UNAVAILABLE"
  | "PARSE_ERROR"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNSUPPORTED_ACCOUNT";

export interface SessionInfo {
  name: string;
  matricula: string;
}

export interface Profile {
  name: string;
  matricula: string;
  course: string;
  level: string;
  status: string;
  email: string;
  entryPeriod: string;
  campus: string;
  currentPeriod: string;
}

export interface Index {
  code: string;
  description: string;
  value: number;
}

export interface Progress {
  mandatoryPendingHours: number;
  optionalPendingHours: number;
  complementaryPendingHours: number;
  totalCurriculumHours: number;
  percent: number;
}

/** day: 2 = Monday … 7 = Saturday (SIGAA convention). */
export interface Slot {
  day: number;
  shift: "M" | "T" | "N";
  index: number;
}

export interface ClassSummary {
  id: string;
  name: string;
  period: string;
  location: string;
  schedule: string;
  slots: Slot[];
  startDate: string;
  endDate: string;
}

export interface Activity {
  date: string;
  className: string;
  kind: string;
  title: string;
  past: boolean;
}

export interface ClassUpdate {
  date: string;
  className: string;
  description: string;
}

export interface ForumTopic {
  /** SIGAA's idForumMensagem; opens /forum/:id. */
  id?: string;
  title: string;
  author: string;
  replies: number;
  date: string;
}

export interface Dashboard {
  profile: Profile;
  indices: Index[];
  progress: Progress;
  classes: ClassSummary[];
  activities: Activity[];
  updates: ClassUpdate[];
  forum: ForumTopic[];
}

export interface GradeRow {
  code: string;
  name: string;
  units: (number | null)[];
  recovery: number | null;
  result: number | null;
  absences: number | null;
  situation: string;
}

export interface GradeSemester {
  period: string;
  unitLabels: string[];
  rows: GradeRow[];
}

export interface GradesReport {
  semesters: GradeSemester[];
}

export interface Material {
  kind: "file" | "link" | "task";
  title: string;
  id?: string;
  url?: string;
}

export interface Topic {
  title: string;
  startDate: string;
  endDate: string;
  /** Sanitized by the BFF (bluemonday). Safe for dangerouslySetInnerHTML. */
  html: string;
  materials: Material[];
}

export interface NewsItem {
  id?: string;
  title: string;
  date: string;
  /** Sanitized HTML, present on detail and on lastNews. */
  html?: string;
}

export interface ClassOverview {
  id: string;
  code: string;
  name: string;
  period: string;
  workloadHours: number;
  schedule: string;
  lessonsTaught: number;
  lessonsTotal: number;
  lastNews: NewsItem | null;
  topics: Topic[];
}

export interface AttendanceRecord {
  date: string;
  status: "present" | "absent" | "unregistered";
  absences: number;
}

export interface Attendance {
  records: AttendanceRecord[];
  presences: number;
  totalAbsences: number;
  lessonsWithRecord: number;
  lessonsByWorkload: number;
  percentOfRecorded: number;
  percentOfWorkload: number;
  /** 25% of lessonsByWorkload, floored. */
  maxAbsences: number;
}

export interface Assessment {
  group: string;
  label: string;
  title?: string;
  weight?: string;
  value: number | null;
  isUnitTotal: boolean;
}

export interface ClassGrades {
  /** false when SIGAA says "Ainda não foram lançadas notas." (assessments = [], situation = ""). */
  published: boolean;
  assessments: Assessment[];
  makeup: number | null;
  result: number | null;
  absences: number | null;
  situation: string;
}

export interface Task {
  title: string;
  description: string;
  start: string;
  end: string;
  graded: boolean;
  submissions: number;
  corrected: boolean;
  canSubmit: boolean;
}

export interface FileItem {
  id: string;
  title: string;
  description: string;
  topic: string;
}

export interface Evaluation {
  id?: string;
  date: string;
  /** Normalized "HH:MM", or "" when SIGAA has no time. */
  time: string;
  description: string;
}

/** One row of "Ver turmas anteriores" (every turma virtual, current semester included). */
export interface PastClass {
  id: string;
  code: string;
  name: string;
  period: string;
  /** Turma number, e.g. "01". */
  group: string;
  workloadHours: number;
  /** "" when SIGAA has no schedule for the class. */
  schedule: string;
  startDate: string;
  endDate: string;
}

export interface CalendarRef {
  id: string;
  period: string;
  name: string;
}

/** Dates SIGAA marks as "Não Definido" are omitted. */
export interface CalendarEvent {
  label: string;
  start: string;
  end: string;
}

export interface CalendarSection {
  title: string;
  events: CalendarEvent[];
}

export interface AcademicCalendar {
  period: string;
  current: boolean;
  /** Período letivo. */
  start: string;
  end: string;
  sections: CalendarSection[];
}

export interface ComplementaryActivity {
  date: string;
  type: string;
  description: string;
  hours: number;
  status: string;
}

export interface ComplementaryGroup {
  category: string;
  approvedHours: number;
  activities: ComplementaryActivity[];
}

export interface ComplementaryActivities {
  groups: ComplementaryGroup[];
}

export interface ForumPost {
  date: string;
  author: string;
  /** Sanitized by the BFF. */
  html: string;
}

export interface ForumThread {
  id: string;
  title: string;
  posts: ForumPost[];
}

export interface PlanLesson {
  start: string;
  end: string;
  description: string;
}

export interface PlanEvaluation {
  date: string;
  description: string;
}

export interface PlanReference {
  type: string;
  description: string;
}

export interface TeachingPlan {
  /** Sanitized by the BFF. */
  methodologyHtml: string;
  /** Sanitized by the BFF. */
  assessmentHtml: string;
  officeHours: string;
  lessons: PlanLesson[];
  evaluations: PlanEvaluation[];
  basicReferences: PlanReference[];
  complementaryReferences: PlanReference[];
}

export interface Teacher {
  name: string;
  department: string;
  degree: string;
  email: string;
}

/** Classmates come as names only (no e-mail, username or matrícula). */
export interface Participants {
  teachers: Teacher[];
  students: string[];
}

export interface ClassReference {
  title: string;
  type: string;
  url?: string;
  topic?: string;
}
