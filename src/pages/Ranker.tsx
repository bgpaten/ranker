import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Activity, LayoutList, Medal, Flag } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface Team { id: string, name: string }
interface Aspect { id: string, name: string, order_index: number }
interface Score { id: string, team_id: string, criteria_id: string, score: number, updated_at: string }
interface Criteria { id: string, aspect_id: string }

interface RankedTeam {
  team: Team
  totalScore: number
  aspectScores: Record<string, number>
  lastUpdate: string
}

export default function Ranker() {
  const [teams, setTeams] = useState<Team[]>([])
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [showBreakdown, setShowBreakdown] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'race'>('race') // Default to 'race' for impact
  const [showSplash, setShowSplash] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
    checkStatus()

    const sub = supabase.channel('ranker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        // Optimistic update or refetch? Refetch is safer for aggregation.
        // But to be super "real-time" and smooth, we can try to merge.
        // For simplicity: Refetch scores only.
        fetchScores() 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload) => {
          if (payload.new && (payload.new as any).key === 'status') {
              if ((payload.new as any).value === 'finished') {
                  handleFinish()
              }
          }
      })
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [])

  const checkStatus = async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'status').single()
      if (data && data.value === 'finished') {
          // If already finished when loading, just go to winners? 
          // Or show splash briefly? let's go to winners to avoid stuck splash loops.
          navigate('/winners')
      }
  }

  const handleFinish = () => {
      setShowSplash(true)
      setTimeout(() => {
          navigate('/winners')
      }, 3000)
  }

  const fetchData = async () => {
    const [teamsRes, aspectsRes, criteriaRes, scoresRes] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('aspects').select('*').order('order_index'),
      supabase.from('criteria').select('id, aspect_id'),
      supabase.from('scores').select('*')
    ])
    
    if (teamsRes.data) setTeams(teamsRes.data)
    if (aspectsRes.data) setAspects(aspectsRes.data)
    if (criteriaRes.data) setCriteria(criteriaRes.data)
    if (scoresRes.data) setScores(scoresRes.data)
  }

  const fetchScores = async () => {
    const { data } = await supabase.from('scores').select('*')
    if (data) setScores(data)
  }

  const rankedData = useMemo(() => {
    // Map criteria to aspect
    const criteriaAspectMap = new Map<string, string>()
    criteria.forEach(c => criteriaAspectMap.set(c.id, c.aspect_id))

    const data: RankedTeam[] = teams.map(team => {
      const teamScores = scores.filter(s => s.team_id === team.id)
      const totalScore = teamScores.reduce((acc, s) => acc + s.score, 0)
      
      const aspectScores: Record<string, number> = {}
      teamScores.forEach(s => {
        const aspectId = criteriaAspectMap.get(s.criteria_id)
        if (aspectId) {
            aspectScores[aspectId] = (aspectScores[aspectId] || 0) + s.score
        }
      })

      // Find last update
      // If no scores, use team created_at? Or 0?
      // Use max updated_at of scores.
      let lastUpdate = ''
      if (teamScores.length > 0) {
        lastUpdate = teamScores.reduce((latest, s) => {
            return s.updated_at > latest ? s.updated_at : latest
        }, '')
      }

      return { team, totalScore, aspectScores, lastUpdate }
    })

    // Sort
    return data.sort((a, b) => {
      // 1. Total Score Desc
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
      
      // 2. Technical Aspect (Assume aspect name "Teknis" or just highest weight aspect if implemented)
      // User said: "skor aspek 'Teknis' (atau aspek dengan bobot tertinggi)"
      // Let's look for an aspect named 'Teknis' (case insensitive)
      const technicalAspect = aspects.find(asp => asp.name.toLowerCase().includes('teknis'))
      if (technicalAspect) {
        const scoreA = a.aspectScores[technicalAspect.id] || 0
        const scoreB = b.aspectScores[technicalAspect.id] || 0
        if (scoreB !== scoreA) {
          return scoreB - scoreA
        }
      }

      // 3. Updated At Asc (Earlier is better)
      // Handle empty lastUpdate (no scores). If A has scores and B doesn't?
      // Usually ranker is for teams with scores.
      if (a.lastUpdate && b.lastUpdate) {
        return a.lastUpdate.localeCompare(b.lastUpdate)
      }
      return 0
    })
  }, [teams, scores, aspects, criteria])



  // Re-fetch criteria to get max_score
  useEffect(() => {
      const getCriteria = async () => {
          const { data } = await supabase.from('criteria').select('max_score')
          if (data) {
              const total = data.reduce((acc, c) => acc + c.max_score, 0)
              setMaxTotalScore(total)
          }
      }
      getCriteria()
  }, [criteria.length]) // trigger when criteria changes

  const [maxTotalScore, setMaxTotalScore] = useState(100)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Live Rankings</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 animate-pulse text-green-500" />
            Real-time updates active
          </p>
          <button 
             onClick={() => navigate('/setup/scoring')}
             className="text-xs text-muted-foreground hover:text-primary underline mt-1"
          >
             Determine Winner
          </button>
        </div>
        <div className="flex items-center space-x-4">
           {/* View Toggle */}
           <div className="flex bg-muted p-1 rounded-lg">
             <button
               onClick={() => setViewMode('table')}
               className={cn("px-3 py-1 rounded-md text-sm font-medium transition-all", viewMode === 'table' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
             >
               <LayoutList className="h-4 w-4" />
             </button>
             <button
               onClick={() => setViewMode('race')}
               className={cn("px-3 py-1 rounded-md text-sm font-medium transition-all", viewMode === 'race' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
             >
               <Flag className="h-4 w-4" />
             </button>
           </div>
           
           {viewMode === 'table' && (
              <div className="flex items-center space-x-2">
                <label htmlFor="breakdown-toggle" className="text-sm font-medium">Breakdown</label>
                <button
                  id="breakdown-toggle"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    showBreakdown ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      showBreakdown ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
           )}
        </div>
      </div>

      <AnimatePresence mode='wait'>
        {viewMode === 'race' ? (
          <motion.div 
            key="race"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* Podium Section */}
            {rankedData.length >= 3 && (
                <div className="flex justify-center items-end gap-4 h-64 pt-8">
                    {/* 2nd Place */}
                    <PodiumPlace team={rankedData[1]} rank={2} color="bg-gray-300" height="h-32" />
                    {/* 1st Place */}
                    <PodiumPlace team={rankedData[0]} rank={1} color="bg-yellow-400" height="h-48" />
                    {/* 3rd Place */}
                    <PodiumPlace team={rankedData[2]} rank={3} color="bg-amber-600" height="h-24" />
                </div>
            )}

            {/* Race Track Section */}
            <div className="space-y-4">
               {rankedData.map((data, index) => {
                   const progress = Math.min((data.totalScore / (maxTotalScore || 1)) * 100, 100)
                   
                   return (
                       <motion.div 
                         layoutId={`track-${data.team.id}`}
                         key={data.team.id}
                         className="relative"
                       >
                           <div className="flex items-center gap-4 mb-1">
                               <div className="w-8 text-center font-bold text-muted-foreground">#{index + 1}</div>
                               <div className="font-semibold text-sm">{data.team.name}</div>
                               <div className="text-xs text-muted-foreground ml-auto">{data.totalScore} pts</div>
                           </div>
                           <div className="h-8 bg-muted/30 rounded-full relative overflow-hidden">
                               <div className="absolute inset-0 flex items-center px-2">
                                   {/* Build Markers */}
                                    {[25, 50, 75].map(p => (
                                        <div key={p} className="absolute h-full w-px bg-white/10" style={{ left: `${p}%` }} />
                                    ))}
                               </div>
                                <motion.div 
                                  className={cn(
                                    "h-full rounded-full flex items-center justify-end px-2",
                                    index === 0 ? "animate-rgb-1" : 
                                    index === 1 ? "animate-rgb-2" : 
                                    index === 2 ? "animate-rgb-3" : 
                                    "bg-gradient-to-r from-blue-500 to-indigo-600"
                                  )}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ type: "spring", stiffness: 50, damping: 15 }}
                                >
                                   <div className="bg-white/90 text-primary text-[10px] font-bold px-1.5 rounded-full shadow-sm">
                                       {Math.round(progress)}%
                                   </div>
                               </motion.div>
                           </div>
                       </motion.div>
                   )
               })}
            </div>

          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-4 font-bold text-center w-16">Rank</th>
                        <th className="p-4 font-bold">Team</th>
                        {showBreakdown && aspects.map(a => (
                        <th key={a.id} className="p-4 font-medium text-muted-foreground text-center hidden md:table-cell">
                            {a.name}
                        </th>
                        ))}
                        <th className="p-4 font-bold text-right text-lg">Total</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {rankedData.map((data, index) => {
                        return (
                        <tr key={data.team.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 text-center text-xl font-bold text-muted-foreground">
                            {index + 1}
                            </td>
                            <td className="p-4 font-medium text-lg">
                            {data.team.name}
                            <div className="md:hidden text-xs text-muted-foreground mt-1">
                                {/* Mobile View Breakdown */}
                                {showBreakdown && (
                                <div className="grid grid-cols-2 gap-1">
                                    {aspects.map(a => (
                                    <div key={a.id}>{a.name}: {data.aspectScores[a.id] || 0}</div>
                                    ))}
                                </div>
                                )}
                            </div>
                            </td>
                            {showBreakdown && aspects.map(a => (
                            <td key={a.id} className="p-4 text-center hidden md:table-cell text-muted-foreground">
                                {data.aspectScores[a.id] || 0}
                            </td>
                            ))}
                            <td className="p-4 text-right">
                            <span className="text-2xl font-bold text-primary">{data.totalScore}</span>
                            </td>
                        </tr>
                        )
                    })}
                    {rankedData.length === 0 && (
                        <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                            Waiting for scores...
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Splash Screen Overlay */}
      <AnimatePresence>
        {showSplash && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white"
            >
                <motion.div
                    initial={{ scale: 0.5, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="text-center"
                >
                    <h1 className="text-6xl font-bold mb-4 text-yellow-500">COMPETITION ENDED</h1>
                    <p className="text-2xl text-gray-300">Revealing Winners...</p>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PodiumPlace({ team, rank, color, height }: { team: RankedTeam, rank: number, color: string, height: string }) {
    return (
        <motion.div 
            className="flex flex-col items-center"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: rank * 0.1, type: "spring" }}
        >
            <div className="mb-2 text-center">
                <Medal className={cn("h-8 w-8 mx-auto mb-1", 
                    rank === 1 ? "text-yellow-400" : 
                    rank === 2 ? "text-gray-300" : "text-amber-600"
                )} />
                <div className="font-bold text-sm md:text-base max-w-[100px] truncate">{team.team.name}</div>
                <div className="text-xs text-muted-foreground">{team.totalScore} pts</div>
            </div>
            <div className={cn("w-20 md:w-32 rounded-t-lg shadow-lg flex items-end justify-center pb-4 text-4xl font-bold text-black/20", color, height)}>
                {rank}
            </div>
        </motion.div>
    )
}
