
import {
  useMutation,
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

    onSuccess: (_, variables) => {
      if (variables.path === "/profile") {
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
      }
    }
  });
}