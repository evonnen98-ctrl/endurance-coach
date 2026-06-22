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

const tabLabelStyle: React.CSSProperties = {
  fontFamily: '"Poppins", sans-serif',
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 999,
}

const archivoCaps: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
}

export default function CoachPage() {
  const [activeTab, setActiveTab]   = useState<'chat' | 'reviews'>('chat')
  const [messages, setMessages]     = useState<ChatMessage[]>(loadHistory)
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const prevMsgLen   = useRef<number | null>(null)

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
    const prev = prevMsgLen.current
    prevMsgLen.current = messages.length
    // Only scroll to bottom when a new message is added — never on mount or re-render
    if (prev !== null && messages.length > prev && activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, activeTab])

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
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header + tabs */}
      <div className="bg-white px-5 pt-14 pb-0 flex-shrink-0" style={{ borderBottom: '1px solid var(--mist)' }}>
        <h1 style={{
          fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
          fontSize: 28, letterSpacing: '-0.01em', lineHeight: 0.9,
          textTransform: 'uppercase', color: 'var(--ink)',
        }}>
          Coach
        </h1>
        <div className="flex rounded-full p-1 mt-3 mb-0 gap-1 w-fit" style={{ backgroundColor: 'var(--mist)' }}>
          <button
            onClick={() => setActiveTab('chat')}
            className="py-2 px-5 transition-all"
            style={{ ...tabLabelStyle, backgroundColor: activeTab === 'chat' ? 'var(--ink)' : 'transparent', color: activeTab === 'chat' ? '#FFFFFF' : 'var(--graphite-500)' }}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className="py-2 px-5 transition-all flex items-center gap-1.5"
            style={{ ...tabLabelStyle, backgroundColor: activeTab === 'reviews' ? 'var(--ink)' : 'transparent', color: activeTab === 'reviews' ? '#FFFFFF' : 'var(--graphite-500)' }}
          >
            Reviews
            {coachNotes.length > 0 && (
              <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: activeTab === 'reviews' ? 'rgba(255,255,255,0.2)' : 'var(--graphite-300)', color: activeTab === 'reviews' ? '#FFFFFF' : 'var(--ink)' }}>
                {coachNotes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── CHAT TAB ── */}
      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 max-w-[84%]" style={{ border: '1px solid var(--graphite-300)' }}>
                  <p style={{ ...archivoCaps, color: 'var(--graphite-300)', marginBottom: 6 }}>Coach</p>
                  <p className="text-[15px] font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>
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
                    <div className="max-w-[84%] rounded-2xl rounded-br-sm px-4 py-3" style={{ backgroundColor: 'var(--ink)' }}>
                      <p className="text-[15px] font-medium leading-relaxed text-white">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[84%] bg-white rounded-2xl rounded-bl-sm px-4 py-3" style={{ border: '1px solid var(--graphite-300)' }}>
                      <p style={{ ...archivoCaps, color: 'var(--graphite-300)', marginBottom: 6 }}>Coach</p>
                      <p className="text-[15px] font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{msg.content}</p>
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
                  <div className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--mist)', border: '1px solid var(--graphite-300)' }}>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Plan updated — changes reflected in your training plan.</p>
                  </div>
                )}
                {msg.role === 'assistant' && msg.changesState === 'rejected' && (
                  <div className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--mist)' }}>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--graphite-500)' }}>No problem, sticking with the original plan.</p>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3.5" style={{ border: '1px solid var(--graphite-300)' }}>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ backgroundColor: 'var(--graphite-300)' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: 'var(--graphite-300)' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: 'var(--graphite-300)' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar — pt-3 for top breathing room; padding-bottom clears the fixed BottomNav
               (56px nav content + safe-area-inset so it works on notched iPhones too) */}
          <div className="bg-white px-4 pt-3 flex-shrink-0" style={{ borderTop: '1px solid var(--mist)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex gap-2 items-center rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--mist)' }}>
              <textarea
                rows={1}
                placeholder="Message your coach…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 text-[15px] font-medium placeholder-graphite-300 resize-none bg-transparent outline-none max-h-24"
                style={{ color: 'var(--ink)' }}
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="p-2 rounded-full disabled:opacity-40 flex-shrink-0 transition-opacity"
                style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEWS TAB ── */}
      {activeTab === 'reviews' && (
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 space-y-3">
          {coachNotes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[14px] font-medium leading-relaxed" style={{ color: 'var(--graphite-500)' }}>
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
