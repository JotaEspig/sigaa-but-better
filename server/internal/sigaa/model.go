package sigaa

// JSON contract shared with web/src/api/types.ts — keep both in sync.
//
// Dates are ISO local dates ("2026-10-04") and datetimes without offset
// ("2026-10-06T21:53"), always in SIGAA's timezone (America/Sao_Paulo).
// Numeric grades are *float64 so "not graded yet" is null instead of 0.

type Profile struct {
	Name          string `json:"name"`
	Matricula     string `json:"matricula"`
	Course        string `json:"course"`
	Level         string `json:"level"`
	Status        string `json:"status"`
	Email         string `json:"email"`
	EntryPeriod   string `json:"entryPeriod"`
	Campus        string `json:"campus"`
	CurrentPeriod string `json:"currentPeriod"`
}

type Index struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Value       float64 `json:"value"`
}

type Progress struct {
	MandatoryPendingHours     int     `json:"mandatoryPendingHours"`
	OptionalPendingHours      int     `json:"optionalPendingHours"`
	ComplementaryPendingHours int     `json:"complementaryPendingHours"`
	TotalCurriculumHours      int     `json:"totalCurriculumHours"`
	Percent                   float64 `json:"percent"`
}

// Slot is one 50-minute lesson in SIGAA's schedule code ("3N1234").
// Day follows SIGAA: 2 = Monday ... 7 = Saturday. Shift is M, T or N.
type Slot struct {
	Day   int    `json:"day"`
	Shift string `json:"shift"`
	Index int    `json:"index"`
}

type ClassSummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Period    string `json:"period"`
	Location  string `json:"location"`
	Schedule  string `json:"schedule"`
	Slots     []Slot `json:"slots"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type Activity struct {
	Date      string `json:"date"`
	ClassName string `json:"className"`
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Past      bool   `json:"past"`
}

type ClassUpdate struct {
	Date        string `json:"date"`
	ClassName   string `json:"className"`
	Description string `json:"description"`
}

type ForumTopic struct {
	Title   string `json:"title"`
	Author  string `json:"author"`
	Replies int    `json:"replies"`
	Date    string `json:"date"`
}

type Dashboard struct {
	Profile    Profile        `json:"profile"`
	Indices    []Index        `json:"indices"`
	Progress   Progress       `json:"progress"`
	Classes    []ClassSummary `json:"classes"`
	Activities []Activity     `json:"activities"`
	Updates    []ClassUpdate  `json:"updates"`
	Forum      []ForumTopic   `json:"forum"`
}

type GradeRow struct {
	Code      string     `json:"code"`
	Name      string     `json:"name"`
	Units     []*float64 `json:"units"`
	Recovery  *float64   `json:"recovery"`
	Result    *float64   `json:"result"`
	Absences  *int       `json:"absences"`
	Situation string     `json:"situation"`
}

type GradeSemester struct {
	Period     string     `json:"period"`
	UnitLabels []string   `json:"unitLabels"`
	Rows       []GradeRow `json:"rows"`
}

type GradesReport struct {
	Semesters []GradeSemester `json:"semesters"`
}

type Material struct {
	// Kind is "file", "link" or "task".
	Kind  string `json:"kind"`
	Title string `json:"title"`
	ID    string `json:"id,omitempty"`
	URL   string `json:"url,omitempty"`
}

type Topic struct {
	Title     string     `json:"title"`
	StartDate string     `json:"startDate"`
	EndDate   string     `json:"endDate"`
	HTML      string     `json:"html"`
	Materials []Material `json:"materials"`
}

type NewsItem struct {
	ID    string `json:"id,omitempty"`
	Title string `json:"title"`
	Date  string `json:"date"`
	HTML  string `json:"html,omitempty"`
}

type ClassOverview struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Period        string    `json:"period"`
	WorkloadHours int       `json:"workloadHours"`
	Schedule      string    `json:"schedule"`
	LessonsTaught int       `json:"lessonsTaught"`
	LessonsTotal  int       `json:"lessonsTotal"`
	LastNews      *NewsItem `json:"lastNews"`
	Topics        []Topic   `json:"topics"`
}

type AttendanceRecord struct {
	Date string `json:"date"`
	// Status is "present", "absent" or "unregistered".
	Status   string `json:"status"`
	Absences int    `json:"absences"`
}

type Attendance struct {
	Records           []AttendanceRecord `json:"records"`
	Presences         int                `json:"presences"`
	TotalAbsences     int                `json:"totalAbsences"`
	LessonsWithRecord int                `json:"lessonsWithRecord"`
	LessonsByWorkload int                `json:"lessonsByWorkload"`
	PercentOfRecorded float64            `json:"percentOfRecorded"`
	PercentOfWorkload float64            `json:"percentOfWorkload"`
	MaxAbsences       int                `json:"maxAbsences"`
}

type Assessment struct {
	Group  string   `json:"group"`
	Label  string   `json:"label"`
	Title  string   `json:"title,omitempty"`
	Weight string   `json:"weight,omitempty"`
	Value  *float64 `json:"value"`
	// IsUnitTotal marks the "Nota" column that consolidates a unit.
	IsUnitTotal bool `json:"isUnitTotal"`
}

type ClassGrades struct {
	// Published is false when SIGAA says "Ainda não foram lançadas notas."
	Published   bool         `json:"published"`
	Assessments []Assessment `json:"assessments"`
	Makeup      *float64     `json:"makeup"`
	Result      *float64     `json:"result"`
	Absences    *int         `json:"absences"`
	Situation   string       `json:"situation"`
}

type Task struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Start       string `json:"start"`
	End         string `json:"end"`
	Graded      bool   `json:"graded"`
	Submissions int    `json:"submissions"`
	Corrected   bool   `json:"corrected"`
	CanSubmit   bool   `json:"canSubmit"`
}

type FileItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Topic       string `json:"topic"`
}

type Evaluation struct {
	ID   string `json:"id,omitempty"`
	Date string `json:"date"`
	// Time is "HH:MM" or "" when the teacher did not set one.
	Time        string `json:"time"`
	Description string `json:"description"`
}
