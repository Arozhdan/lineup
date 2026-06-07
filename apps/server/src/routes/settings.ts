import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { settingsPatchSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { env } from "../env.js";
import { audit } from "../lib/audit.js";
import { buildSpd, looksLikeIban } from "../lib/spd.js";

export async function loadSettings() {
  const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!cfg) throw new HTTPException(500, { message: "Настройки не инициализированы" });
  return cfg;
}

export const settingsRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Platform settings. Readable by everyone (pay screen needs QR + currency). */
  .get("/", async (c) => c.json(await loadSettings()))

  .patch("/", roleRequired("owner"), zValidator("json", settingsPatchSchema), async (c) => {
    const me = c.get("user");
    const patch = c.req.valid("json");
    await db.update(settings).set(patch).where(eq(settings.id, 1));
    await audit(me.id, "settings", Object.keys(patch).join(", "), "настройки платформы");
    return c.json(await loadSettings());
  })

  /** Upload a bank-provided QR image (png/jpg/webp). */
  .post("/qr/upload", roleRequired("owner"), async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Файл не передан" });
    if (file.size > 5 * 1024 * 1024) throw new HTTPException(400, { message: "Файл больше 5 МБ" });
    const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[file.type];
    if (!ext) throw new HTTPException(400, { message: "Поддерживаются PNG, JPG и WebP" });
    fs.mkdirSync(env.uploadDir, { recursive: true });
    const name = `qr-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(env.uploadDir, name), Buffer.from(await file.arrayBuffer()));
    await db.update(settings).set({ qrImage: `/uploads/${name}` }).where(eq(settings.id, 1));
    return c.json({ qrImage: `/uploads/${name}` });
  })

  /** Generate a QR Platba (Czech SPD standard) from the saved IBAN.
      Scannable by Česká spořitelna and every other CZ banking app. */
  .post("/qr/generate", roleRequired("owner"), async (c) => {
    const cfg = await loadSettings();
    if (!looksLikeIban(cfg.qrAccount)) {
      throw new HTTPException(400, {
        message: "Для QR Platba укажи IBAN (например CZ65 0800 …). Либо загрузи готовый QR из банка.",
      });
    }
    const payload = buildSpd({
      iban: cfg.qrAccount,
      recipient: cfg.qrRecipient || cfg.name,
      currency: cfg.currency,
      message: cfg.qrNote.replace("{название}", "").replace("·", "").trim() || cfg.name,
    });
    fs.mkdirSync(env.uploadDir, { recursive: true });
    const name = `qr-${Date.now()}.png`;
    await QRCode.toFile(path.join(env.uploadDir, name), payload, { width: 512, margin: 2 });
    await db.update(settings).set({ qrImage: `/uploads/${name}` }).where(eq(settings.id, 1));
    return c.json({ qrImage: `/uploads/${name}` });
  });
