import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Trash2, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface Team {
  id: string
  name: string
  created_at: string
}

export default function SetupTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchTeams()
    
    // Realtime subscription for instant updates
    const subscription = supabase
      .channel('teams_setup')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchTeams = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (error) {
      toast.error('Failed to fetch teams: ' + error.message)
    } else {
      setTeams(data || [])
    }
    setLoading(false)
  }

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return

    // Simple duplicate check before DB (DB also has unique constraint)
    if (teams.some(t => t.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      toast.error('Team name must be unique')
      return
    }

    setAdding(true)
    const { error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName.trim() }])

    if (error) {
      toast.error('Error adding team: ' + error.message)
    } else {
      toast.success('Team added successfully')
      setNewTeamName('')
    }
    setAdding(false)
  }

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure? This will delete all scores associated with this team.')) return

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete team')
    } else {
      toast.success('Team deleted')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setup Teams</h1>
        <p className="text-muted-foreground">Add the participating groups for the competition.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Team</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTeam} className="flex gap-4 items-end">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                placeholder="e.g. Eagle Squad"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={adding || !newTeamName.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Teams ({teams.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && teams.length === 0 ? (
             <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ul className="space-y-2">
              {teams.length === 0 ? (
                <li className="text-center text-muted-foreground py-4">No teams registered yet.</li>
              ) : (
                teams.map((team) => (
                  <li key={team.id} className="flex items-center justify-between p-3 border rounded-md bg-card">
                    <span className="font-medium">{team.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTeam(team.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
