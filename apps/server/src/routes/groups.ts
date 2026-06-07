import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { groupSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { db } from "../db/client.js";
import { groupMembers, groups, users } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { publicUser } from "../lib/serialize.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

async function loadGroup(id: number) {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, id) });
  if (!group) throw new HTTPException(404, { message: "Группа не найдена" });
  return group;
}

/** Internal audiences — organizer-only; players never see these. */
export const groupRoutes = new Hono<AuthEnv>()
  .use(authRequired)
  .use(roleRequired("organizer"))

  .get("/", async (c) => {
    const list = await db.query.groups.findMany({ orderBy: [groups.name] });
    const memberships = await db.query.groupMembers.findMany();
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    return c.json(
      list.map((g) => ({
        id: g.id,
        name: g.name,
        members: memberships
          .filter((m) => m.groupId === g.id && byId.has(m.userId))
          .map((m) => publicUser(byId.get(m.userId)!)),
      })),
    );
  })

  .post("/", zValidator("json", groupSchema), async (c) => {
    const me = c.get("user");
    const { name } = c.req.valid("json");
    const [created] = await db.insert(groups).values({ name }).returning();
    await audit(me.id, "group", name, "создана группа");
    return c.json({ id: created!.id, name: created!.name }, 201);
  })

  .patch("/:id", idParam, zValidator("json", groupSchema), async (c) => {
    const group = await loadGroup(c.req.valid("param").id);
    await db.update(groups).set({ name: c.req.valid("json").name }).where(eq(groups.id, group.id));
    return c.json({ ok: true });
  })

  /** Hard delete: stale ids inside games.visibleTo simply never match again. */
  .delete("/:id", idParam, async (c) => {
    const me = c.get("user");
    const group = await loadGroup(c.req.valid("param").id);
    await db.delete(groupMembers).where(eq(groupMembers.groupId, group.id));
    await db.delete(groups).where(eq(groups.id, group.id));
    await audit(me.id, "group", group.name, "группа удалена");
    return c.json({ ok: true });
  })

  .post("/:id/members", idParam, zValidator("json", z.object({ userId: z.number().int().positive() })), async (c) => {
    const group = await loadGroup(c.req.valid("param").id);
    const { userId } = c.req.valid("json");
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new HTTPException(404, { message: "Игрок не найден" });
    const existing = await db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
    });
    if (existing) throw new HTTPException(409, { message: "Игрок уже в группе" });
    await db.insert(groupMembers).values({ groupId: group.id, userId });
    return c.json({ ok: true }, 201);
  })

  .delete(
    "/:id/members/:userId",
    zValidator("param", z.object({ id: z.coerce.number().int().positive(), userId: z.coerce.number().int().positive() })),
    async (c) => {
      const { id, userId } = c.req.valid("param");
      const group = await loadGroup(id);
      await db.delete(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)));
      return c.json({ ok: true });
    },
  );
