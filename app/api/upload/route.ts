import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { getCurrentPrincipal } from "@/lib/session";
import { newId } from "@/lib/db";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// POST /api/upload  (multipart/form-data, field "file") -> { url }
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = (path.extname(file.name) || ".jpg").toLowerCase().replace(/[^.\w]/g, "");
  const filename = `${newId("photo")}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
