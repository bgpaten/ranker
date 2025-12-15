import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Trophy, Settings, Users, ClipboardList } from 'lucide-react'
import { Toaster } from 'sonner'
import { cn } from '../lib/utils'

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Trophy className="h-6 w-6 text-primary" />
            <span>Ranker</span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/setup/teams" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Users className="h-4 w-4" /> Teams
            </Link>
            <Link to="/setup/scoring" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Settings className="h-4 w-4" /> Scoring
            </Link>
            <Link to="/input" className="flex items-center gap-2 hover:text-primary transition-colors">
              <ClipboardList className="h-4 w-4" /> Input
            </Link>
            <Link to="/rank" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Trophy className="h-4 w-4" /> Ranker
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
        <Toaster />
      </main>
    </div>
  )
}
