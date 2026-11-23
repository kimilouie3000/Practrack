import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/client";

export function usePracTrackSettings() {
  return useQuery({
    queryKey: ["practrack-public-settings"],
    queryFn: () => apiRequest("/settings/public"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });
}
