import type { Discipline } from '../types'

export const disciplineColor: Record<Discipline, string> = {
  swim: '#9CA3AF',
  ride: '#9CA3AF',
  run: '#9CA3AF',
  rest: '#D1D5DB',
  brick: '#9CA3AF',
}

export const disciplineBg: Record<Discipline, string> = {
  swim: 'bg-gray-100 text-gray-600',
  ride: 'bg-gray-100 text-gray-600',
  run: 'bg-gray-100 text-gray-600',
  rest: 'bg-gray-50 text-gray-400',
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
