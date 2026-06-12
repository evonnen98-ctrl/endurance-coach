-- Run this after schema.sql (safe to re-run — deletes and re-inserts demo data)
-- Mock athlete: Alex, Olympic Tri, Week 4 of 12, today = 2026-06-12 (Friday)
-- Plan: May 18 – Aug 9, 2026
-- Week 1: May 18-24 | Week 2: May 25-31 | Week 3: Jun 1-7 | Week 4: Jun 8-14 (current)

-- ─── CLEAN SLATE ────────────────────────────────────────────────────────────
delete from workout_logs where user_id = '00000000-0000-0000-0000-000000000001';
delete from checkins     where user_id = '00000000-0000-0000-0000-000000000001';
delete from coach_notes  where user_id = '00000000-0000-0000-0000-000000000001';
delete from sessions     where user_id = '00000000-0000-0000-0000-000000000001';
delete from training_plans where user_id = '00000000-0000-0000-0000-000000000001';
delete from goals        where user_id = '00000000-0000-0000-0000-000000000001';
delete from users        where id      = '00000000-0000-0000-0000-000000000001';

-- Fixed IDs for consistent referencing
do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_goal_id uuid := '00000000-0000-0000-0000-000000000002';
  v_plan_id uuid := '00000000-0000-0000-0000-000000000003';
begin

-- ─── USER ───────────────────────────────────────────────────────────────────
insert into users (id, name, disciplines, training_phase, training_style, ftp,
  swim_pool_or_open, onboarding_complete,
  preferences, coach_notes_freetext)
values (
  v_user_id, 'Alex',
  array['swim','ride','run'],
  'race', 'moderate', 240,
  'pool', true,
  '{"run_pace_easy":"5:20/km","swim_pace_100m":"1:45","run_weekly_km":35,"ride_weekly_km":120}'::jsonb,
  'I like long sessions on weekends. Prefer not to swim Mondays. Weekday sessions need to be under 90 mins.'
) on conflict (id) do nothing;

-- ─── GOAL ───────────────────────────────────────────────────────────────────
insert into goals (id, user_id, discipline, event_type, target_date, status)
values (v_goal_id, v_user_id, 'triathlon', 'Olympic Tri', '2026-08-09', 'active')
on conflict (id) do nothing;

-- ─── TRAINING PLAN ──────────────────────────────────────────────────────────
insert into training_plans (id, user_id, goal_id, start_date, end_date, total_weeks, status)
values (v_plan_id, v_user_id, v_goal_id, '2026-05-18', '2026-08-09', 12, 'active')
on conflict (id) do nothing;

-- ─── SESSIONS ───────────────────────────────────────────────────────────────
-- WEEK 1 (May 18-24) — Base
insert into sessions (plan_id, user_id, week_number, day_of_week, scheduled_date, discipline, session_type, title, description, duration_minutes, distance_km, target_pace, effort_zone, session_structure, coaching_rationale, status) values
(v_plan_id, v_user_id, 1, 0, '2026-05-18', 'swim', 'Aerobic', 'Swim — Aerobic', '2.5 km steady', 50, 2.5, '1:55/100m', 'Z2', '[{"description":"400m warm-up easy"},{"description":"8 × 50m drills (catch-up / fist)"},{"description":"1500m continuous @ aerobic"},{"description":"200m cool down"}]'::jsonb, 'Easy aerobic swim to open the block. Re-establish feel for the water after a light week.', 'complete'),
(v_plan_id, v_user_id, 1, 1, '2026-05-19', 'ride', 'Endurance', 'Ride — Endurance', '60 km steady Z2', 120, 60.0, null, 'Z2', '[{"description":"10 min warm-up spin"},{"description":"90 min steady Z2 @ 65-75% FTP"},{"description":"10 min cool down"}]'::jsonb, 'Long aerobic ride to build base. Keep power in Z2 and resist the urge to push harder.', 'complete'),
(v_plan_id, v_user_id, 1, 2, '2026-05-20', 'run', 'Easy', 'Run — Easy', '8 km conversational', 45, 8.0, '5:30/km', 'Z2', '[{"description":"5 min walk/jog warm-up"},{"description":"35 min easy run at conversational pace"},{"description":"5 min walk cool down"}]'::jsonb, 'Pure recovery run. If you feel the urge to pick it up, slow down instead.', 'complete'),
(v_plan_id, v_user_id, 1, 3, '2026-05-21', 'swim', 'Technique', 'Swim — Technique', '1.8 km drills + form work', 45, 1.8, '2:00/100m', 'Z1', '[{"description":"300m warm-up easy"},{"description":"6 × 100m drill sets (catch-up, fingertip drag, side kick)"},{"description":"400m steady focusing on form"},{"description":"200m easy cool down"}]'::jsonb, 'Technique focus. Slow down to lock in better mechanics before volume builds.', 'complete'),
(v_plan_id, v_user_id, 1, 4, '2026-05-22', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Adaptation happens between sessions, not during them. Full rest today.', 'complete'),
(v_plan_id, v_user_id, 1, 5, '2026-05-23', 'brick', 'Brick', 'Brick — Ride + Run', '60 min ride → 15 min run off bike', 75, null, null, 'Z2', '[{"description":"60 min ride Z2 steady"},{"description":"Transition: rack bike, shoes on"},{"description":"15 min run at race pace effort — legs will feel heavy, that is normal"}]'::jsonb, 'First brick of the block. The run off the bike is short — focus on the transition feeling, not pace.', 'complete'),
(v_plan_id, v_user_id, 1, 6, '2026-05-24', 'run', 'Long Run', 'Run — Long', '10 km easy', 55, 10.0, '5:30/km', 'Z2', '[{"description":"5 min warm-up walk"},{"description":"45 min easy long run"},{"description":"5 min cool down"}]'::jsonb, 'Long run at easy effort. Build time on feet — pace does not matter this week.', 'complete'),

-- WEEK 2 (May 25-31) — Building
(v_plan_id, v_user_id, 2, 0, '2026-05-25', 'swim', 'Aerobic', 'Swim — Aerobic', '2.8 km steady', 55, 2.8, '1:52/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"10 × 50m pull buoy"},{"description":"1800m continuous aerobic"},{"description":"200m cool down"}]'::jsonb, 'Slightly longer aerobic swim. Pull buoy sets to build upper body endurance.', 'complete'),
(v_plan_id, v_user_id, 2, 1, '2026-05-26', 'ride', 'Endurance', 'Ride — Endurance', '70 km steady Z2', 130, 70.0, null, 'Z2', '[{"description":"10 min warm-up"},{"description":"105 min steady Z2"},{"description":"5 min spin-down"}]'::jsonb, 'Volume step-up week on the bike. Stay aerobic — this is not the week to push FTP.', 'complete'),
(v_plan_id, v_user_id, 2, 2, '2026-05-27', 'run', 'Easy', 'Run — Easy', '9 km conversational', 50, 9.0, '5:25/km', 'Z2', '[{"description":"5 min warm-up"},{"description":"40 min easy"},{"description":"5 min cool down"}]'::jsonb, 'Easy run to complement the bike load. Keep HR in check.', 'complete'),
(v_plan_id, v_user_id, 2, 3, '2026-05-28', 'swim', 'Threshold', 'Swim — Threshold', '2 km with efforts', 50, 2.0, '1:42/100m', 'Z3', '[{"description":"400m warm-up"},{"description":"5 × 200m @ threshold pace (30s rest)"},{"description":"200m easy cool down"}]'::jsonb, 'First threshold swim of the block. Target pace should feel controlled, not all-out.', 'complete'),
(v_plan_id, v_user_id, 2, 4, '2026-05-29', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest. Your body is adapting to the first week load. Trust the process.', 'complete'),
(v_plan_id, v_user_id, 2, 5, '2026-05-30', 'brick', 'Brick', 'Brick — Ride + Run', '75 min ride → 20 min run', 95, null, null, 'Z2-Z3', '[{"description":"75 min ride — 60 min Z2, last 15 min push to Z3"},{"description":"Transition"},{"description":"20 min run at race effort"}]'::jsonb, 'Longer brick with a stronger finish on the bike. The run should start to feel more natural.', 'complete'),
(v_plan_id, v_user_id, 2, 6, '2026-05-31', 'run', 'Long Run', 'Run — Long', '12 km easy', 65, 12.0, '5:25/km', 'Z2', '[{"description":"5 min warm-up"},{"description":"55 min easy long run"},{"description":"5 min walk cool down"}]'::jsonb, 'Building long run. Keep it truly easy — this is aerobic time, not a test.', 'complete'),

-- WEEK 3 (Jun 1-7) — Build
(v_plan_id, v_user_id, 3, 0, '2026-06-01', 'swim', 'Aerobic', 'Swim — Aerobic', '3 km steady', 60, 3.0, '1:50/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"10 × 50m drills"},{"description":"1500m continuous"},{"description":"8 × 75m at threshold"},{"description":"300m cool down"}]'::jsonb, 'Stronger aerobic swim with a short threshold block at the end. Volume up to 3 km.', 'complete'),
(v_plan_id, v_user_id, 3, 1, '2026-06-02', 'ride', 'Endurance + Tempo', 'Ride — Endurance + Tempo', '80 km with tempo efforts', 130, 80.0, null, 'Z2-Z3', '[{"description":"15 min warm-up Z1"},{"description":"2 × 20 min @ Z3 (10 min Z2 between)"},{"description":"Balance of ride Z2"},{"description":"10 min cool down"}]'::jsonb, 'First tempo efforts on the bike. Two 20-minute blocks at Z3. Keep the rest easy.', 'complete'),
(v_plan_id, v_user_id, 3, 2, '2026-06-03', 'run', 'Easy + Strides', 'Run — Easy + Strides', '9 km easy with strides', 52, 9.0, '5:20/km', 'Z2', '[{"description":"5 min warm-up"},{"description":"35 min easy"},{"description":"5 × 20s strides at 5km race effort (60s walk jog between)"},{"description":"5 min cool down"}]'::jsonb, 'Easy run with strides to maintain leg turnover without adding fatigue. Keep the strides sharp and short.', 'complete'),
(v_plan_id, v_user_id, 3, 3, '2026-06-04', 'swim', 'Technique', 'Swim — Technique', '1.8 km drills + form work', 45, 1.8, '1:55/100m', 'Z1', '[{"description":"300m easy"},{"description":"8 × 100m drill focus (alternate catch-up and fingertip drag)"},{"description":"400m pulling"},{"description":"200m cool down"}]'::jsonb, 'Mid-week technique reset before the heavier weekend. Quality over quantity.', 'complete'),
(v_plan_id, v_user_id, 3, 4, '2026-06-05', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest. Big weekend ahead — arrive at Saturday fresh.', 'complete'),
(v_plan_id, v_user_id, 3, 5, '2026-06-06', 'brick', 'Brick', 'Brick — Ride + Run', '90 min ride → 20 min run off bike', 110, null, null, 'Z2-Z3', '[{"description":"90 min ride: 60 min Z2, 20 min Z3 tempo, 10 min cool down"},{"description":"Transition"},{"description":"20 min run — first 10 min easy to flush legs, last 10 min at race pace"}]'::jsonb, 'Longer brick with a proper tempo block on the bike and a structured run. This is your race simulation prep.', 'complete'),
(v_plan_id, v_user_id, 3, 6, '2026-06-07', 'run', 'Long Run', 'Run — Long', '13 km easy', 70, 13.0, '5:25/km', 'Z2', '[{"description":"5 min warm-up walk"},{"description":"60 min easy long run"},{"description":"5 min cool down"}]'::jsonb, 'Longest run so far. Keep it aerobic. The goal is time on feet.', 'complete'),

-- WEEK 4 (Jun 8-14) — Build continued — CURRENT WEEK
(v_plan_id, v_user_id, 4, 0, '2026-06-08', 'swim', 'Aerobic', 'Swim — Aerobic', '3 km steady', 60, 3.0, '1:50/100m', 'Z2', '[{"description":"400m warm-up easy"},{"description":"8 × 50m drills (catch-up / fist)"},{"description":"1500m continuous @ aerobic"},{"description":"200m cool down"}]'::jsonb, 'Easy aerobic — re-establish feel for the water after a light week.', 'complete'),
(v_plan_id, v_user_id, 4, 1, '2026-06-09', 'ride', 'Endurance', 'Ride — Endurance', '80 km steady Z2', 130, 80.0, null, 'Z2', '[{"description":"10 min warm-up spin"},{"description":"110 min steady Z2 @ 65-75% FTP"},{"description":"10 min cool down"}]'::jsonb, 'Solid aerobic ride. Volume is building — keep the effort controlled.', 'complete'),
(v_plan_id, v_user_id, 4, 2, '2026-06-10', 'run', 'Easy', 'Run — Easy', '10 km conversational', 55, 10.0, '5:20/km', 'Z2', '[{"description":"5 min warm-up"},{"description":"45 min easy at conversational pace"},{"description":"5 min cool down"}]'::jsonb, 'Easy run mid-week. Dial in your easy pace — it should feel embarrassingly slow.', 'complete'),
(v_plan_id, v_user_id, 4, 3, '2026-06-11', 'swim', 'Threshold', 'Swim — Threshold', '2.2 km with threshold efforts', 50, 2.2, '1:42/100m', 'Z3', '[{"description":"400m warm-up"},{"description":"6 × 200m @ threshold (30s rest between)"},{"description":"400m easy cool down"}]'::jsonb, 'Threshold block in the pool. Pace should feel hard but controlled — not a sprint.', 'complete'),
(v_plan_id, v_user_id, 4, 4, '2026-06-12', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Adaptation happens here, not on the road.', 'planned'),
(v_plan_id, v_user_id, 4, 5, '2026-06-13', 'brick', 'Brick', 'Brick — Ride + Run', '90 min ride → 20 min run off bike', 110, null, null, 'Z2-Z3', '[{"description":"90 min ride: 65 min Z2, 20 min Z3 tempo, 5 min spin down"},{"description":"Fast transition"},{"description":"20 min run at race pace effort"}]'::jsonb, 'Key brick session. The tempo on the bike will test your ability to run well on tired legs.', 'planned'),
(v_plan_id, v_user_id, 4, 6, '2026-06-14', 'run', 'Long Run', 'Run — Long', '14 km easy', 75, 14.0, '5:25/km', 'Z2', '[{"description":"5 min warm-up walk"},{"description":"65 min easy long run"},{"description":"5 min cool down"}]'::jsonb, 'Longest run of the block so far. Stay aerobic — HR should stay in Z2 throughout.', 'planned'),

-- WEEK 5 (Jun 15-21) — Build 2
(v_plan_id, v_user_id, 5, 0, '2026-06-15', 'swim', 'Aerobic', 'Swim — Aerobic', '3.2 km steady', 65, 3.2, '1:50/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"2400m continuous aerobic"},{"description":"400m cool down"}]'::jsonb, 'Solid aerobic swim to open the week.', 'planned'),
(v_plan_id, v_user_id, 5, 1, '2026-06-16', 'ride', 'Endurance + Intervals', 'Ride — Endurance + FTP Intervals', '90 km with FTP efforts', 150, 90.0, null, 'Z2-Z4', '[{"description":"15 min warm-up"},{"description":"3 × 10 min @ FTP (5 min easy between)"},{"description":"Balance of ride Z2"},{"description":"10 min cool down"}]'::jsonb, 'FTP intervals introduced. Keep the hard efforts controlled and nail the recovery between.', 'planned'),
(v_plan_id, v_user_id, 5, 2, '2026-06-17', 'run', 'Tempo', 'Run — Tempo', '10 km with tempo block', 55, 10.0, '4:55/km', 'Z3', '[{"description":"15 min easy warm-up"},{"description":"20 min tempo @ half marathon effort"},{"description":"15 min easy cool down"}]'::jsonb, 'First dedicated tempo run. Half marathon effort — harder than easy, easier than race pace.', 'planned'),
(v_plan_id, v_user_id, 5, 3, '2026-06-18', 'swim', 'Threshold', 'Swim — Threshold', '2.5 km with efforts', 55, 2.5, '1:40/100m', 'Z3', '[{"description":"400m warm-up"},{"description":"8 × 200m @ threshold (30s rest)"},{"description":"300m cool down"}]'::jsonb, 'Threshold volume up. Aim to hold pace consistently across all 8 reps.', 'planned'),
(v_plan_id, v_user_id, 5, 4, '2026-06-19', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest and absorb. You are midway through a hard build — recovery is training.', 'planned'),
(v_plan_id, v_user_id, 5, 5, '2026-06-20', 'brick', 'Brick', 'Brick — Ride + Run', '100 min ride → 25 min run', 125, null, null, 'Z2-Z3', '[{"description":"100 min ride with 2 × 15 min Z3"},{"description":"Transition"},{"description":"25 min run at race effort"}]'::jsonb, 'Longer brick. Two tempo blocks on the bike before a race-effort run.', 'planned'),
(v_plan_id, v_user_id, 5, 6, '2026-06-21', 'run', 'Long Run', 'Run — Long', '15 km easy', 80, 15.0, '5:25/km', 'Z2', '[{"description":"80 min easy long run"}]'::jsonb, 'Step up to 15 km. Stay in Z2 — no heroics.', 'planned'),

-- WEEK 6 (Jun 22-28) — Recovery week
(v_plan_id, v_user_id, 6, 0, '2026-06-22', 'swim', 'Aerobic', 'Swim — Aerobic', '2.5 km easy', 50, 2.5, '1:55/100m', 'Z1-Z2', '[{"description":"400m warm-up"},{"description":"1700m easy aerobic"},{"description":"400m cool down"}]'::jsonb, 'Recovery week swim. Easy effort — let the adaptation from weeks 4 and 5 land.', 'planned'),
(v_plan_id, v_user_id, 6, 1, '2026-06-23', 'ride', 'Easy', 'Ride — Easy Endurance', '60 km easy Z2', 100, 60.0, null, 'Z1-Z2', '[{"description":"90 min easy Z1-Z2 spin"}]'::jsonb, 'Recovery ride. Lower volume, lower intensity. Legs should feel fresher by the end.', 'planned'),
(v_plan_id, v_user_id, 6, 2, '2026-06-24', 'run', 'Easy', 'Run — Easy', '8 km conversational', 45, 8.0, '5:35/km', 'Z1-Z2', '[{"description":"45 min easy run"}]'::jsonb, 'Easy recovery run. This week is about absorbing the last 5 weeks of work.', 'planned'),
(v_plan_id, v_user_id, 6, 3, '2026-06-25', 'swim', 'Technique', 'Swim — Technique', '1.8 km drills', 45, 1.8, '2:00/100m', 'Z1', '[{"description":"300m warm-up"},{"description":"10 × 100m drill focus"},{"description":"300m easy cool down"}]'::jsonb, 'Technique focus only. No intensity this week.', 'planned'),
(v_plan_id, v_user_id, 6, 4, '2026-06-26', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Full rest. Recovery week means actually recovering.', 'planned'),
(v_plan_id, v_user_id, 6, 5, '2026-06-27', 'ride', 'Easy Brick', 'Brick — Easy', '60 min ride → 15 min run', 75, null, null, 'Z2', '[{"description":"60 min easy Z2 ride"},{"description":"15 min easy run off bike"}]'::jsonb, 'Short easy brick to maintain the movement pattern without adding fatigue.', 'planned'),
(v_plan_id, v_user_id, 6, 6, '2026-06-28', 'run', 'Long Run', 'Run — Easy Long', '12 km easy', 65, 12.0, '5:30/km', 'Z2', '[{"description":"65 min easy long run"}]'::jsonb, 'Shortened long run for recovery week. Easy and relaxed.', 'planned'),

-- WEEK 7 (Jun 29-Jul 5) — Intensity block
(v_plan_id, v_user_id, 7, 0, '2026-06-29', 'swim', 'Threshold', 'Swim — Threshold', '3 km with strong efforts', 60, 3.0, '1:40/100m', 'Z3', '[{"description":"400m warm-up"},{"description":"10 × 200m @ threshold (20s rest)"},{"description":"400m cool down"}]'::jsonb, 'Higher density threshold swim. Short rest keeps the quality high.', 'planned'),
(v_plan_id, v_user_id, 7, 1, '2026-06-30', 'ride', 'FTP Intervals', 'Ride — FTP Intervals', '90 km, 4 × 10 min FTP', 145, 90.0, null, 'Z4', '[{"description":"20 min warm-up"},{"description":"4 × 10 min @ FTP (5 min Z2 between)"},{"description":"Balance Z2"},{"description":"10 min cool down"}]'::jsonb, 'Four FTP intervals. These are the sessions that move your threshold. Execute precisely.', 'planned'),
(v_plan_id, v_user_id, 7, 2, '2026-07-01', 'run', 'Intervals', 'Run — Intervals', '10 km with 5km race-pace block', 55, 10.0, '4:45/km', 'Z4', '[{"description":"15 min warm-up"},{"description":"5 × 1 km @ 5km pace (90s jog between)"},{"description":"15 min cool down"}]'::jsonb, 'First real speed work. 5km race pace efforts — uncomfortable but controlled.', 'planned'),
(v_plan_id, v_user_id, 7, 3, '2026-07-02', 'swim', 'Aerobic', 'Swim — Aerobic', '3 km steady', 60, 3.0, '1:50/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"2400m aerobic"},{"description":"200m cool down"}]'::jsonb, 'Aerobic recovery swim mid-intensity-week.', 'planned'),
(v_plan_id, v_user_id, 7, 4, '2026-07-03', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest day in the intensity block. Critical.', 'planned'),
(v_plan_id, v_user_id, 7, 5, '2026-07-04', 'brick', 'Brick', 'Brick — Race Sim', '110 min ride → 30 min run', 140, null, null, 'Z3', '[{"description":"110 min ride: 20 min warm-up, 60 min Z3 race simulation, 30 min Z2"},{"description":"Transition"},{"description":"30 min run at race pace"}]'::jsonb, 'Full race simulation brick. This is your closest preview of race day.', 'planned'),
(v_plan_id, v_user_id, 7, 6, '2026-07-05', 'run', 'Long Run', 'Run — Long', '16 km easy', 85, 16.0, '5:20/km', 'Z2', '[{"description":"85 min easy long run"}]'::jsonb, 'Building toward longest long run. Stay conservative.', 'planned'),

-- WEEK 8 (Jul 6-12) — Peak volume
(v_plan_id, v_user_id, 8, 0, '2026-07-06', 'swim', 'Aerobic', 'Swim — Aerobic', '3.5 km', 70, 3.5, '1:48/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"2700m steady aerobic"},{"description":"400m cool down"}]'::jsonb, 'Highest swim volume yet. Keep the effort honest.', 'planned'),
(v_plan_id, v_user_id, 8, 1, '2026-07-07', 'ride', 'Endurance', 'Ride — Endurance', '110 km Z2', 165, 110.0, null, 'Z2', '[{"description":"165 min steady Z2 ride"}]'::jsonb, 'Longest ride of the block. Nutrition practice is mandatory — treat it like a race.', 'planned'),
(v_plan_id, v_user_id, 8, 2, '2026-07-08', 'run', 'Easy', 'Run — Easy', '11 km easy', 60, 11.0, '5:25/km', 'Z2', '[{"description":"60 min easy run"}]'::jsonb, 'Easy run after a long ride. Keep it very easy.', 'planned'),
(v_plan_id, v_user_id, 8, 3, '2026-07-09', 'swim', 'Threshold', 'Swim — Threshold', '2.8 km efforts', 60, 2.8, '1:38/100m', 'Z3-Z4', '[{"description":"400m warm-up"},{"description":"6 × 300m @ threshold"},{"description":"400m cool down"}]'::jsonb, 'Longer threshold reps in the pool. Aim for consistency across all 6.', 'planned'),
(v_plan_id, v_user_id, 8, 4, '2026-07-10', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest. You are in the peak of the block.', 'planned'),
(v_plan_id, v_user_id, 8, 5, '2026-07-11', 'brick', 'Brick', 'Brick — Ride + Run', '110 min ride → 30 min run', 140, null, null, 'Z2-Z3', '[{"description":"110 min ride with 2 × 20 min Z3"},{"description":"Transition"},{"description":"30 min run race effort"}]'::jsonb, 'Race effort brick. Bring your race kit and practice transitions.', 'planned'),
(v_plan_id, v_user_id, 8, 6, '2026-07-12', 'run', 'Long Run', 'Run — Long', '18 km easy', 95, 18.0, '5:25/km', 'Z2', '[{"description":"95 min easy long run"}]'::jsonb, 'Longest run of the whole block. Patience.', 'planned'),

-- WEEK 9 (Jul 13-19) — Peak + recovery transition
(v_plan_id, v_user_id, 9, 0, '2026-07-13', 'swim', 'Mixed', 'Swim — Mixed', '3 km mixed efforts', 60, 3.0, '1:45/100m', 'Z2-Z3', '[{"description":"400m warm-up"},{"description":"1200m aerobic"},{"description":"5 × 200m threshold (30s rest)"},{"description":"400m cool down"}]'::jsonb, 'Mixed swim bridging volume and intensity.', 'planned'),
(v_plan_id, v_user_id, 9, 1, '2026-07-14', 'ride', 'FTP Intervals', 'Ride — FTP Intervals', '100 km, 5 × 8 min FTP', 150, 100.0, null, 'Z4', '[{"description":"20 min warm-up"},{"description":"5 × 8 min @ FTP (4 min recovery)"},{"description":"Balance Z2"},{"description":"10 min cool down"}]'::jsonb, 'Five FTP reps. Short and sharp — quality matters more than duration now.', 'planned'),
(v_plan_id, v_user_id, 9, 2, '2026-07-15', 'run', 'Tempo', 'Run — Tempo', '11 km with tempo', 60, 11.0, '4:55/km', 'Z3', '[{"description":"15 min warm-up"},{"description":"25 min tempo"},{"description":"20 min cool down"}]'::jsonb, 'Longer tempo block. Target half marathon race effort.', 'planned'),
(v_plan_id, v_user_id, 9, 3, '2026-07-16', 'swim', 'Aerobic', 'Swim — Aerobic', '2.8 km easy', 55, 2.8, '1:52/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"2100m aerobic"},{"description":"300m cool down"}]'::jsonb, 'Easy aerobic swim mid-week — no intensity, just volume.', 'planned'),
(v_plan_id, v_user_id, 9, 4, '2026-07-17', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest. Big race sim weekend coming up.', 'planned'),
(v_plan_id, v_user_id, 9, 5, '2026-07-18', 'brick', 'Brick', 'Brick — Full Race Sim', '2h ride → 40 min run', 160, null, null, 'Race', '[{"description":"120 min ride: warm-up, 80 min race effort, cool down"},{"description":"Transition"},{"description":"40 min run at race pace — this is as close to race day as it gets"}]'::jsonb, 'Full race simulation. This is the hardest session of the block. Execute pacing, nutrition, and transitions like it is race day.', 'planned'),
(v_plan_id, v_user_id, 9, 6, '2026-07-19', 'run', 'Long Run', 'Run — Long', '16 km easy', 85, 16.0, '5:25/km', 'Z2', '[{"description":"85 min easy long run — legs will be tired from yesterday"}]'::jsonb, 'Easy long run after race sim. Keep it very easy. This combo is designed to build race-day durability.', 'planned'),

-- WEEK 10 (Jul 20-26) — Taper begins
(v_plan_id, v_user_id, 10, 0, '2026-07-20', 'swim', 'Aerobic', 'Swim — Aerobic', '2.5 km easy', 50, 2.5, '1:52/100m', 'Z2', '[{"description":"400m warm-up"},{"description":"1800m aerobic"},{"description":"300m cool down"}]'::jsonb, 'Volume drops this week. Quality over quantity.', 'planned'),
(v_plan_id, v_user_id, 10, 1, '2026-07-21', 'ride', 'Ride with Efforts', 'Ride — Moderate with Efforts', '70 km', 120, 70.0, null, 'Z2-Z3', '[{"description":"15 min warm-up"},{"description":"2 × 15 min Z3"},{"description":"Balance Z2"},{"description":"10 min cool down"}]'::jsonb, 'Taper begins. Maintain intensity but volume drops. Sharp legs.', 'planned'),
(v_plan_id, v_user_id, 10, 2, '2026-07-22', 'run', 'Easy', 'Run — Easy', '9 km easy', 50, 9.0, '5:20/km', 'Z2', '[{"description":"50 min easy run"}]'::jsonb, 'Easy taper run. No need to push.', 'planned'),
(v_plan_id, v_user_id, 10, 3, '2026-07-23', 'swim', 'Race Pace', 'Swim — Race Pace', '2 km with race pace', 45, 2.0, '1:38/100m', 'Z3-Z4', '[{"description":"400m warm-up"},{"description":"3 × 400m @ race pace (60s rest)"},{"description":"400m cool down"}]'::jsonb, 'Race pace efforts in the pool. Get used to that sensation while fresh.', 'planned'),
(v_plan_id, v_user_id, 10, 4, '2026-07-24', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest and trust the training. The hay is in the barn.', 'planned'),
(v_plan_id, v_user_id, 10, 5, '2026-07-25', 'brick', 'Brick', 'Brick — Moderate', '75 min ride → 20 min run', 95, null, null, 'Z2-Z3', '[{"description":"75 min ride with some Z3"},{"description":"Transition"},{"description":"20 min run at race effort"}]'::jsonb, 'Last substantial brick. Feel the transitions — they should feel natural by now.', 'planned'),
(v_plan_id, v_user_id, 10, 6, '2026-07-26', 'run', 'Long Run', 'Run — Long', '12 km easy', 65, 12.0, '5:25/km', 'Z2', '[{"description":"65 min easy long run"}]'::jsonb, 'Reduced long run. Still an easy effort — no need to prove anything.', 'planned'),

-- WEEK 11 (Jul 27-Aug 2) — Final sharpener
(v_plan_id, v_user_id, 11, 0, '2026-07-27', 'swim', 'Race Pace', 'Swim — Race Pace Sharpener', '2 km sharp', 40, 2.0, '1:36/100m', 'Z3-Z4', '[{"description":"400m warm-up"},{"description":"4 × 300m @ race pace (45s rest)"},{"description":"400m cool down"}]'::jsonb, 'Sharp race-pace session. You should feel fast in the water.', 'planned'),
(v_plan_id, v_user_id, 11, 1, '2026-07-28', 'ride', 'Sharpener', 'Ride — Sharpener', '50 km with efforts', 90, 50.0, null, 'Z3-Z4', '[{"description":"15 min warm-up"},{"description":"3 × 8 min @ FTP"},{"description":"25 min easy"}]'::jsonb, 'Short, sharp ride. Maintain neuromuscular sharpness without accumulating fatigue.', 'planned'),
(v_plan_id, v_user_id, 11, 2, '2026-07-29', 'run', 'Sharpener', 'Run — Sharpener', '8 km with race pace efforts', 45, 8.0, '4:50/km', 'Z3-Z4', '[{"description":"15 min warm-up"},{"description":"3 × 5 min @ race pace (3 min jog between)"},{"description":"15 min cool down"}]'::jsonb, 'Short race-pace intervals to keep your legs sharp heading into race week.', 'planned'),
(v_plan_id, v_user_id, 11, 3, '2026-07-30', 'swim', 'Easy', 'Swim — Easy', '1.5 km easy', 30, 1.5, '1:55/100m', 'Z1', '[{"description":"1500m easy, focusing on rhythm and feel"}]'::jsonb, 'Easy final swim. Just feel the water.', 'planned'),
(v_plan_id, v_user_id, 11, 4, '2026-07-31', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Rest. Race is 9 days away.', 'planned'),
(v_plan_id, v_user_id, 11, 5, '2026-08-01', 'brick', 'Brick', 'Brick — Race Rehearsal', '40 min ride → 15 min run', 55, null, null, 'Race', '[{"description":"40 min easy ride with 3 × 2 min race effort"},{"description":"Transition"},{"description":"15 min easy run — just feel it"}]'::jsonb, 'Short race rehearsal brick. Race kit, race nutrition, race mindset. Last chance to troubleshoot anything.', 'planned'),
(v_plan_id, v_user_id, 11, 6, '2026-08-02', 'run', 'Easy', 'Run — Easy Short', '6 km easy', 35, 6.0, '5:30/km', 'Z1-Z2', '[{"description":"35 min easy run"}]'::jsonb, 'Easy and relaxed. No pressure. You have done the work.', 'planned'),

-- WEEK 12 (Aug 3-9) — Race week
(v_plan_id, v_user_id, 12, 0, '2026-08-03', 'swim', 'Activation', 'Swim — Activation', '1.2 km easy', 25, 1.2, '1:55/100m', 'Z1', '[{"description":"1200m easy with 4 × 50m at race pace to activate"}]'::jsonb, 'Race week activation swim. Keep it light.', 'planned'),
(v_plan_id, v_user_id, 12, 1, '2026-08-04', 'ride', 'Activation', 'Ride — Activation', '30 min easy + openers', 35, null, null, 'Z1-Z2', '[{"description":"30 min easy ride with 3 × 30s at race effort to open legs"}]'::jsonb, 'Light activation ride. Open the legs without tiring them.', 'planned'),
(v_plan_id, v_user_id, 12, 2, '2026-08-05', 'run', 'Activation', 'Run — Activation', '5 km easy + strides', 30, 5.0, '5:20/km', 'Z1-Z2', '[{"description":"25 min easy run with 4 × 20s strides"}]'::jsonb, 'Light run to keep legs fresh and sharp.', 'planned'),
(v_plan_id, v_user_id, 12, 3, '2026-08-06', 'swim', 'Race Prep', 'Swim — Race Prep', '1 km easy + race feel', 20, 1.0, '1:50/100m', 'Z1', '[{"description":"1000m easy, last 200m at race pace"}]'::jsonb, 'Final swim. Feel fast, stay calm.', 'planned'),
(v_plan_id, v_user_id, 12, 4, '2026-08-07', 'rest', 'Rest', 'Rest day', 'Full recovery', null, null, null, null, null, 'Complete rest. Eat well, hydrate, sleep. You are ready.', 'planned'),
(v_plan_id, v_user_id, 12, 5, '2026-08-08', 'rest', 'Rest', 'Rest day — Race Eve', 'Light preparation only', null, null, null, null, null, 'Race eve. Lay out your kit, check your transitions. Early bed. You have earned this.', 'planned'),
(v_plan_id, v_user_id, 12, 6, '2026-08-09', 'run', 'Race', 'Race Day — Olympic Triathlon', '1.5km swim · 40km ride · 10km run', 120, null, null, 'Race', '[{"description":"1.5 km swim"},{"description":"T1"},{"description":"40 km bike"},{"description":"T2"},{"description":"10 km run"}]'::jsonb, 'Race day. Trust the 12 weeks of work. Start conservative, finish strong.', 'planned');

-- ─── WORKOUT LOGS (weeks 1-4 completed sessions) ────────────────────────────

-- Week 1 logs
insert into workout_logs (session_id, user_id, logged_at, actual_distance_km, actual_duration_minutes, rpe, user_note, coach_response, source)
select s.id, v_user_id, (s.scheduled_date || ' 08:00:00')::timestamptz, s.distance_km, s.duration_minutes,
  case s.discipline when 'rest' then null else 6 end,
  case s.discipline
    when 'swim' then 'Felt good in the water, bit rusty at the start but settled in.'
    when 'ride' then 'Solid ride, kept it easy as planned.'
    when 'run' then 'Easy and relaxed. Legs felt fresh.'
    when 'brick' then 'First brick done. Run felt weird off the bike but got through it.'
    when 'rest' then null
  end,
  case s.discipline
    when 'swim' then 'Good start to the block. The rustiness at the start is normal — it will iron out quickly. Stay patient with the aerobic pace.'
    when 'ride' then 'Solid base ride. Z2 discipline will pay off over the next 12 weeks.'
    when 'run' then 'Easy run ticked off cleanly. Exactly what week 1 calls for.'
    when 'brick' then 'Good first brick. The heavy-leg feeling on the run transition is normal and will diminish as the block progresses.'
    when 'rest' then null
  end,
  'manual'
from sessions s where s.user_id = v_user_id and s.week_number = 1 and s.discipline != 'rest';

-- Week 2 logs
insert into workout_logs (session_id, user_id, logged_at, actual_distance_km, actual_duration_minutes, actual_pace, rpe, user_note, coach_response, source)
select s.id, v_user_id, (s.scheduled_date || ' 07:30:00')::timestamptz,
  s.distance_km * 1.02, s.duration_minutes + 2,
  case s.discipline when 'run' then '5:22/km' when 'swim' then '1:50/100m' else null end,
  case s.discipline when 'ride' then 7 when 'brick' then 7 else 6 end,
  case s.discipline
    when 'swim' then 'Pull buoy sets felt good. Threshold reps were tough but manageable.'
    when 'ride' then 'Volume step-up felt okay. Legs a bit heavy in the last 20 mins.'
    when 'run' then 'Comfortable throughout. Could have gone further.'
    when 'brick' then 'Bike finish push was hard. Run pace was better than week 1.'
  end,
  case s.discipline
    when 'swim' then 'Good effort on the threshold set — holding pace across all reps is the key metric. Technique looked solid in the pull work.'
    when 'ride' then 'Some fatigue in the final stretch is expected at this volume step. That is the point. Recovery tomorrow will help.'
    when 'run' then 'Consistent easy run. Your aerobic base is building nicely.'
    when 'brick' then 'Improved run off the bike already. The tempo finish on the bike is making the run harder — that is intentional and it is working.'
  end,
  'manual'
from sessions s where s.user_id = v_user_id and s.week_number = 2 and s.discipline != 'rest';

-- Week 3 logs
insert into workout_logs (session_id, user_id, logged_at, actual_distance_km, actual_duration_minutes, actual_pace, rpe, user_note, coach_response, source)
select s.id, v_user_id, (s.scheduled_date || ' 07:00:00')::timestamptz,
  s.distance_km,
  case s.discipline when 'brick' then s.duration_minutes + 5 else s.duration_minutes end,
  case s.discipline when 'run' then '5:18/km' when 'swim' then '1:48/100m' else null end,
  case
    when s.discipline = 'ride' then 7
    when s.discipline = 'brick' then 8
    when s.discipline = 'run' and s.session_type = 'Long Run' then 7
    else 6
  end,
  case
    when s.discipline = 'swim' then 'Strong swim. Threshold paces dropped a couple seconds per 100m which felt good.'
    when s.discipline = 'ride' then 'Tempo efforts were solid. Power was up on last week on the Z3 blocks.'
    when s.discipline = 'run' and s.session_type = 'Easy + Strides' then 'Strides felt snappy. Easy pace felt easy.'
    when s.discipline = 'brick' then 'Hard session. Brick run showed some late fatigue — HR was drifting high in the last 5 mins.'
    when s.discipline = 'run' then 'Long run felt tough toward the end. Legs were carrying fatigue from the brick.'
    else 'Good session, felt controlled.'
  end,
  case
    when s.discipline = 'swim' then 'Swim threshold is dropping — your catch is improving. Keep the 30s rest strict to maintain quality.'
    when s.discipline = 'ride' then 'FTP intervals are working. Average power trending up week on week — good sign.'
    when s.discipline = 'run' and s.session_type = 'Easy + Strides' then 'Sharp strides on easy legs — exactly right. This maintains your top-end without the fatigue of a full interval session.'
    when s.discipline = 'brick' then 'HR drift in the brick run is flagging some fatigue — this is expected at week 3 of a build. I will keep the next run easy to absorb.'
    when s.discipline = 'run' then 'Tough long run is normal after a hard brick. The back-to-back stimulus is exactly what trains race day durability.'
    else 'Solid session.'
  end,
  'manual'
from sessions s where s.user_id = v_user_id and s.week_number = 3 and s.discipline != 'rest';

-- Week 4 logs (Mon-Thu only, today is Friday)
insert into workout_logs (session_id, user_id, logged_at, actual_distance_km, actual_duration_minutes, actual_pace, rpe, user_note, coach_response, source)
select s.id, v_user_id, (s.scheduled_date || ' 07:00:00')::timestamptz,
  s.distance_km, s.duration_minutes,
  case s.discipline when 'run' then '5:15/km' when 'swim' then '1:48/100m' else null end,
  case
    when s.discipline = 'swim' and s.session_type = 'Threshold' then 7
    when s.discipline = 'ride' then 7
    else 6
  end,
  case
    when s.discipline = 'swim' and s.session_type = 'Aerobic' then 'Good aerobic swim to open the week. Felt smooth.'
    when s.discipline = 'ride' then 'Solid ride. Z2 felt comfortable, could have gone longer.'
    when s.discipline = 'run' then 'Easy 10 km. Pace was slightly quicker than planned but effort felt easy.'
    when s.discipline = 'swim' then 'Threshold set was strong. Held pace well across all 6 reps.'
    else 'Good session.'
  end,
  case
    when s.discipline = 'swim' and s.session_type = 'Aerobic' then 'Strong week 4 opener in the pool. You are finding your aerobic rhythm now.'
    when s.discipline = 'ride' then 'Good aerobic discipline. Z2 consistency across the block is building your engine.'
    when s.discipline = 'run' then 'Slightly quicker than target but RPE was right. That tells me your easy pace is improving. Good sign.'
    when s.discipline = 'swim' then 'All 6 threshold reps at pace — solid. Your swim threshold is 2-3 seconds faster than week 2. Progress.'
    else 'Well executed.'
  end,
  'manual'
from sessions s where s.user_id = v_user_id and s.week_number = 4 and s.discipline != 'rest'
  and s.day_of_week < 4;

-- ─── CHECK-INS (past 4 days) ────────────────────────────────────────────────
insert into checkins (user_id, checkin_date, feeling, soreness_notes, coach_response, plan_adjusted)
values
(v_user_id, '2026-06-09', 4, null, 'Good energy heading into the ride. Keep the effort aerobic and you will be well set for the week.', false),
(v_user_id, '2026-06-10', 4, 'Slight quad tightness from yesterday''s ride', 'Quad tightness after a long ride is normal. Today''s run is easy — use the first 10 mins as a proper warm-up and it should ease off. Flag if it persists.', false),
(v_user_id, '2026-06-11', 4, null, 'Feeling good heading into the threshold swim. You are in good shape mid-week.', false),
(v_user_id, '2026-06-12', 4, null, 'Rest day is well timed. You have had a strong 4 days — let the adaptation happen today. Saturday''s brick will feel better for it.', false);

-- ─── COACH NOTES (weeks 1-3) ────────────────────────────────────────────────
insert into coach_notes (user_id, plan_id, week_number, week_start, week_end, metric_pills, headline, swim_observations, ride_observations, run_observations, recovery_assessment, looking_ahead, closing_prompt)
values
(
  v_user_id, v_plan_id, 1, '2026-05-18', '2026-05-24',
  '[{"label":"Consistency 7/7","color":"green"},{"label":"Volume on plan","color":"blue"},{"label":"RPE moderate","color":"grey"}]'::jsonb,
  'Clean opening week. All sessions complete, effort levels right, and the brick run transition showed good early adaptation.',
  'Swim: 2.5 km aerobic across 1 session + 1.8 km technique. Catch-up drills are working — early feel for the water was good. Threshold to come in week 2.',
  'Ride: 60 km Z2 + 60 min brick ride. Power was in range throughout. No spikes, no underperformance. Exactly the base work needed.',
  'Run: 8 km easy + 15 min brick run + 10 km long. All conversational pace. Long run showed good aerobic base — HR stayed low the whole way.',
  'Recovery looked solid across the week. RPE 6 across most sessions. Rest day was used well. No injury flags.',
  'Week 2 introduces the first threshold swim set and a slightly longer brick run. Volume step is modest — focus on executing the quality work well.',
  'Week 1 is done — how did the overall load feel? Anything that surprised you?'
),
(
  v_user_id, v_plan_id, 2, '2026-05-25', '2026-05-31',
  '[{"label":"Consistency 7/7","color":"green"},{"label":"Swim threshold even","color":"blue"},{"label":"Long ride strong","color":"orange"}]'::jsonb,
  'Solid step-up week. Threshold swim reps were controlled, and the brick run is clearly improving.',
  'Swim: 2.8 km aerobic + 2.0 km threshold. The 5 × 200m threshold set was well executed — pace was consistent across reps which is the key metric at this stage.',
  'Ride: 70 km Z2 + 75 min brick ride with tempo finish. Some fatigue noted in the last 20 min of the long ride — expected at this volume. The brick tempo push is starting to challenge the run in a productive way.',
  'Run: 9 km easy + 20 min brick run + 12 km long. Brick run pace improved notably vs week 1. Long run was easy and relaxed — good sign for the aerobic base.',
  'RPE 6-7 across training days. Rest day well used. No injury flags. Fatigue is appropriate for week 2 of a build.',
  'Week 3 introduces tempo efforts on the bike and adds strides to the easy run. The brick run gets longer. Stay on the easy side of tempo.',
  'The threshold swim felt hard this week — where did the difficulty come from? Effort, or pace?'
),
(
  v_user_id, v_plan_id, 3, '2026-06-01', '2026-06-07',
  '[{"label":"Swim on track","color":"blue"},{"label":"Volume +12%","color":"green"},{"label":"Recovery moderate","color":"yellow"},{"label":"FTP up 6w","color":"orange"}]'::jsonb,
  'Strong build week. Swim threshold dropping, FTP intervals up 6w. Run showed late fatigue — backing off slightly to absorb.',
  'Swim: 6.8 km across 3 sessions. Threshold paces dropped 2s/100m — catch is more consistent. The mixed aerobic/threshold structure is working.',
  'Ride: 4.5 hrs with Z3 efforts. The 2 × 20 min tempo blocks were strong — average power on the Z3 efforts up vs week 2. FTP-based work is translating.',
  'Run: 33 km. Strides went well, but Saturday''s brick run showed HR drift late — flagging fatigue. Sunday long run felt heavy. Adjusting week 4 intensity accordingly.',
  'Sleep solid (7.5h avg). HRV trending up early week, dipped Friday. The fatigue response is appropriate — this is a meaningful training stimulus. You called the right effort levels throughout.',
  'Holding run intensity flat in week 4, lifting bike tempo volume slightly. The swim threshold block gets a 6th rep. Use the rest day fully.',
  'Volume was up this week — how did that feel overall?'
);

end $$;
