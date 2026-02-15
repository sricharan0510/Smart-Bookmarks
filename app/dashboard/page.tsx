import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import BookmarkList from './bookmark-list' 

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">My Bookmarks</h1>
            <p className="text-slate-600">Organize and manage your bookmarks</p>
          </div>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-slate-600 bg-slate-200 px-4 py-2 rounded-full">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm font-medium text-slate-600 hover:text-white transition-colors bg-slate-200 hover:bg-red-500 px-4 py-2 rounded-lg">
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <BookmarkList initialBookmarks={bookmarks || []} userId={user.id} />
      </div>
    </div>
  )
}