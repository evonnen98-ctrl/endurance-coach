import Anthropic from '@anthropic-ai/sdk'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'
import { COACH_SYSTEM_PROMPT } from './coachingPrompt.js'

const client = new Anthropic()

export async function generateGoalCompletion(
  userId: string,
  goalId: string,
  context: UserContext
) {
  const { data: goal } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single()

  const prompt = `Write a post-race/goal completion message for this athlete.

ATHLETE: ${context.user.name}
GOAL COMPLETED: ${goal?.event_type ?? 'race'}
TRAINING BLOCK: ${context.current_week} weeks
RECENT WORKOUTS: ${context.recent_workouts.slice(0, 8).map(w => `${w.date}: ${w.discipline} RPE ${w.rpe ?? '?'}`).join(', ')}

Write a message that:
1. Acknowledges the achievement specifically (not generically)
2. References 1-2 specifics from the training data
3. Recommends a concrete recovery week approach
4. Ends with a prompt toward the next goal

Under 200 words. Write directly to the athlete.

Return JSON:
{
  "post_race_note": "Your full message",
  "recovery_week_guidance": "2-sentence recovery guidance for this week",
  "next_goal_prompt": "One specific question to get them thinking about what's next"
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return

  const result = JSON.parse(jsonMatch[0])

  await supabase.from('goals').update({ status: 'complete' }).eq('id', goalId)

  return result
}
