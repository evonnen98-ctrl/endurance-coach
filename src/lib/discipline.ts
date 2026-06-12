import type { Discipline } from '../types'

export const disciplineColor: Record<Discipline, string> = {
  swim: '#3B82F6',
  ride: '#F97316',
  run: '#22C55E',
  rest: '#9CA3AF',
  brick: '#9CA3AF',
}

export const disciplineBg: Record<Discipline, string> = {
  swim: 'bg-blue-50 text-blue-600',
  ride: 'bg-orange-50 text-orange-600',
  run: 'bg-green-50 text-green-600',
  rest: 'bg-gray-100 text-gray-500',
  brick: 'bg-gray-100 text-gray-600',
}

export const disciplineLabel: Record<Discipline, string> = {
  swim: 'SWIM',
  ride: 'RIDE',
  run: 'RUN',
  rest: 'REST',
  brick: 'BRICK',
}

export function disciplineDot(d: Discipline) {
  return disciplineColor[d] ?? '#9CA3AF'
}
