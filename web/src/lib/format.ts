// Formatting helpers. SIGAA dates come as local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm"
// with no offset; parsing them with `new Date(str)` would treat date-only strings
// as UTC and shift the day, so we always build Dates from components.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export function parseLocal(value: string): Date | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 0, mi ? Number(mi) : 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from `now` to `date` (negative = past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const ms = startOfDay(date).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

export function relativeDays(value: string, now: Date = new Date()): string {
  const d = parseLocal(value);
  if (!d) return value;
  const n = daysUntil(d, now);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n > 1) return `em ${n} dias`;
  return `há ${-n} dias`;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function formatDate(value: string): string {
  const d = parseLocal(value);
  return d ? dateFmt.format(d) : value;
}

/** "15 de out." */
export function formatShortDate(value: string): string {
  const d = parseLocal(value);
  return d ? shortDateFmt.format(d) : value;
}

/** "Quarta-feira, 21 de outubro" (only the first letter capitalized). */
export function formatLongDate(d: Date): string {
  const s = longDateFmt.format(d);
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

export function formatDateTime(value: string): string {
  const d = parseLocal(value);
  if (!d) return value;
  return value.includes("T") ? `${dateFmt.format(d)} às ${timeFmt.format(d)}` : dateFmt.format(d);
}

const gradeFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 9.25 → "9,3"; null → "–". */
export function formatGrade(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return gradeFmt.format(value);
}

/** SIGAA prefixes updates with their kind ("Nova Notícia: …"); keep only the message. */
export function updateMessage(description: string): string {
  const m = /^[^:]{3,30}:\s*(.+)$/s.exec(description.trim());
  return m?.[1] ?? description;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value)}%`;
}

/** "atualizado agora", "há 3 min", "há 2 h". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 45) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** "JOÃO DA SILVA" → "João da Silva". */
export function titleCase(value: string): string {
  const lower = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "para", "com"]);
  const keepUpper = /^(I{1,3}|IV|V|VI{0,3}|IX|X|TCC|IFC|II)$/;
  return value
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+)/)
    .map((w, i) => {
      if (/^\s+$/.test(w) || w === "") return w;
      if (keepUpper.test(w.toUpperCase())) return w.toUpperCase();
      if (i > 0 && lower.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1);
    })
    .join("");
}

export function firstName(fullName: string): string {
  return titleCase(fullName.trim().split(/\s+/)[0] ?? "");
}

/** "ALUNO EXEMPLO DA SILVA" → "AS": first and last word, skipping "da", "de"… */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter((w) => w.length > 2);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}
