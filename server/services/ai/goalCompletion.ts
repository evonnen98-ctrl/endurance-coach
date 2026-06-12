import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { UserContext } from '../userContext.js'

const client = new Anthropic()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const prompt = `You are an endurance coach writing a post-race/goal completion message for your athlete.

ATHLETE: ${context.user.name}
GOAL COMPLETED: ${goal?.event_type ?? 'race'}
TRAINING BLOCK: ${context.current_week} weeks
TRAINING OVERVIEW: ${context.recent_workouts.slice(0, 8).map(w => `${w.date}: ${w.discipline} — RPE ${w.rpe ?? '?'}`).join(', ')}

Write a warm, specific post-race message that:
1. Acknowledges the achievement authentically
2. Briefly summarises what they built during the block (1-2 specifics)
3. Recommends a recovery week approach
4. Ends with an encouraging prompt to set their next goal

Keep it under 200 words. Write directly to the athlete (use "you").

Return JSON:
{
  "post_race_note": "Your full message here",
  "recovery_week_guidance": "Short 2-sentence guidance for this week",
  "next_goal_prompt": "One question to get them thinking about what's next"
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return

  const result = JSON.parse(jsonMatch[0])

  // Mark goal complete
  await supabase.from('goals').update({ status: 'complete' }).eq('id', goalId)

  return result
}
