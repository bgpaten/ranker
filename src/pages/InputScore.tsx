import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { cn } from '../lib/utils'

interface Team { id: string, name: string }
interface Criteria { id: string, name: string, max_score: number, aspect_id: string, order_index: number }
interface Aspect { id: string, name: string, order_index: number, criteria: Criteria[] }
interface ScoreMap { [criteriaId: string]: number }

export default function InputScore() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [scores, setScores] = useState<ScoreMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTeams()
    fetchAspects()
  }, [])

  useEffect(() => {
    if (selectedTeam) {
      fetchScores(selectedTeam)
    } else {
      setScores({})
    }
  }, [selectedTeam])

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name')
    setTeams(data || [])
  }

  const fetchAspects = async () => {
    const { data } = await supabase.from('aspects').select('*, criteria(*)')
      .order('order_index', { ascending: true })
    
    if (data) {
       const sorted = data.map((a: any) => ({
        ...a,
        criteria: (a.criteria || []).sort((x: any, y: any) => x.order_index - y.order_index)
      }))
      setAspects(sorted)
    }
  }

  const fetchScores = async (teamId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('scores')
      .select('criteria_id, score')
      .eq('team_id', teamId)
    
    if (error) {
      toast.error('Failed to load scores')
    } else {
      const map: ScoreMap = {}
      data.forEach((s: any) => { map[s.criteria_id] = s.score })
      setScores(map)
    }
    setLoading(false)
  }

  const handleScoreChange = (criteriaId: string, val: string) => {
    const num = parseInt(val)
    if (isNaN(num)) return
    setScores(prev => ({ ...prev, [criteriaId]: num }))
  }

  const handleSave = async () => {
    if (!selectedTeam) return
    setSaving(true)

    const updates = Object.entries(scores).map(([criteriaId, score]) => ({
      team_id: selectedTeam,
      criteria_id: criteriaId,
      score: score,
      judge_id: 'default' // Fixed judge for now
    }))

    if (updates.length === 0) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('scores')
      .upsert(updates, { onConflict: 'team_id, criteria_id, judge_id' })

    if (error) {
      toast.error('Failed to save scores: ' + error.message)
    } else {
      toast.success('Scores saved successfully')
    }
    setSaving(false)
  }

  const getTotalScore = () => {
    return Object.values(scores).reduce((a, b) => a + b, 0)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Input Scores</h1>
          <p className="text-muted-foreground">Select a team and enter scores.</p>
        </div>
        {selectedTeam && (
           <div className="text-right">
             <div className="text-2xl font-bold text-primary">{getTotalScore()}</div>
             <div className="text-xs text-muted-foreground">Total Score</div>
           </div>
        )}
      </div>

      <Card className="p-4">
        <Label>Select Team</Label>
        <select 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
        >
          <option value="">-- Choose Team --</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Card>

      {selectedTeam && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {aspects.map(aspect => (
                <Card key={aspect.id}>
                  <CardHeader className="py-4 bg-muted/20">
                    <CardTitle className="text-lg">{aspect.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {aspect.criteria.map(criteria => {
                      const currentScore = scores[criteria.id] ?? 0
                      const isOver = currentScore > criteria.max_score
                      const isNegative = currentScore < 0

                      return (
                        <div key={criteria.id} className="grid grid-cols-[1fr,100px] gap-4 items-center">
                          <div>
                            <Label className="text-base">{criteria.name}</Label>
                            <div className="text-xs text-muted-foreground">Max: {criteria.max_score}</div>
                          </div>
                          <div>
                            <Input 
                              type="number" 
                              min="0"
                              max={criteria.max_score}
                              value={scores[criteria.id]?.toString() ?? ''} // Empty string for 0? No, show value. if undefined show '' or 0? better '' for new input
                              placeholder="0"
                              onChange={e => handleScoreChange(criteria.id, e.target.value)}
                              className={cn(
                                "text-right font-mono font-medium",
                                (isOver || isNegative) && "border-destructive text-destructive focus-visible:ring-destructive"
                              )}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}

              <div className="fixed bottom-6 right-6 md:relative md:bottom-auto md:right-auto flex justify-end">
                 <Button size="lg" onClick={handleSave} disabled={saving} className="shadow-lg md:shadow-none w-full md:w-auto">
                   {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                   Save Scores
                 </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
