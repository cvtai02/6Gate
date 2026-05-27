import { uploadVideoToDestinationGroup } from "@/server/publishing";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const body = await req.json();
  const { videoPath, title, caption, privacy } = body;

  if (!videoPath) {
    return Response.json({ error: "videoPath is required" }, { status: 400 });
  }

  try {
    const results = await uploadVideoToDestinationGroup(groupId, {
      videoPath,
      title,
      caption,
      privacy,
    });
    return Response.json({ groupId, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
