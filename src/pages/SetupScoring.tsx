import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Trash2, Plus, GripVertical, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

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

  const overallMax = useMemo(() => {
    return aspects.reduce((sum, a) => sum + a.criteria.reduce((acc, c) => acc + (c.max_score || 0), 0), 0)
  }, [aspects])

  useEffect(() => {
    fetchAspects()
    fetchStatus()

    const channel = supabase
      .channel('scoring_setup')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aspects' }, () => fetchAspects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'criteria' }, () => fetchAspects())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchStatus = async (): Promise<void> => {
    // Aman: kalau tabel app_config belum ada / RLS nolak, jangan bikin crash.
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'status')
      .maybeSingle()

    if (error) return
    setIsFinished(data?.value === 'finished')
  }

  const handleFinishCompetition = async (): Promise<void> => {
    if (
      !confirm(
        'Are you sure you want to finish the competition? This will trigger the Reveal Screen for everyone.'
      )
    )
      return

    setLoading(true)
    const { error } = await supabase.from('app_config').upsert({ key: 'status', value: 'finished' })
    setLoading(false)

    if (error) toast.error('Failed to update status')
    else {
      toast.success('Competition Finished! Winners Revealed.')
      setIsFinished(true)
    }
  }

  const handleResetCompetition = async (): Promise<void> => {
    if (!confirm('Re-open competition?')) return

    setLoading(true)
    const { error } = await supabase.from('app_config').upsert({ key: 'status', value: 'ongoing' })
    setLoading(false)

    if (error) toast.error('Failed to update status')
    else {
      setIsFinished(false)
      toast.success('Competition Re-opened')
    }
  }

  const fetchAspects = async (): Promise<void> => {
    setLoading(true)

    const { data, error } = await supabase
      .from('aspects')
      .select('id,name,order_index,criteria(id,name,max_score,aspect_id,order_index)')
      .order('order_index', { ascending: true })

    if (error) {
      setLoading(false)
      toast.error(`Failed to fetch aspects: ${error.message}`)
      return
    }

    const sorted: Aspect[] = (data ?? []).map((a: any) => ({
      ...a,
      criteria: (a.criteria ?? []).sort((x: any, y: any) => (x.order_index ?? 0) - (y.order_index ?? 0)),
    }))

    setAspects(sorted)
    setLoading(false)
  }

  const handleAddAspect = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    const name = newAspectName.trim()
    if (!name) {
      toast.error('Aspect name is required')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('aspects').insert([{ name, order_index: aspects.length }])
    setLoading(false)

    if (error) toast.error(`Failed to create aspect: ${error.message}`)
    else {
      toast.success('Aspect created')
      setNewAspectName('')
      fetchAspects()
    }
  }

  const handleDeleteAspect = async (id: string): Promise<void> => {
    if (!confirm('Delete aspect and all its criteria?')) return

    setLoading(true)
    const { error } = await supabase.from('aspects').delete().eq('id', id)
    setLoading(false)

    if (error) toast.error(`Failed to delete: ${error.message}`)
    else toast.success('Aspect deleted')
  }

  // ✅ IMPORTANT: return type is Promise<void> (no return string/number)
  const handleAddCriteria = async (aspectId: string, name: string, maxScore: number): Promise<void> => {
    const cleanName = name.trim()
    if (!cleanName) {
      toast.error('Criteria name is required')
      return
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      toast.error('Max score must be > 0')
      return
    }

    const aspect = aspects.find((a) => a.id === aspectId)
    const nextIndex = aspect ? (aspect.criteria?.length ?? 0) : 0

    setLoading(true)
    const { error } = await supabase.from('criteria').insert([
      {
        aspect_id: aspectId,
        name: cleanName,
        max_score: maxScore,
        order_index: nextIndex,
      },
    ])
    setLoading(false)

    if (error) {
      toast.error(`Failed to add criteria: ${error.message}`)
      return
    }

    toast.success('Criteria added')
  }

  const handleDeleteCriteria = async (id: string): Promise<void> => {
    setLoading(true)
    const { error } = await supabase.from('criteria').delete().eq('id', id)
    setLoading(false)

    if (error) toast.error(`Failed to delete criteria: ${error.message}`)
    else toast.success('Criteria deleted')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setup Scoring</h1>
        <p className="text-muted-foreground">
          Define aspects and criteria for judging. <span className="font-medium">Overall max:</span> {overallMax}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Evaluation Aspect</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAspect} className="flex gap-4">
            <Input
              placeholder="Aspect Name (e.g. Presentation)"
              value={newAspectName}
              onChange={(e) => setNewAspectName(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !newAspectName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Add Aspect'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && <div className="text-sm text-muted-foreground">Loading...</div>}

      <div className="space-y-6">
        {aspects.map((aspect) => (
          <AspectEditor
            key={aspect.id}
            aspect={aspect}
            onDelete={() => handleDeleteAspect(aspect.id)}
            onAddCriteria={handleAddCriteria}
            onDeleteCriteria={handleDeleteCriteria}
            disabled={loading}
          />
        ))}
      </div>

      <div className="pt-8 border-t">
        <h2 className="text-xl font-bold mb-4">Competition Controls</h2>
        <div className="flex gap-4">
          {!isFinished ? (
            <Button
              size="lg"
              onClick={handleFinishCompetition}
              disabled={loading}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Reveal Winners
            </Button>
          ) : (
            <Button variant="outline" onClick={handleResetCompetition} disabled={loading}>
              Re-open Competition
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function AspectEditor({
  aspect,
  onDelete,
  onAddCriteria,
  onDeleteCriteria,
  disabled,
}: {
  aspect: Aspect
  onDelete: () => void
  onAddCriteria: (aspectId: string, name: string, maxScore: number) => Promise<void>
  onDeleteCriteria: (id: string) => Promise<void>
  disabled?: boolean
}) {
  const [critName, setCritName] = useState('')
  const [critMax, setCritMax] = useState('10')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const max = Number(critMax)
    if (!critName.trim()) {
      toast.error('Criteria name is required')
      return
    }
    if (!Number.isFinite(max) || max <= 0) {
      toast.error('Max score must be > 0')
      return
    }

    await onAddCriteria(aspect.id, critName.trim(), max)
    setCritName('')
    setCritMax('10')
  }

  const totalMax = useMemo(() => {
    return aspect.criteria.reduce((acc, c) => acc + (c.max_score || 0), 0)
  }, [aspect.criteria])

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
            <h3 className="text-xl font-semibold">{aspect.name}</h3>
            <span className="text-sm bg-muted px-2 py-0.5 rounded text-muted-foreground">Max: {totalMax}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive" disabled={disabled}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          {aspect.criteria.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
              <div className="flex items-center gap-4">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">Max Score: {c.max_score}</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDeleteCriteria(c.id)}
                disabled={disabled}
              >
                <Trash2 className={cn('h-3 w-3 text-muted-foreground hover:text-destructive')} />
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Criteria Name</Label>
              <Input
                value={critName}
                onChange={(e) => setCritName(e.target.value)}
                placeholder="e.g. Clarity"
                className="h-8"
                disabled={disabled}
              />
            </div>
            <div className="w-24">
              <Label className="text-xs">Max Score</Label>
              <Input
                type="number"
                min={1}
                value={critMax}
                onChange={(e) => setCritMax(e.target.value)}
                className="h-8"
                disabled={disabled}
              />
            </div>
            <Button type="submit" size="sm" className="h-8" variant="secondary" disabled={disabled}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
