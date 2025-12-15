import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, Star } from "lucide-react";
import { cn } from "../lib/utils";

interface Team {
  id: string;
  name: string;
}

interface Score {
  team_id: string;
  score: number;
}

interface RankedTeam {
  team: Team;
  totalScore: number;
  rank: number;
}

export default function Winners() {
  const [winners, setWinners] = useState<RankedTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWinners();
  }, []);

  useEffect(() => {
    if (winners.length === 0) return;

    const duration = 5_000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }

      const particleCount = Math.floor(50 * (timeLeft / duration));
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [winners]);

  const fetchWinners = async () => {
    setLoading(true);

    const [teamsRes, scoresRes] = await Promise.all([
      supabase.from("teams").select("id,name"),
      supabase.from("scores").select("team_id,score"),
    ]);

    if (teamsRes.error) {
      console.error(teamsRes.error);
      setWinners([]);
      setLoading(false);
      return;
    }
    if (scoresRes.error) {
      console.error(scoresRes.error);
      setWinners([]);
      setLoading(false);
      return;
    }

    const teams: Team[] = (teamsRes.data ?? []) as Team[];
    const scores: Score[] = (scoresRes.data ?? []) as Score[];

    // Pre-aggregate scores by team_id (lebih cepat dari filter tiap team)
    const totals = new Map<string, number>();
    for (const s of scores) {
      totals.set(s.team_id, (totals.get(s.team_id) ?? 0) + (s.score ?? 0));
    }

    const ranked: RankedTeam[] = teams
      .map((team) => ({
        team,
        totalScore: totals.get(team.id) ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, 3);

    setWinners(ranked);
    setLoading(false);
  };

  if (loading) return null;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-12 py-12">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "backOut" }}
        className="text-center space-y-4"
      >
        <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
          CHAMPIONS
        </h1>
        <p className="text-xl text-muted-foreground">The results are in!</p>
      </motion.div>

      <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 h-96 w-full max-w-4xl px-4">
        {winners[1] && (
          <WinnerPodium
            team={winners[1]}
            color="bg-gray-300"
            height="h-48"
            delay={0.2}
            iconColor="text-gray-400"
          />
        )}

        {winners[0] && (
          <WinnerPodium
            team={winners[0]}
            color="bg-gradient-to-t from-yellow-500 to-yellow-300"
            height="h-64"
            delay={0.4}
            isFirst
            iconColor="text-yellow-600"
          />
        )}

        {winners[2] && (
          <WinnerPodium
            team={winners[2]}
            color="bg-amber-700"
            height="h-32"
            delay={0}
            iconColor="text-amber-800"
          />
        )}
      </div>
    </div>
  );
}

function WinnerPodium({
  team,
  color,
  height,
  delay,
  isFirst,
  iconColor,
}: {
  team: RankedTeam;
  color: string;
  height: string;
  delay: number;
  isFirst?: boolean;
  iconColor: string;
}) {
  return (
    <motion.div
      className="flex flex-col items-center w-full md:w-1/3"
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 100, damping: 12 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.5 }}
        className="mb-4 text-center pointer-events-none"
      >
        <div className="relative inline-block">
          {isFirst && (
            <Star
              className="absolute -top-6 -right-6 h-8 w-8 text-yellow-400 animate-spin-slow"
              fill="currentColor"
            />
          )}
          <Trophy className={cn("h-16 w-16 drop-shadow-lg", iconColor)} />
        </div>
        <h2 className="text-2xl font-bold mt-2 whitespace-nowrap">
          {team.team.name}
        </h2>
        <div className="text-lg font-mono text-muted-foreground">
          {team.totalScore} pts
        </div>
      </motion.div>

      <div
        className={cn(
          "w-full rounded-t-lg shadow-2xl border-t border-white/10 flex items-start justify-center pt-4 transform",
          color,
          height
        )}
      >
        <span
          className={cn("text-6xl font-black text-black/20 mix-blend-overlay")}
        >
          {team.rank}
        </span>
      </div>
    </motion.div>
  );
}
