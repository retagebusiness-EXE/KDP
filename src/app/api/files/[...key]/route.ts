import { NextResponse } from "next/server";
import { getFileStorage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth/guard";

function contentTypeFor(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { key } = await params;
  const joined = key.join("/");
  // Exported files are stored under `<userId>/...`; this keeps users from
  // guessing another user's export path even though keys aren't secret.
  if (!joined.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const storage = getFileStorage();
  const data = await storage.get(joined);
  if (!data) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(joined),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
