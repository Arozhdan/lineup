/* 3.1 Голосование MVP. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, NavBar } from "@/ds";
import { Lede } from "@/ds/extras";
import { I } from "@/icons";

export function Mvp() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const run = useAction();
  const [pick, setPick] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const mvpQuery = useQuery({
    queryKey: ["mvp", id],
    queryFn: () => unwrap(api.games[":id"].mvp.$get({ param: { id } })),
    enabled: !!id,
  });
  const resultQuery = useQuery({
    queryKey: ["result", id],
    queryFn: () => unwrap(api.games[":id"].result.$get({ param: { id } })),
    enabled: !!id,
  });

  const nominees = mvpQuery.data?.nominees ?? [];
  const myVote = mvpQuery.data?.myVote ?? null;
  const windowOpen = resultQuery.data?.voteWindowOpen ?? false;

  useEffect(() => {
    if (myVote != null) setPick(myVote);
  }, [myVote]);

  const submit = async () => {
    if (pick == null) return;
    setSaving(true);
    const ok = await run(() => unwrap(api.games[":id"].mvp.$post({ param: { id }, json: { voteeId: pick } })), {
      ok: "Голос учтён!",
      invalidate: [["result", id]],
    });
    setSaving(false);
    if (ok) navigate(-1);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Выбор MVP" onBack={() => navigate(-1)} backLabel="Итог" />
      <div className="lu-scr__body">
        <Lede
          title="Кто был лучшим?"
          text="Голосование открыто 24 часа после матча. Голос анонимный, за себя голосовать нельзя."
        />
        <div className="lu-vote-grid">
          {nominees.map((p) => (
            <button key={p.id} className="lu-vote" data-on={pick === p.id} onClick={() => setPick(p.id)}>
              {pick === p.id && (
                <span className="lu-vote__tick">
                  <I.Check width={14} height={14} />
                </span>
              )}
              <Avatar name={p.name} src={p.photoUrl ?? undefined} size={48} />
              <span>{p.first}</span>
              <span className="lu-vote__pos">{p.position}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={saving} disabled={pick == null || !windowOpen} onClick={submit}>
          {windowOpen ? "Отдать голос" : "Голосование закрыто"}
        </Button>
      </div>
    </div>
  );
}
