
import {
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import useAuth from "./useAuth";

export function useProfile() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["profile", token],
    queryFn: async () =>
      (await apiRequest("/profile", {}, token)).profile,
    enabled: Boolean(token),
    retry: 1,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });
}

export function useRecords() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["logs", token],
    queryFn: async () =>
      (await apiRequest("/logs", {}, token)).entries || [],
    enabled: Boolean(token),
    refetchInterval: 8000,
    refetchOnWindowFocus: true
  });
}

// Load attendance history in explicit pages rather than hiding older entries.
export function useRecordHistory() {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["logs-history", token],
    queryFn: ({ pageParam = 1 }) =>
      apiRequest(`/logs?page=${pageParam}&limit=100`, {}, token),
    initialPageParam: 1,
    getNextPageParam: last => last.page < last.pages ? last.page + 1 : undefined,
    enabled: Boolean(token),
    retry: 1,
    refetchOnWindowFocus: false
  });
}

export function useSchedules() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["schedule", token],
    queryFn: async () =>
      (await apiRequest("/schedule", {}, token)).schedules || [],
    enabled: Boolean(token),
    refetchInterval: 15000,
    refetchOnWindowFocus: true
  });
}

export function useStudents() {
  const { token, user } = useAuth();

  const isStaff = ["admin", "teacher"].includes(
    user?.role
  );

  return useQuery({
    queryKey: ["students", token],
    queryFn: async () =>
      (await apiRequest("/users", {}, token)).users || [],
    enabled: Boolean(token && isStaff),
    refetchInterval: 15000,
    refetchOnWindowFocus: true
  });
}

export function useApiAction() {
  const { token } = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body
    }) =>
      apiRequest(
        path,
        {
          method,
          ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {})
        },
        token
      ),

    onSuccess: (data, variables) => {
      if (variables.path === "/profile") {
        // Update the onboarding gate immediately before navigation.
        // A background refetch still reconciles server-side changes.
        if (data?.profile) {
          client.setQueryData(["profile", token], data.profile);
        }
        client.invalidateQueries({
          queryKey: ["profile", token]
        });
      }

      if (variables.path.startsWith("/schedule")) {
        client.invalidateQueries({
          queryKey: ["schedule", token]
        });
      }

      if (variables.path.startsWith("/logs")) {
        client.invalidateQueries({
          queryKey: ["logs", token]
        });
        client.invalidateQueries({ queryKey: ["logs-history", token] });
      }
    }
  });
}