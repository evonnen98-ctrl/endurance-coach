import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import { api } from '../lib/api'
import type { CoachNote } from '../types'
import CoachNoteCard from '../components/notes/CoachNoteCard'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'coach-chat-history'

function loadHistory(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(msgs: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)))
}

export default function CoachPage() {
  const [tab, setTab] = useState<'chat' | 'reviews'>('chat')
  const [messages, setMessages]   = useState<ChatMessage[]>(loadHistory)
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const { reply } = await api.coachChat({
        userId:  DEMO_USER_ID,
        message: text,
        history: messages.slice(-10),
      })
      const withReply: ChatMessage[] = [...newMessages, { role: 'assistant', content: reply }]
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

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-0">
        <h1 className="text-3xl font-bold mb-4">Coach</h1>
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('chat')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'chat' ? 'border-black text-black' : 'border-transparent text-gray-400'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setTab('reviews')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'reviews' ? 'border-black text-black' : 'border-transparent text-gray-400'
            }`}
          >
            Weekly Reviews
          </button>
        </div>
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col flex-1">
          {/* Messages */}
          <div className="flex-1 px-4 py-5 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center pt-10">
                <p className="text-gray-400 text-sm">Your coach is here.</p>
                <p className="text-gray-400 text-sm mt-1">Ask anything about your training.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Coach</div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="px-4 pb-4 bg-gray-50">
            <div className="flex gap-2 items-end bg-white border border-gray-200 rounded-2xl p-2">
              <textarea
                rows={1}
                placeholder="Ask your coach…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 p-2 text-sm text-gray-800 placeholder-gray-400 resize-none bg-transparent outline-none max-h-32"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="p-2.5 bg-gray-900 text-white rounded-xl disabled:opacity-40 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="px-4 pt-5 space-y-4 pb-6">
          {coachNotes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Weekly reviews appear here at the end of each week.
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
