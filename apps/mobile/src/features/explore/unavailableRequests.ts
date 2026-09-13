const unavailableRequestIds = new Set<string>();

export function markExploreRequestUnavailable(requestId: string) {
  unavailableRequestIds.add(requestId);
}

export function getUnavailableExploreRequestIds() {
  return new Set(unavailableRequestIds);
}

export function clearUnavailableExploreRequests() {
  unavailableRequestIds.clear();
}
