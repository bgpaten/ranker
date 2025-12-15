import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Trash2, Plus, GripVertical, Trophy } from 'lucide-react'
import { toast } from 'sonner'

interface Criteria {
  id: string
  name: string
  max_score: number
  aspect_id: string
  order_index: number
}

interface Aspect {
  id: string
  name: string
  order_index: number
  criteria: Criteria[]
}

export default function SetupScoring() {
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [loading, setLoading] = useState(false)
  const [newAspectName, setNewAspectName] = useState('')
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    fetchAspects()
    fetchStatus()

    const subs = supabase.channel('scoring_setup')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aspects' }, () => fetchAspects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'criteria' }, () => fetchAspects())
      .subscribe()
      
    return () => { subs.unsubscribe() }
  }, [])

  const fetchStatus = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'status').single()
    if (data && data.value === 'finished') setIsFinished(true)
  }

  const handleFinishCompetition = async () => {
    if (!confirm('Are you sure you want to finish the competition? This will trigger the Reveal Screen for everyone.')) return
    
    // Create/Upsert status
    const { error } = await supabase.from('app_config').upsert({ key: 'status', value: 'finished' })
    if (error) toast.error('Failed to update status')
    else {
      toast.success('Competition Finished! Winners Revealed.')
      setIsFinished(true)
    }
  }

  const handleResetCompetition = async () => {
      if (!confirm('Re-open competition?')) return
      await supabase.from('app_config').upsert({ key: 'status', value: 'ongoing' })
      setIsFinished(false)
      toast.success('Competition Re-opened')
  }

  const fetchAspects = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('aspects')
      .select('*, criteria(*)')
      .order('order_index', { ascending: true })
      // For criteria we need to sort client side or use another query. 
      // Supabase order() applies to the parent usually. 
    
    if (error) {
      toast.error('Failed to fetch aspects')
    } else {
      // Sort criteria by order_index
      const sorted = (data || []).map((a: any) => ({
        ...a,
        criteria: (a.criteria || []).sort((x: any, y: any) => x.order_index - y.order_index)
      }))
      setAspects(sorted)
    }
    setLoading(false)
  }

  const handleAddAspect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAspectName.trim()) return

    const { error } = await supabase
      .from('aspects')
      .insert([{ 
        name: newAspectName.trim(), 
        order_index: aspects.length 
      }])

    if (error) {
      toast.error('Failed to create aspect')
    } else {
      toast.success('Aspect created')
      setNewAspectName('')
    }
  }

  const handleDeleteAspect = async (id: string) => {
    if (!confirm('Delete aspect and all its criteria?')) return
    const { error } = await supabase.from('aspects').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
  }

  const handleAddCriteria = async (aspectId: string, name: string, maxScore: number) => {
    const { error } = await supabase.from('criteria').insert([{
      aspect_id: aspectId,
      name,
      max_score: maxScore,
      order_index: 999 // Should calculate correct index, but simple for now
    }])
    if (error) toast.error('Failed to add criteria')
    else toast.success('Criteria added')
  }

  const handleDeleteCriteria = async (id: string) => {
    const { error } = await supabase.from('criteria').delete().eq('id', id)
    if (error) toast.error('Failed to delete criteria')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setup Scoring</h1>
        <p className="text-muted-foreground">Define aspects and criteria for judging.</p>
      </div>

      {/* Add Aspect Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Evaluation Aspect</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAspect} className="flex gap-4">
            <Input 
              placeholder="Aspect Name (e.g. Presentation)" 
              value={newAspectName}
              onChange={e => setNewAspectName(e.target.value)}
            />
            <Button type="submit" disabled={!newAspectName.trim()}><Plus className="mr-2 h-4 w-4"/> Add Aspect</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {aspects.map(aspect => (
          <AspectEditor 
            key={aspect.id} 
            aspect={aspect} 
            onDelete={() => handleDeleteAspect(aspect.id)}
            onAddCriteria={handleAddCriteria}
            onDeleteCriteria={handleDeleteCriteria}
          />
        ))}
      </div>

      <div className="pt-8 border-t">
          <h2 className="text-xl font-bold mb-4">Competition Controls</h2>
          <div className="flex gap-4">
              {!isFinished ? (
                  <Button size="lg" onClick={handleFinishCompetition} className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0">
                      <Trophy className="mr-2 h-5 w-5" />
                      Reveal Winners
                  </Button>
              ) : (
                  <Button variant="outline" onClick={handleResetCompetition}>
                      Re-open Competition
                  </Button>
              )}
          </div>
      </div>
    </div>
  )
}

function AspectEditor({ aspect, onDelete, onAddCriteria, onDeleteCriteria }: { 
  aspect: Aspect, 
  onDelete: () => void,
  onAddCriteria: (aspectId: string, name: string, maxScore: number) => Promise<void>,
  onDeleteCriteria: (id: string) => Promise<void>
}) {
  const [critName, setCritName] = useState('')
  const [critMax, setCritMax] = useState('10')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!critName.trim() || !critMax) return
    onAddCriteria(aspect.id, critName.trim(), parseInt(critMax))
    setCritName('')
    setCritMax('10')
  }

  const totalMax = aspect.criteria.reduce((acc, c) => acc + c.max_score, 0)

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
            <h3 className="text-xl font-semibold">{aspect.name}</h3>
            <span className="text-sm bg-muted px-2 py-0.5 rounded text-muted-foreground">Max: {totalMax}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
         {/* Criteria List */}
         <div className="space-y-2">
           {aspect.criteria.map(c => (
             <div key={c.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
               <div className="flex items-center gap-4">
                 <span className="font-medium">{c.name}</span>
                 <span className="text-xs text-muted-foreground">Max Score: {c.max_score}</span>
               </div>
               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteCriteria(c.id)}>
                 <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
               </Button>
             </div>
           ))}
         </div>

         {/* Add Criteria */}
         <div className="pt-2 border-t">
           <form onSubmit={handleSubmit} className="flex gap-2 items-end">
             <div className="flex-1">
               <Label className="text-xs">Criteria Name</Label>
               <Input value={critName} onChange={e => setCritName(e.target.value)} placeholder="e.g. Clarity" size={undefined} className="h-8" />
             </div>
             <div className="w-24">
               <Label className="text-xs">Max Score</Label>
               <Input type="number" min="1" value={critMax} onChange={e => setCritMax(e.target.value)} className="h-8" />
             </div>
             <Button type="submit" size="sm" className="h-8" variant="secondary"><Plus className="h-3 w-3 mr-1"/> Add</Button>
           </form>
         </div>
      </CardContent>
    </Card>
  )
}
