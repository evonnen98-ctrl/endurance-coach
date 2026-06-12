import { useEffect, useState } from 'react'

const MESSAGES = [
  'Analysing your training history…',
  'Building your 12-week plan…',
  'Calibrating session targets…',
  'Almost ready…',
]

export default function BuildingPlan() {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => Math.min(i + 1, MESSAGES.length - 1))
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 px-8">
      <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Your coach is building your plan</h2>
        <p className="text-gray-500 text-sm transition-all duration-500">{MESSAGES[msgIndex]}</p>
      </div>
    </div>
  )
}
