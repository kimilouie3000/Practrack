import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import useAuth from "./useAuth";

export function usePortalQuery(path, enabled = true) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["portal", path, token],
    queryFn: () => apiRequest(path, {}, token),
    enabled: Boolean(token && path && enabled),
    staleTime: 10000
  });
}

export function usePortalAction() {
  const { token } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = "POST", body }) => apiRequest(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }, token),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["portal"] }),
        cache.invalidateQueries({ queryKey: ["admin"] }),
        cache.invalidateQueries({ queryKey: ["logs"] }),
        cache.invalidateQueries({ queryKey: ["schedule"] })
      ]);
    }
  });
}