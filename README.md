# My Coach

An AI-powered triathlon coaching application that generates and adapts personalized training plans based on a user's goals, fitness level, schedule, and preferences.

👉 **[Live Demo](https://endurance-coach-umber.vercel.app/today)**

## Why I built this
I built this while training for my first Half Ironman. I wanted to see if AI could provide tailored coaching without the high cost of hiring a one-on-one coach or joining a triathlon club.

## Features
* **Personalised onboarding:** Captures goals, fitness level, training history, and schedule.
* **Training plan generation:** Tailored to individual race goals.
* **Adaptive AI coach:** Handles schedule adjustments and daily training recommendations.
* **Daily workout planner:** Provides detailed guidance for each session.
* **Progress tracking:** A simple dashboard to see your training history.

## Tech Stack
React (Vite), TypeScript, Node.js, Express, PostgreSQL, Supabase, Claude API, Tailwind CSS

## Key Learnings
* **The limits of raw LLMs:** Fully AI-generated training plans produced inconsistent outputs.
* **Mixing logic with AI:** I fixed the consistency issue by combining fixed, deterministic code logic with AI-generated recommendations to make the schedule more reliable.
* **Keeping it simple:** Reducing unnecessary code complexity and dependencies made the app much sturdier and easier to debug.
* **Downstream impacts:** I learned firsthand how tiny code tweaks in one component can create unexpected bugs further down the line.
