// Dev-only fake backend (VITE_MOCK=1). Data is fictional/anonymized and shaped
// like the real SIGAA pages captured during reverse engineering.
import { ApiError } from "../api/client";
import type {
  AcademicCalendar,
  Attendance,
  CalendarRef,
  ClassGrades,
  ClassReference,
  ComplementaryActivities,
  ForumThread,
  Participants,
  PastClass,
  TeachingPlan,
  ClassOverview,
  ClassSummary,
  Dashboard,
  Envelope,
  Evaluation,
  FileItem,
  GradesReport,
  NewsItem,
  SessionInfo,
  Slot,
  Task,
} from "../api/types";

const pad = (n: number) => String(n).padStart(2, "0");
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const at = (offset: number, time: string) => `${day(offset)}T${time}`;

const slots = (dayCode: number, shift: Slot["shift"], idx: number[]): Slot[] => idx.map((index) => ({ day: dayCode, shift, index }));

const CLASSES: ClassSummary[] = [
  {
    id: "080070D1573B0B8866AD2CA0D5ABFA393A61BC52",
    name: "COMPILADORES",
    period: "2026.2",
    location: "Laboratório D06",
    schedule: "3N1234",
    slots: slots(3, "N", [1, 2, 3, 4]),
    startDate: "2026-08-03",
    endDate: "2026-12-11",
  },
  {
    id: "78F23D59CACEA7F6A1D30818EC118E818A8B917D",
    name: "COMPUTAÇÃO GRÁFICA",
    period: "2026.2",
    location: "Laboratório A04",
    schedule: "5T1234",
    slots: slots(5, "T", [1, 2, 3, 4]),
    startDate: "2026-08-03",
    endDate: "2026-12-11",
  },
  {
    id: "85DFE8650ADD2C68233863FB1676975A2A4034C9",
    name: "EMPREENDEDORISMO",
    period: "2026.2",
    location: "Sala C16",
    schedule: "4N1234",
    slots: slots(4, "N", [1, 2, 3, 4]),
    startDate: "2026-08-03",
    endDate: "2026-12-18",
  },
  {
    id: "A2EB72E05380710ADCFDA7CA67271FDA42673E87",
    name: "TRABALHO DE CONCLUSÃO DE CURSO",
    period: "2026.2",
    location: "Laboratório D06",
    schedule: "6N1234",
    slots: slots(6, "N", [1, 2, 3, 4]),
    startDate: "2026-08-03",
    endDate: "2026-12-18",
  },
];

const SESSION: SessionInfo = { name: "ALUNO EXEMPLO DA SILVA", matricula: "2020000001" };

const DASHBOARD: Dashboard = {
  profile: {
    name: SESSION.name,
    matricula: SESSION.matricula,
    course: "CIÊNCIA DA COMPUTAÇÃO/CAMP/BLUM - BLUMENAU - BACHARELADO - MTN",
    level: "GRADUAÇÃO",
    status: "ATIVO",
    email: "aluno@example.com",
    entryPeriod: "2023.1",
    campus: "CAMPUS BLUMENAU (11.01.09)",
    currentPeriod: "2026.2",
  },
  indices: [
    { code: "MC", description: "Média de Conclusão", value: 9.1691 },
    { code: "IRA", description: "Índice de Rendimento Acadêmico", value: 9.2035 },
    { code: "MCN", description: "Média de Conclusão Normalizada", value: 1416.91 },
    { code: "IECH", description: "Índice de Eficiência em Carga Horária", value: 1.0 },
    { code: "IEPL", description: "Índice de Eficiência em Períodos Letivos", value: 1.0631 },
    { code: "IEA", description: "Índice de Eficiência Acadêmica", value: 9.7477 },
    { code: "IEAN", description: "Índice de Eficiência Acadêmica Normalizada", value: 1506.317 },
    { code: "ISPL", description: "Índice de Suficiência em Períodos Letivos", value: 1.1 },
    { code: "IECHP", description: "Índice de Eficiência em Carga Horária por Período", value: 1.0 },
  ],
  progress: {
    mandatoryPendingHours: 480,
    optionalPendingHours: 120,
    complementaryPendingHours: 0,
    totalCurriculumHours: 3210,
    percent: 81.31,
  },
  classes: CLASSES,
  activities: [
    { date: day(-6), className: "COMPUTAÇÃO GRÁFICA", kind: "Avaliação", title: "Trab 3", past: true },
    { date: day(2), className: "COMPILADORES", kind: "Avaliação", title: "2ª Avaliação", past: false },
    { date: day(14), className: "EMPREENDEDORISMO", kind: "Avaliação", title: "Trabalho", past: false },
  ],
  updates: [
    { date: day(-8), className: "COMPUTAÇÃO GRÁFICA (2026.2)", description: "Nova Notícia: Trabalho 03 - alteração de data de entrega." },
    { date: day(-11), className: "COMPILADORES (2026.2)", description: "Nova Notícia: Aula de 20/10 cancelada" },
    { date: day(-14), className: "EMPREENDEDORISMO (2026.2)", description: "Nova Notícia: Apresentações Trabalhos" },
    { date: day(-15), className: "COMPILADORES (2026.2)", description: "Tarefa alterada." },
    { date: day(-19), className: "EMPREENDEDORISMO (2026.2)", description: "Novo Tópico de Aula: Cases de Sucesso. Alternativas de Negócios." },
  ],
  forum: [
    { id: "35974352", title: "Ponto facultativo 28/10", author: "servidor.exemplo", replies: 0, date: at(0, "15:01") },
    { id: "35921653", title: "Enade 2026 - Avaliação para discentes ingressantes e concluintes", author: "servidor.exemplo", replies: 0, date: at(-8, "08:10") },
    { id: "35782632", title: "Exame de Proficiência em Língua Inglesa (EPLI)", author: "servidor.exemplo", replies: 0, date: at(-31, "19:10") },
    { id: "35740610", title: "MEPEC e a Feira de Arte e Cultura", author: "servidor.exemplo", replies: 2, date: at(-37, "09:47") },
  ],
};

const n = (v: number | null) => v;
const GRADES: GradesReport = {
  semesters: [
    {
      period: "2026.2",
      unitLabels: ["Unidade 1", "Unidade 2"],
      rows: [
        { code: "CCB0940", name: "COMPILADORES", units: [n(2.8), null], recovery: null, result: null, absences: 4, situation: "--" },
        { code: "CCB0941", name: "COMPUTAÇÃO GRÁFICA", units: [null, null], recovery: null, result: null, absences: 0, situation: "--" },
        { code: "CCB0947", name: "EMPREENDEDORISMO", units: [null, null], recovery: null, result: null, absences: 0, situation: "--" },
        { code: "CCB0949", name: "TRABALHO DE CONCLUSÃO DE CURSO", units: [null, null], recovery: null, result: null, absences: 0, situation: "--" },
      ],
    },
    {
      period: "2026.1",
      unitLabels: ["Unidade 1", "Unidade 2"],
      rows: [
        { code: "CCB09108", name: "PROGRAMAÇÃO COMPETITIVA", units: [9.3, 6.3], recovery: null, result: 7.8, absences: 14, situation: "APROVADO" },
        { code: "CCB0992", name: "PROGRAMAÇÃO DE ALTO DESEMPENHO", units: [9.1, null], recovery: null, result: 9.1, absences: 12, situation: "APROVADO" },
        { code: "CCB0945", name: "PROJETO APLICADO I", units: [10, null], recovery: null, result: 10, absences: 16, situation: "APROVADO" },
        { code: "CCB0946", name: "PROJETO DE TRABALHO DE CONCLUSÃO DE CURSO", units: [9.8, null], recovery: null, result: 9.8, absences: 18, situation: "APROVADO" },
      ],
    },
    {
      period: "2025.2",
      unitLabels: ["Unidade 1", "Unidade 2"],
      rows: [
        { code: "CCB0939", name: "BANCO DE DADOS", units: [8.5, null], recovery: null, result: 8.5, absences: 18, situation: "APROVADO" },
        { code: "EEB0910", name: "FÍSICA I", units: [7.1, null], recovery: null, result: 7.1, absences: 0, situation: "APROVADO" },
        { code: "CCB0942", name: "PROGRAMAÇÃO LÓGICA E FUNCIONAL", units: [9.8, null], recovery: null, result: 9.8, absences: 4, situation: "APROVADO" },
        { code: "CCB0995", name: "SEGURANÇA COMPUTACIONAL", units: [9.7, null], recovery: null, result: 9.7, absences: 8, situation: "APROVADO" },
        { code: "CCA0950", name: "SISTEMAS DISTRIBUÍDOS", units: [9.0, null], recovery: null, result: 9.0, absences: 9, situation: "APROVADO" },
      ],
    },
    {
      period: "2025.1",
      unitLabels: ["Unidade 1", "Unidade 2"],
      rows: [
        { code: "CCB0931", name: "CÁLCULO DIFERENCIAL E INTEGRAL III", units: [7.8, null], recovery: null, result: 7.8, absences: 0, situation: "APROVADO" },
        { code: "CCB0932", name: "MÉTODOS NUMÉRICOS", units: [9.1, null], recovery: null, result: 9.1, absences: 0, situation: "APROVADO" },
        { code: "EEA0924", name: "PROBABILIDADE E ESTATÍSTICA", units: [10, null], recovery: null, result: 10, absences: 0, situation: "APROVADO" },
        { code: "CCB0935", name: "REDES DE COMPUTADORES II", units: [5.2, null], recovery: 7.2, result: 7.2, absences: 8, situation: "APROVADO" },
        { code: "CCB0936", name: "SISTEMAS OPERACIONAIS", units: [8.4, null], recovery: null, result: 8.4, absences: 8, situation: "APROVADO" },
      ],
    },
    {
      period: "2024.2",
      unitLabels: ["Unidade 1", "Unidade 2"],
      rows: [
        { code: "CCB0924", name: "ARQUITETURA DE COMPUTADORES", units: [9.5, null], recovery: null, result: 9.5, absences: 8, situation: "APROVADO" },
        { code: "CCB0927", name: "ENGENHARIA DE SOFTWARE", units: [7.9, null], recovery: null, result: 7.9, absences: 0, situation: "APROVADO" },
        { code: "CCB0929", name: "LINGUAGENS FORMAIS E AUTÔMATOS", units: [9.9, null], recovery: null, result: 9.9, absences: 0, situation: "APROVADO" },
        { code: "CCB0930", name: "REDES DE COMPUTADORES I", units: [3.1, null], recovery: 4.0, result: 4.0, absences: 30, situation: "REPROVADO" },
      ],
    },
  ],
};

function overview(id: string): ClassOverview {
  const cls = CLASSES.find((c) => c.id === id) ?? PAST_CLASSES.find((c) => c.id === id);
  if (!cls) throw new ApiError("NOT_FOUND", "Turma não encontrada.", 404);
  return {
    id,
    code: { COMPILADORES: "CCB0940", "COMPUTAÇÃO GRÁFICA": "CCB0941", EMPREENDEDORISMO: "CCB0947" }[cls.name] ?? "CCB0949",
    name: cls.name,
    period: cls.period,
    workloadHours: 60,
    schedule: `${cls.schedule} (03/08/2026 - 11/12/2026)`,
    lessonsTaught: 42,
    lessonsTotal: 72,
    lastNews: {
      id: "35917358",
      title: "Aula de 20/10 cancelada",
      date: "2026-10-10T17:17",
      html: "<p>Não haverá aula no dia 20/10. Aproveitem para avançar no trabalho prático.</p>",
    },
    topics: [
      {
        title: "Apresentação do plano de ensino. Introdução à compilação.",
        startDate: "2026-08-04",
        endDate: "2026-08-04",
        html: '<p><strong>Leituras</strong><br><a href="https://example.com/plano" target="_blank" rel="noopener noreferrer nofollow">Plano de Ensino</a></p><p>O repositório de materiais complementares possui ferramentas, vídeos, apostilas e cursos para complementar os estudos.</p>',
        materials: [
          { kind: "link", title: "Exercícios de revisão de LFA", url: "https://example.com/exercicios" },
          { kind: "link", title: "Turma no Google Classroom", url: "https://classroom.google.com/" },
        ],
      },
      {
        title: "Análise léxica e expressões regulares",
        startDate: "2026-08-18",
        endDate: "2026-08-18",
        html: "<p>Autômatos finitos, construção de Thompson e subconjuntos.</p><ul><li>Capítulo 3 do livro do dragão</li><li>Lista de exercícios 1</li></ul>",
        materials: [
          { kind: "file", title: "Slides - Análise léxica.pdf", id: "D7CC7FAF766DB59B2D63AF1FD3DDEFB8CD4B0E26" },
          { kind: "file", title: "Lista 1.pdf", id: "E41EB4D8F9B7CF8313A38098DD23A53C5B261056" },
        ],
      },
      {
        title: "Análise sintática com flex + bison",
        startDate: "2026-09-22",
        endDate: "2026-09-22",
        html: "",
        materials: [{ kind: "task", title: "Exercício flex + bison" }],
      },
      {
        title: "1ª Avaliação prática",
        startDate: "2026-09-29",
        endDate: "2026-09-29",
        html: "<p>Avaliação prática em laboratório. Tragam seus códigos.</p>",
        materials: [{ kind: "task", title: "AV1 - prática" }],
      },
    ],
  };
}

/** Over the 25% limit, like real data seen in SIGAA (36 absences vs 18 allowed). */
const ATTENDANCE_OVER: Attendance = {
  records: [
    { date: "2026-08-07", status: "absent", absences: 4 },
    { date: "2026-08-14", status: "absent", absences: 4 },
    { date: "2026-08-21", status: "present", absences: 0 },
    { date: "2026-08-28", status: "absent", absences: 4 },
    { date: "2026-09-04", status: "absent", absences: 4 },
    { date: "2026-09-11", status: "absent", absences: 4 },
    { date: "2026-09-18", status: "absent", absences: 4 },
    { date: "2026-09-25", status: "absent", absences: 4 },
    { date: "2026-10-02", status: "absent", absences: 4 },
    { date: "2026-10-09", status: "absent", absences: 4 },
  ],
  presences: 36,
  totalAbsences: 36,
  lessonsWithRecord: 72,
  lessonsByWorkload: 72,
  percentOfRecorded: 50,
  percentOfWorkload: 50,
  maxAbsences: 18,
};

const ATTENDANCE: Attendance = {
  records: [
    { date: "2026-08-04", status: "present", absences: 0 },
    { date: "2026-08-11", status: "unregistered", absences: 0 },
    { date: "2026-08-18", status: "present", absences: 0 },
    { date: "2026-08-25", status: "present", absences: 0 },
    { date: "2026-09-01", status: "present", absences: 0 },
    { date: "2026-09-08", status: "present", absences: 0 },
    { date: "2026-09-15", status: "absent", absences: 4 },
    { date: "2026-09-22", status: "present", absences: 0 },
    { date: "2026-09-29", status: "present", absences: 0 },
    { date: "2026-10-06", status: "present", absences: 0 },
    { date: "2026-10-13", status: "present", absences: 0 },
    { date: "2026-10-20", status: "unregistered", absences: 0 },
  ],
  presences: 68,
  totalAbsences: 4,
  lessonsWithRecord: 72,
  lessonsByWorkload: 72,
  percentOfRecorded: 94,
  percentOfWorkload: 94,
  maxAbsences: 18,
};

const CLASS_GRADES: ClassGrades = {
  published: true,
  assessments: [
    { group: "Unid. 1", label: "AV1", title: "Prova", weight: "1", value: 8.3, isUnitTotal: false },
    { group: "Unid. 1", label: "AV2", title: "Prova", weight: "1", value: 0, isUnitTotal: false },
    { group: "Unid. 1", label: "AV3", title: "Trabalho", weight: "1", value: null, isUnitTotal: false },
    { group: "Unid. 1", label: "Nota", value: 2.8, isUnitTotal: true },
  ],
  makeup: null,
  result: null,
  absences: 4,
  situation: "REC",
};

const TASKS: Task[] = [
  {
    title: "Trabalho final: gerador de código",
    description: "Implementar a geração de código intermediário para a linguagem da disciplina.",
    start: at(-3, "00:00"),
    end: at(9, "23:59"),
    graded: true,
    submissions: 3,
    corrected: false,
    canSubmit: true,
  },
  {
    title: "Exercício flex + bison",
    description: "Poste aqui os seus códigos. Nos comentários, informe o nome da dupla que realizou a atividade.",
    start: "2026-09-24T00:00",
    end: "2026-10-06T21:53",
    graded: false,
    submissions: 11,
    corrected: false,
    canSubmit: false,
  },
  {
    title: "AV1 - prática",
    description: "Poste aqui os seus arquivos (flex e bison) do exercício prático.",
    start: "2026-09-29T19:00",
    end: "2026-09-29T22:10",
    graded: false,
    submissions: 14,
    corrected: true,
    canSubmit: false,
  },
];

const FILES: FileItem[] = [
  { id: "3641653", title: "Empreendedorismo, Papel do empreendedor", description: "", topic: "Atividades Administrativas, Gerenciais e Processos de planejamento" },
  { id: "3669993", title: "Criatividade, Inovação e Canvas", description: "Slides da aula", topic: "Apresentação de Trabalho. Cases de sucesso" },
  { id: "3595283", title: "Gestão e Estrutura Organizacional", description: "", topic: "Plano de Ensino. Gestão e Estrutura Organizacional." },
];

const NEWS: NewsItem[] = [
  { id: "35917358", title: "Aula de 20/10 cancelada", date: "2026-10-10" },
  { id: "35917359", title: "Material da 1ª avaliação disponível", date: "2026-09-20" },
];

const EVALUATIONS: Evaluation[] = [
  { id: "35429303", date: "2026-09-29", time: "18:30", description: "1a. Avaliação" },
  { id: "35429304", date: day(2), time: "18:30", description: "2a. Avaliação" },
  { id: "35429305", date: day(16), time: "", description: "Trab 1" },
];

const PAST_CLASSES: PastClass[] = [
  ...CLASSES.map((c, i) => ({
    id: c.id,
    code: `CCB094${i}`,
    name: c.name,
    period: c.period,
    group: "01",
    workloadHours: 60,
    schedule: c.schedule,
    startDate: c.startDate,
    endDate: c.endDate,
  })),
  { id: "59A65EA8FABC280D5E86E4D90ECEBFF833A04B3D", code: "CCB09108", name: "PROGRAMAÇÃO COMPETITIVA", period: "2026.1", group: "01", workloadHours: 60, schedule: "2N1234", startDate: "2026-02-19", endDate: "2026-06-26" },
  { id: "1A65EA8FABC280D5E86E4D90ECEBFF833A04B3D0", code: "CCB0992", name: "PROGRAMAÇÃO DE ALTO DESEMPENHO", period: "2026.1", group: "01", workloadHours: 60, schedule: "6N1234", startDate: "2026-02-19", endDate: "2026-06-26" },
  { id: "2A65EA8FABC280D5E86E4D90ECEBFF833A04B3D0", code: "CCB0939", name: "BANCO DE DADOS", period: "2025.2", group: "01", workloadHours: 60, schedule: "6N1234", startDate: "2025-08-04", endDate: "2025-12-12" },
  { id: "3A65EA8FABC280D5E86E4D90ECEBFF833A04B3D0", code: "EEB0910", name: "FÍSICA I", period: "2025.2", group: "01", workloadHours: 60, schedule: "", startDate: "", endDate: "" },
];

const CALENDARS: CalendarRef[] = [
  { id: "35148029", period: "2026.2", name: "CALENDÁRIO GERAL" },
  { id: "33138264", period: "2026.1", name: "CALENDÁRIO GERAL" },
  { id: "32162746", period: "2025.2", name: "CALENDÁRIO GERAL" },
];

const calendar = (period: string, current: boolean): AcademicCalendar => ({
  period,
  current,
  start: day(-80),
  end: day(57),
  sections: [
    {
      title: "Geral",
      events: [
        { label: "Período Letivo", start: day(-80), end: day(57) },
        { label: "Período de Férias", start: day(75), end: day(100) },
      ],
    },
    {
      title: "Datas para Turmas Regulares",
      events: [
        { label: "Consolidação de Turmas", start: day(39), end: day(58) },
        { label: "Cadastro de Turmas", start: day(25), end: day(39) },
        { label: "Trancamento de Turmas", start: day(-80), end: day(-62) },
      ],
    },
    {
      title: "Datas para Períodos de Matrículas, Rematrícula e Processamentos",
      events: [
        { label: "Matrícula OnLine", start: day(-93), end: day(-90) },
        { label: "Rematrícula", start: day(-86), end: day(-84) },
        { label: "Ajustes das Matrículas/Turmas", start: day(-80), end: day(-62) },
      ],
    },
  ],
});

const COMPLEMENTARY: ComplementaryActivities = {
  groups: [
    {
      category: "ENSINO",
      approvedHours: 52,
      activities: [
        { date: "2024-04-15", type: "Participação em cursos/minicursos relacionados à área afim do curso", description: "2 horas", hours: 2, status: "ACEITO" },
        { date: "2024-04-15", type: "Participação em cursos/minicursos relacionados à área afim do curso", description: "20 horas", hours: 20, status: "ACEITO" },
        { date: "2024-04-15", type: "Participação em cursos/minicursos relacionados à área afim do curso", description: "30 horas", hours: 30, status: "ACEITO" },
      ],
    },
    {
      category: "PESQUISA E INOVAÇÃO",
      approvedHours: 624,
      activities: [
        { date: "2025-02-07", type: "Participação em Projeto ou Programa de pesquisa e inovação", description: "Certificado de bolsista de projeto de pesquisa. 624 horas", hours: 624, status: "ACEITO" },
      ],
    },
  ],
};

const forumThread = (id: string): ForumThread => ({
  id,
  title: DASHBOARD.forum.find((t) => t.id === id)?.title ?? "Solicitação de ajuste de matrícula",
  posts: [
    {
      date: at(-12, "13:37"),
      author: "COORDENADOR EXEMPLO",
      html: "Prezados, boa tarde.<br/><br/>As solicitações devem ser encaminhadas para o e-mail da Coordenação.<br/><br/>At.te, Coordenação",
    },
    { date: at(-8, "19:14"), author: "DISCENTE EXEMPLO", html: "Obrigado pelo aviso!" },
  ],
});

const PLAN: TeachingPlan = {
  methodologyHtml:
    "<p>1. Metodologia:<br/>Aulas teóricas com exposição dialogada e aulas práticas em laboratório.<br/>2. Objetivo geral:<br/>Capacitar o aluno a compreender, projetar e implementar compiladores.</p>",
  assessmentHtml: "<p>Três avaliações com peso de 1/3 da nota:<br/>- prova teórico-prática (AV1);<br/>- prova teórica (AV2); e<br/>- trabalho (AV3).</p>",
  officeHours: "Quinta-feira, 13:30-17:30",
  lessons: [
    { start: day(-77), end: day(-77), description: "Apresentação do plano de ensino. Introdução à compilação." },
    { start: day(-63), end: day(-63), description: "Fases da Compilação." },
    { start: day(-56), end: day(-56), description: "Análise Léxica." },
    { start: day(-21), end: day(-21), description: "Prova (AV1)." },
    { start: day(-7), end: day(-7), description: "Análise Semântica." },
    { start: day(0), end: day(0), description: "Geração de Código Intermediário. Otimização de Código." },
    { start: day(7), end: day(7), description: "Alocação de registradores." },
    { start: day(28), end: day(28), description: "Prova (AV2)." },
  ],
  evaluations: [{ date: day(-21), description: "1ª Avaliação" }],
  basicReferences: [],
  complementaryReferences: [
    { type: "Outros", description: "AHO, Alfred V., et al. Compiladores: princípios, técnicas e ferramentas. 2. ed. São Paulo: Pearson Addison Wesley, 2008." },
    { type: "Outros", description: "LOUDEN, K.C. Compiladores: Princípios e Práticas. Editora Thompson Learning, 2004." },
  ],
};

const PARTICIPANTS: Participants = {
  teachers: [{ name: "DOCENTE EXEMPLO", department: "CAMPUS BLUMENAU", degree: "MESTRADO", email: "docente@example.com" }],
  students: ["ALUNO EXEMPLO DA SILVA", "DISCENTE EXEMPLO B", "DISCENTE EXEMPLO C", "DISCENTE EXEMPLO D", "DISCENTE EXEMPLO E"],
};

const REFERENCES: ClassReference[] = [
  { title: "AHO, Alfred V., et al. Compiladores: princípios, técnicas e ferramentas. 2. ed.", type: "Outros" },
  { title: "Documentação do ANTLR", type: "Site", url: "https://www.antlr.org/", topic: "Análise Sintática" },
];

let loggedIn = true;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
  // Simulated SIGAA latency; VITE_MOCK_DELAY=0 makes headless screenshots deterministic.
  const delay = Number(import.meta.env.VITE_MOCK_DELAY ?? 450);
  if (delay > 0) await sleep(delay * (0.6 + Math.random() * 0.8));
  const ok = (data: unknown) => ({ data: data as T, fetchedAt: new Date(Date.now() - 2 * 60_000).toISOString() });
  const url = new URL(path, "http://mock");
  const p = url.pathname;

  if (p === "/api/auth/login" && method === "POST") {
    const { username, password } = (body ?? {}) as { username?: string; password?: string };
    if (!username || password === "errada") throw new ApiError("INVALID_CREDENTIALS", "Usuário e/ou senha inválidos.", 401);
    loggedIn = true;
    return ok(SESSION);
  }
  if (p === "/api/auth/logout") {
    loggedIn = false;
    return ok(undefined);
  }
  if (!loggedIn) throw new ApiError("UNAUTHENTICATED", "Faça login.", 401);

  if (p === "/api/session") return ok(SESSION);
  if (p === "/api/dashboard") return ok(DASHBOARD);
  if (p === "/api/grades") return ok(GRADES);
  if (p === "/api/past-classes") return ok(PAST_CLASSES);
  if (p === "/api/calendars") return ok(CALENDARS);
  if (p === "/api/complementary-activities") return ok(COMPLEMENTARY);
  if (p === "/api/forum") return ok(DASHBOARD.forum);
  const cal = /^\/api\/calendars\/([^/]+)$/.exec(p);
  if (cal) {
    const ref = CALENDARS.find((c) => c.id === cal[1]);
    if (!ref) throw new ApiError("NOT_FOUND", "Calendário não encontrado.", 404);
    return ok(calendar(ref.period, ref === CALENDARS[0]));
  }
  const topic = /^\/api\/forum\/([^/]+)$/.exec(p);
  if (topic) return ok(forumThread(topic[1]!));

  const m = /^\/api\/classes\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/.exec(p);
  if (m) {
    const [, id = "", part, sub] = m;
    const base = overview(decodeURIComponent(id));
    switch (part) {
      case undefined:
        return ok(base);
      // Vary per class so every UI state can be seen: TCC is over the absence
      // limit and Empreendedorismo has no grades published yet.
      case "attendance":
        return ok(base.name === "TRABALHO DE CONCLUSÃO DE CURSO" ? ATTENDANCE_OVER : ATTENDANCE);
      case "grades":
        return ok(
          base.name === "EMPREENDEDORISMO"
            ? { published: false, assessments: [], makeup: null, result: null, absences: null, situation: "" }
            : CLASS_GRADES,
        );
      case "tasks":
        return ok(TASKS);
      case "files":
        return ok(FILES);
      case "evaluations":
        return ok(EVALUATIONS);
      case "plan":
        return ok(PLAN);
      case "participants":
        return ok(PARTICIPANTS);
      case "references":
        return ok(REFERENCES);
      case "news":
        if (sub) {
          const item = NEWS.find((x) => x.id === sub);
          if (!item) throw new ApiError("NOT_FOUND", "Notícia não encontrada.", 404);
          return ok({ ...item, date: `${item.date}T17:17`, html: "<p>Não haverá aula de compiladores no dia 20/10.</p><p>Bons estudos!</p>" });
        }
        return ok(NEWS);
    }
  }
  throw new ApiError("NOT_FOUND", "Rota inexistente no mock.", 404);
}
