// Client for the Express AI API server

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  generatePlan: (userId: string) =>
    post<{ success: boolean }>('/ai/generate-plan', { userId }),

  checkinResponse: (params: {
    userId: string
    checkinId: string
    feeling: number
    soreness_notes?: string
    todaySessionId?: string
  }) => post<{ coach_response: string; plan_adjusted: boolean; adjustment_details?: string }>('/ai/checkin-response', params),

  postWorkout: (params: {
    userId: string
    workoutLogId: string
    sessionId?: string
    rpe: number
    user_note?: string
    actual_distance_km?: number
    actual_duration_minutes?: number
  }) => post<{ coach_response: string }>('/ai/post-workout', params),

  weeklyNote: (params: { userId: string; weekNumber: number; planId: string }) =>
    post<{ success: boolean }>('/ai/weekly-note', params),

  goalCompletion: (params: { userId: string; goalId: string }) =>
    post<{ success: boolean }>('/ai/goal-completion', params),
}
