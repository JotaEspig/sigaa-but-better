import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, request } from "./client";
import type {
  AcademicCalendar,
  Attendance,
  CalendarRef,
  ClassReference,
  ComplementaryActivities,
  ForumThread,
  ForumTopic,
  Participants,
  PastClass,
  TeachingPlan,
  ClassGrades,
  ClassOverview,
  Dashboard,
  Envelope,
  Evaluation,
  FileItem,
  GradesReport,
  NewsItem,
  SessionInfo,
  Task,
} from "./types";

export const keys = {
  session: ["session"] as const,
  dashboard: ["dashboard"] as const,
  grades: ["grades"] as const,
  class: (id: string) => ["class", id] as const,
  classPart: (id: string, part: string) => ["class", id, part] as const,
  news: (id: string, newsId: string) => ["class", id, "news", newsId] as const,
  pastClasses: ["past-classes"] as const,
  calendars: ["calendars"] as const,
  calendar: (id: string) => ["calendars", id] as const,
  complementary: ["complementary-activities"] as const,
  forum: ["forum"] as const,
  forumThread: (id: string) => ["forum", id] as const,
};

/**
 * Wraps useQuery so every screen gets a `refresh()` that bypasses the BFF cache
 * (?refresh=1) instead of just re-reading it.
 */
function useEnvelopeQuery<T>(key: readonly unknown[], path: string, enabled = true) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const query: UseQueryResult<Envelope<T>, ApiError> = useQuery<Envelope<T>, ApiError>({
    queryKey: key,
    queryFn: ({ signal }) => request<T>(path, { signal }),
    enabled,
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await request<T>(path, { refresh: true });
      qc.setQueryData(key, fresh);
    } catch {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return { ...query, refresh, refreshing };
}

export function useSession() {
  return useQuery<Envelope<SessionInfo>, ApiError>({
    queryKey: keys.session,
    queryFn: ({ signal }) => request<SessionInfo>("/api/session", { signal, skipAuthRedirect: true }),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<Envelope<SessionInfo>, ApiError, { username: string; password: string }>({
    mutationFn: (body) => request<SessionInfo>("/api/auth/login", { method: "POST", body, skipAuthRedirect: true }),
    onSuccess: (data) => {
      qc.clear();
      qc.setQueryData(keys.session, data);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, void>({
    mutationFn: () => request<void>("/api/auth/logout", { method: "POST", body: {}, skipAuthRedirect: true }),
    onSettled: () => qc.clear(),
  });
}

export const useDashboard = () => useEnvelopeQuery<Dashboard>(keys.dashboard, "/api/dashboard");
export const useGrades = () => useEnvelopeQuery<GradesReport>(keys.grades, "/api/grades");

const classPath = (id: string, part = "") => `/api/classes/${encodeURIComponent(id)}${part}`;

export const useClass = (id: string) => useEnvelopeQuery<ClassOverview>(keys.class(id), classPath(id));
export const useClassAttendance = (id: string, enabled = true) =>
  useEnvelopeQuery<Attendance>(keys.classPart(id, "attendance"), classPath(id, "/attendance"), enabled);
export const useClassGrades = (id: string, enabled = true) =>
  useEnvelopeQuery<ClassGrades>(keys.classPart(id, "grades"), classPath(id, "/grades"), enabled);
export const useClassTasks = (id: string, enabled = true) =>
  useEnvelopeQuery<Task[]>(keys.classPart(id, "tasks"), classPath(id, "/tasks"), enabled);
export const useClassFiles = (id: string, enabled = true) =>
  useEnvelopeQuery<FileItem[]>(keys.classPart(id, "files"), classPath(id, "/files"), enabled);
export const useClassNews = (id: string, enabled = true) =>
  useEnvelopeQuery<NewsItem[]>(keys.classPart(id, "news"), classPath(id, "/news"), enabled);
export const useClassEvaluations = (id: string, enabled = true) =>
  useEnvelopeQuery<Evaluation[]>(keys.classPart(id, "evaluations"), classPath(id, "/evaluations"), enabled);
export const useNewsDetail = (id: string, newsId: string | null) =>
  useEnvelopeQuery<NewsItem>(keys.news(id, newsId ?? ""), classPath(id, `/news/${encodeURIComponent(newsId ?? "")}`), !!newsId);
export const useClassPlan = (id: string, enabled = true) =>
  useEnvelopeQuery<TeachingPlan>(keys.classPart(id, "plan"), classPath(id, "/plan"), enabled);
export const useClassParticipants = (id: string, enabled = true) =>
  useEnvelopeQuery<Participants>(keys.classPart(id, "participants"), classPath(id, "/participants"), enabled);
export const useClassReferences = (id: string, enabled = true) =>
  useEnvelopeQuery<ClassReference[]>(keys.classPart(id, "references"), classPath(id, "/references"), enabled);

export const usePastClasses = () => useEnvelopeQuery<PastClass[]>(keys.pastClasses, "/api/past-classes");
export const useCalendars = () => useEnvelopeQuery<CalendarRef[]>(keys.calendars, "/api/calendars");
export const useCalendar = (id: string | undefined) =>
  useEnvelopeQuery<AcademicCalendar>(keys.calendar(id ?? ""), `/api/calendars/${encodeURIComponent(id ?? "")}`, !!id);
export const useComplementaryActivities = () => useEnvelopeQuery<ComplementaryActivities>(keys.complementary, "/api/complementary-activities");
export const useForum = () => useEnvelopeQuery<ForumTopic[]>(keys.forum, "/api/forum");
export const useForumThread = (id: string) =>
  useEnvelopeQuery<ForumThread>(keys.forumThread(id), `/api/forum/${encodeURIComponent(id)}`);
