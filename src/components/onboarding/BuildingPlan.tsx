interface Props {
  message?: string | null
}

export default function BuildingPlan({ message }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 px-8">
      <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--lime-accent)', borderTopColor: 'transparent' }} />
      <div className="text-center max-w-xs">
        <h2 className="text-2xl font-bold mb-3">Your coach is building your plan</h2>
        <p className="text-gray-500 text-sm min-h-[20px]">
          {message ?? 'Building your plan…'}
        </p>
      </div>
    </div>
  )
}
