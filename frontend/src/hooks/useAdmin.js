
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import useAuth from "./useAuth";

export function useAdminOverview() {
  const { token, user } = useAuth();

  return useQuery({
    queryKey: ["admin", "overview", token],
    queryFn: () =>
      apiRequest("/admin/overview", {}, token),
    enabled: Boolean(
      token && user?.role === "admin"
    ),
    refetchInterval: 15000
  });
}

export function useAdminStudents() {
  const { token, user } = useAuth();

  return useQuery({
    queryKey: ["admin", "students", token],
    queryFn: async () =>
      (
        await apiRequest(
          "/admin/students",
          {},
          token
        )
      ).students || [],
    enabled: Boolean(
      token && user?.role === "admin"
    ),
    refetchInterval: 15000
  });
}

export function useAdminStudent(id) {
  const { token, user } = useAuth();

  return useQuery({
    queryKey: ["admin", "student", token, id],
    queryFn: () =>
      apiRequest(`/admin/students/${id}`, {}, token),
    enabled: Boolean(
      id &&
      token &&
      user?.role === "admin"
    ),
    refetchInterval: 15000
  });
}

export function useAdminRecords(filters) {
  const { token, user } = useAuth();

  const params = new URLSearchParams();

  if (filters.studentId) {
    params.set("studentId", filters.studentId);
  }

  if (
    filters.status &&
    filters.status !== "all"
  ) {
    params.set("status", filters.status);
  }

  params.set(
    "page",
    String(filters.page || 1)
  );

  return useQuery({
    queryKey: [
      "admin",
      "records",
      token,
      filters.studentId,
      filters.status,
      filters.page
    ],
    queryFn: () =>
      apiRequest(
        `/admin/records?${params.toString()}`,
        {},
        token
      ),
    enabled: Boolean(
      token && user?.role === "admin"
    ),
    refetchInterval: 12000
  });
}

export function useAdminAction() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

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
          ...(body === undefined
            ? {}
            : {
                body: JSON.stringify(body)
              })
        },
        token
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin"]
      });

      queryClient.invalidateQueries({
        queryKey: ["logs"]
      });

      queryClient.invalidateQueries({
        queryKey: ["students"]
      });

      queryClient.invalidateQueries({
        queryKey: ["schedule"]
      });
    }
  });
}
