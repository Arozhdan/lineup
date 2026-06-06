/* 3.9 Публичный профиль. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Avatar, Badge, Button, ListItem, ListSection, NavBar, PositionBadge, roleColorOf } from "@/ds";
import { I } from "@/icons";

export function PublicProfile() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { toast } = useApp();

  const playerQuery = useQuery({
    queryKey: ["players", id],
    queryFn: () => unwrap(api.players[":id"].$get({ param: { id } })),
    enabled: !!id,
  });

  const p = playerQuery.data;

  const invite = async () => {
    const link = `${window.location.origin}/#/player/${id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard unavailable — still confirm */
    }
    toast("Ссылка скопирована — отправь игроку");
  };

  return (
    <div className="lu-scr">
      <NavBar title="" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        {playerQuery.isPending && (
          <div className="lu-profile-head">
            <div className="lu-skel" style={{ height: 84, width: 84, borderRadius: "50%" }} />
          </div>
        )}
        {p && (
          <>
            <div className="lu-profile-head">
              <Avatar
                name={p.name}
                src={p.photoUrl ?? undefined}
                size={84}
                positionBadge={p.primaryPos}
                positionColor={roleColorOf(p.primaryPos)}
              />
              <div className="lu-profile-name">{p.name}</div>
              <div className="lu-profile-chips">
                <Badge variant="accent">
                  <I.Star width={12} height={12} />
                  {p.stats.points} очков
                </Badge>
                <Badge variant="success">{p.stats.games} игр</Badge>
              </div>
            </div>

            <div className="lu-tiles">
              <div className="lu-tile">
                <span className="lu-tile__v">{p.stats.mvp}×</span>
                <span className="lu-tile__l">MVP</span>
              </div>
              <div className="lu-tile">
                <span className="lu-tile__v">{p.stats.reliability}%</span>
                <span className="lu-tile__l">надёжность</span>
              </div>
            </div>

            <ListSection label="Позиции">
              {p.primaryPos && <ListItem title="Основная" trailing={<PositionBadge code={p.primaryPos} />} />}
              {p.fallbackPos.length > 0 && (
                <ListItem
                  title="Запасные"
                  trailing={
                    <span className="lu-row" style={{ gap: 6 }}>
                      {p.fallbackPos.map((code) => (
                        <PositionBadge key={code} code={code} />
                      ))}
                    </span>
                  }
                />
              )}
            </ListSection>

            <Button block variant="secondary" leadingIcon={<I.UserPlus width={18} height={18} />} onClick={invite}>
              Позвать в игру
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
