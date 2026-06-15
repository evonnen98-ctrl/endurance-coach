import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import { api } from '../lib/api'
import type { ProposedChange } from '../lib/api'
import type { CoachNote, User as UserType } from '../types'
import CoachNoteCard from '../components/notes/CoachNoteCard'
import ProposedChangesCard from '../components/coach/ProposedChangesCard'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  proposedChanges?: ProposedChange[]
  changesState?: 'pending' | 'accepted' | 'rejected'
}

const STORAGE_KEY = 'coach-chat-v2'

function loadHistory(): ChatMessage[] {
  try {
    localStorage.removeItem('coach-chat-history')
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ChatMessage[]
    return raw.map(m => {
      if (m.role === 'assistant' && m.content.trimStart().startsWith('{')) {
        try { const p = JSON.parse(m.content); if (p.reply) return { ...m, content: p.reply } } catch {}
      }
      return m
    })
  } catch { return [] }
}

function saveHistory(msgs: ChatMessage[]) {
  const clean = msgs.map(({ proposedChanges: _, changesState: __, ...m }) => m)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean.slice(-40)))
}

export default function CoachPage() {
  const [activeTab, setActiveTab]   = useState<'chat' | 'reviews'>('chat')
  const [messages, setMessages]     = useState<ChatMessage[]>(loadHistory)
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').eq('id', DEMO_USER_ID).single()
      return data as UserType
    },
  })

  const { data: coachNotes = [] } = useQuery({
    queryKey: ['coach-notes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coach_notes').select('*').eq('user_id', DEMO_USER_ID)
        .order('week_number', { ascending: false })
      return (data ?? []) as CoachNote[]
    },
  })

  useEffect(() => {
    if (activeTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setSending(true)
    try {
      const { reply, proposedChanges } = await api.coachChat({
        userId:  DEMO_USER_ID,
        message: text,
        history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
      })
      const withReply: ChatMessage[] = [
        ...newMessages,
        {
          role: 'assistant',
          content: reply,
          ...(proposedChanges?.length ? { proposedChanges, changesState: 'pending' as const } : {}),
        },
      ]
      setMessages(withReply)
      saveHistory(withReply)
    } catch {
      const fallback: ChatMessage[] = [
        ...newMessages,
        { role: 'assistant', content: "I'm having trouble connecting right now. Try again in a moment." },
      ]
      setMessages(fallback)
      saveHistory(fallback)
    }
    setSending(false)
  }

  function resolveChanges(msgIndex: number, outcome: 'accepted' | 'rejected') {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, changesState: outcome } : m
    ))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header + tabs */}
      <div className="bg-white px-5 pt-14 pb-0 flex-shrink-0">
        <h1 className="text-[22px] font-semibold" style={{ color: '#1C1917' }}>Coach</h1>
        {/* Sub-tab pills */}
        <div className="flex bg-gray-100 rounded-xl p-1 mt-3 mb-0">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === 'chat' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === 'reviews' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            Reviews {coachNotes.length > 0 && (
              <span className="ml-1 text-[11px] bg-gray-200 text-gray-500 rounded-full px-1.5 py-0.5">
                {coachNotes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── CHAT TAB ─────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 max-w-[84%] shadow-sm border border-gray-100">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Coach</p>
                  <p className="text-[15px] text-gray-800 leading-relaxed">
                    {user?.coach_notes_freetext
                      ? `I've read your notes — ${user.coach_notes_freetext.slice(0, 120)}${user.coach_notes_freetext.length > 120 ? '…' : ''}. What's on your mind?`
                      : `Hey${user?.name ? ` ${user.name}` : ''}. I've got your plan loaded. Ask me anything about your training.`}
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[84%] bg-gray-900 text-white rounded-2xl rounded-br-sm px-4 py-3">
                      <p className="text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[84%] bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Coach</p>
                      <p className="text-[15px] text-gray-800 leading-relaxed">{msg.content}</p>
                    </div>
                  )}
                </div>

                {msg.role === 'assistant' && msg.proposedChanges?.length && msg.changesState === 'pending' && (
                  <div className="mt-2">
                    <ProposedChangesCard
                      changes={msg.proposedChanges}
                      onAccepted={() => resolveChanges(i, 'accepted')}
                      onRejected={() => resolveChanges(i, 'rejected')}
                    />
                  </div>
                )}
                {msg.role === 'assistant' && msg.changesState === 'accepted' && (
                  <div className="mt-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                    <p className="text-[13px] text-green-700">Plan updated — changes reflected in your training plan.</p>
                  </div>
                )}
                {msg.role === 'assistant' && msg.changesState === 'rejected' && (
                  <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <p className="text-[13px] text-gray-500">No problem, sticking with the original plan.</p>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm border border-gray-100">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar — pinned to bottom */}
          <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 safe-bottom">
            <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
              <textarea
                rows={1}
                placeholder="Message your coach…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 text-[15px] text-gray-800 placeholder-gray-400 resize-none bg-transparent outline-none max-h-24"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="p-2 bg-gray-900 text-white rounded-xl disabled:opacity-40 flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEWS TAB ──────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-24 space-y-3">
          {coachNotes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[14px] text-gray-400 leading-relaxed">
                Weekly reviews appear here at the end of each training week.
              </p>
            </div>
          ) : (
            coachNotes.map((note, i) => (
              <CoachNoteCard key={note.id} note={note} defaultExpanded={i === 0} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
