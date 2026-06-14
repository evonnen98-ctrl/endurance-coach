import { supabase } from '../lib/supabase.js'

const userId = '00000000-0000-0000-0000-000000000001'

async function reset() {
  await supabase.from('sessions').delete().eq('user_id', userId)
  await supabase.from('training_plans').delete().eq('user_id', userId)
  console.log('plan reset complete')
}

reset().catch(console.error)
