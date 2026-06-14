export type Discipline = 'swim' | 'ride' | 'run' | 'rest' | 'brick'
export type TrainingPhase = 'race' | 'build' | 'maintain' | 'return'
export type SessionStatus = 'planned' | 'complete' | 'modified' | 'skipped'
export type GoalStatus = 'active' | 'complete'
export type FeelingScore = 1 | 2 | 3 | 4 | 5
export type TrainingStyle = 'conservative' | 'moderate' | 'aggressive'

export interface User {
  id: string
  name: string
  disciplines: Discipline[]
  training_phase: TrainingPhase
  preferences: Record<string, string | number>
  injury_notes?: string
  coach_notes_freetext?: string
  preferred_training_days?: Record<string, Discipline>
  training_style: TrainingStyle
  ftp?: number
  swim_pool_or_open?: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  discipline?: string
  event_type?: string
  target_date?: string
  status: GoalStatus
  created_at: string
}

export interface TrainingPlan {
  id: string
  user_id: string
  goal_id?: string
  start_date: string
  end_date: string
  total_weeks: number
  status: string
  created_at: string
}

export interface SessionStructureStep {
  description: string
}

export interface Session {
  id: string
  plan_id: string
  user_id: string
  week_number: number
  day_of_week: number
  scheduled_date: string
  discipline: Discipline
  session_type: string
  title: string
  description?: string
  duration_minutes?: number
  distance_km?: number
  target_pace?: string
  target_power?: string
  effort_zone?: string
  session_structure?: SessionStructureStep[]
  coaching_rationale?: string
  status: SessionStatus
  original_data?: Partial<Session>
  modification_reason?: string
  created_at: string
  updated_at: string
}

export interface WorkoutLog {
  id: string
  session_id?: string
  user_id: string
  logged_at: string
  actual_distance_km?: number
  actual_duration_minutes?: number
  actual_pace?: string
  actual_power_watts?: number
  rpe?: number
  user_note?: string
  coach_response?: string
  source: 'manual' | 'garmin' | 'strava' | 'apple_health'
  external_id?: string
  average_hr?: number
  average_pace_per_km?: string
  average_power_watts?: number
  hrv?: number
  sleep_score?: number
  raw_data?: Record<string, unknown>
  injury_flag?: boolean
  conditions_notes?: string
  created_at: string
}

export interface Checkin {
  id: string
  user_id: string
  session_id?: string
  checkin_date: string
  feeling?: FeelingScore
  soreness_notes?: string
  coach_response?: string
  plan_adjusted?: boolean
  adjustment_details?: string
  created_at: string
}

export interface MetricPill {
  label: string
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'grey'
}

export interface CoachNote {
  id: string
  user_id: string
  plan_id?: string
  week_number: number
  week_start: string
  week_end: string
  metric_pills?: MetricPill[]
  headline?: string
  swim_observations?: string
  ride_observations?: string
  run_observations?: string
  recovery_assessment?: string
  looking_ahead?: string
  closing_prompt?: string
  user_reply?: string
  user_reply_at?: string
  created_at: string
}

// API request/response types
export interface GeneratePlanRequest {
  userId: string
}

export interface CheckinResponseRequest {
  userId: string
  checkinId: string
  feeling: FeelingScore
  soreness_notes?: string
  todaySessionId?: string
}

export interface PostWorkoutRequest {
  userId: string
  workoutLogId: string
  sessionId?: string
  rpe: number
  user_note?: string
  actual_distance_km?: number
  actual_duration_minutes?: number
}

export interface WeeklyNoteRequest {
  userId: string
  weekNumber: number
  planId: string
}

export interface GoalCompletionRequest {
  userId: string
  goalId: string
}

export interface StravaConnection {
  connected: boolean
  athlete_name?: string
  athlete_photo_url?: string
}
