// src/components/dtr/DtrBanner.tsx
//
// Dashboard strip for the DTR. Staff see their own status for today
// ("not filled · 3 suggestions ready" → Fill DTR); Admin sees the team
// count (→ Team DTR). Hidden quietly if the user has no DTR access.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { getMyTodayStatus, getTeamDtr, prettyTime, todayIst, type DtrTodayStatus, type TeamDtr } from "../../services/dtrService";

export default function DtrBanner({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [mine, setMine] = useState<DtrTodayStatus | null>(null);
  const [team, setTeam] = useState<TeamDtr | null>(null);

  useEffect(() => {
    let cancelled = false;
    (isAdmin ? getTeamDtr(todayIst()).then((t) => !cancelled && setTeam(t)) : getMyTodayStatus().then((m) => !cancelled && setMine(m)))
      .catch(() => { /* no DTR access — show nothing */ });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (isAdmin) {
    if (!team || team.team === 0) return null;
    return (
      <button onClick={() => navigate("/dtr/team")}
        className="w-full flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm text-indigo-900">
          <ClipboardList size={17} />
          <b>Team DTR today:</b> {team.submitted}/{team.team} submitted
          {team.notFilled > 0 && <span className="text-red-700"> · {team.notFilled} not filled</span>}
        </span>
        <span className="text-sm font-semibold text-indigo-700">Open Team DTR →</span>
      </button>
    );
  }

  if (!mine) return null;
  if (mine.status === "SUBMITTED") {
    return (
      <button onClick={() => navigate("/dtr")}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-left text-sm text-green-800">
        <span className="flex items-center gap-2"><ClipboardList size={16} /> ✓ Today's DTR submitted {prettyTime(mine.submittedAt)}</span>
        <span className="font-semibold">View</span>
      </button>
    );
  }
  const draft = mine.status === "DRAFT";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${draft ? "border-amber-200 bg-amber-50" : "border-orange-200 bg-orange-50"}`}>
      <span className={`flex items-center gap-2 text-sm ${draft ? "text-amber-900" : "text-orange-900"}`}>
        <ClipboardList size={17} />
        <b>{draft ? `Today's DTR is a draft (${mine.tasks} tasks) — not submitted yet` : "Today's DTR is not filled yet"}</b>
        {mine.suggestions > 0 && <span>· {mine.suggestions} suggestion{mine.suggestions === 1 ? "" : "s"} ready from your CRM work</span>}
      </span>
      <button onClick={() => navigate("/dtr")}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700">
        {draft ? "Submit DTR →" : "Fill DTR →"}
      </button>
    </div>
  );
}