'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

type Bookmark = {
  id: number
  title: string
  url: string
  user_id: string
}

type BroadcastMessage = {
  type: 'INSERT' | 'DELETE' | 'UPDATE'
  bookmark: Bookmark
}

export default function BookmarkList({ initialBookmarks, userId }: { initialBookmarks: Bookmark[], userId: string }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    const broadcast = new BroadcastChannel(`bookmarks-${userId}`)

    const handleMessage = (event: MessageEvent<BroadcastMessage>) => {
      const { type, bookmark } = event.data

      if (type === 'INSERT') {
        setBookmarks((prev) => 
          prev.some((b) => b.id === bookmark.id) ? prev : [bookmark, ...prev]
        )
      }

      if (type === 'DELETE') {
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id))
      }

      if (type === 'UPDATE') {
        setBookmarks((prev) =>
          prev.map((b) => (b.id === bookmark.id ? bookmark : b))
        )
      }
    }

    broadcast.addEventListener('message', handleMessage)

    const channel = supabase.channel(`bookmarks-${userId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookmarks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'DELETE' | 'UPDATE'
        
        if (eventType === 'INSERT') {
          setBookmarks((prev) =>
            prev.some((b) => b.id === (payload.new as Bookmark).id)
              ? prev
              : [payload.new as Bookmark, ...prev]
          )
          broadcast.postMessage({
            type: 'INSERT',
            bookmark: payload.new as Bookmark,
          })
        } else if (eventType === 'DELETE') {
          const oldBookmark = payload.old as Bookmark
          setBookmarks((prev) => prev.filter((b) => b.id !== oldBookmark.id))
          broadcast.postMessage({
            type: 'DELETE',
            bookmark: { id: oldBookmark.id } as Bookmark,
          })
        } else if (eventType === 'UPDATE') {
          setBookmarks((prev) =>
            prev.map((b) =>
              b.id === (payload.new as Bookmark).id ? (payload.new as Bookmark) : b
            )
          )
          broadcast.postMessage({
            type: 'UPDATE',
            bookmark: payload.new as Bookmark,
          })
        }
      }
    ).subscribe()

    return () => {
      supabase.removeChannel(channel)
      broadcast.removeEventListener('message', handleMessage)
      broadcast.close()
    }
  }, [supabase, userId])

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !title) return
    
    setLoading(true)
    const tempId = Math.random()
    const newBookmark = { id: tempId, title, url, user_id: userId }
    
    setBookmarks((prev) => [newBookmark as Bookmark, ...prev])

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({ title, url, user_id: userId })
      .select()

    if (error) {
      setBookmarks((prev) => prev.filter((b) => b.id !== tempId))
    } else {
      const finalBookmark = data[0] as Bookmark
      setBookmarks((prev) =>
        prev.map((b) => (b.id === tempId ? finalBookmark : b))
      )

      const broadcast = new BroadcastChannel(`bookmarks-${userId}`)
      broadcast.postMessage({
        type: 'INSERT',
        bookmark: finalBookmark,
      })
      broadcast.close()
    }

    setUrl('')
    setTitle('')
    setLoading(false)
  }

  const deleteBookmark = async (id: number) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))

    const { error } = await supabase.from('bookmarks').delete().eq('id', id)

    if (!error) {
      const broadcast = new BroadcastChannel(`bookmarks-${userId}`)
      broadcast.postMessage({
        type: 'DELETE',
        bookmark: { id } as Bookmark,
      })
      broadcast.close()
    }
  }

  return (
    <div>
      <form onSubmit={addBookmark} className="mb-8 p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex gap-3">
        <input
          type="text"
          placeholder="Bookmark title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border border-slate-300 px-3 py-2 rounded-lg flex-1 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400"
        />
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border border-slate-300 px-3 py-2 rounded-lg flex-1 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400"
        />
        <button
          disabled={loading}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium px-6 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </form>

      <div className="space-y-2">
        {bookmarks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-500">No bookmarks saved yet. Add one to get started!</p>
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-indigo-600 hover:text-indigo-700 font-medium truncate group-hover:text-indigo-700"
              >
                {bookmark.title}
              </a>
              <button
                onClick={() => deleteBookmark(bookmark.id)}
                className="ml-4 text-slate-500 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}