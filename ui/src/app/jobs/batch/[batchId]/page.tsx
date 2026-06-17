import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerApiClient } from "@/lib/api-client";
import { ProcessFlow } from "./process-flow";

export const dynamic = "force-dynamic";

type BatchJob = {
  id: string;
  platform: string;
  status: string;
  title: string | null;
  caption: string | null;
  videoPath: string;
  providerPostId: string | null;
  providerPostUrl: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  uploadBatchId: string | null;
  groupId: string | null;
  groupName: string | null;
  destinationName: string | null;
  destinationType: string | null;
  destinationAvatar: string | null;
  accountName: string | null;
  accountAvatar: string | null;
  providerType: string | null;
};

type NotificationChannel = {
  id: string;
  chatId: string;
  chatName: string | null;
  botName: string | null;
};

type BatchDetail = {
  batchId: string;
  title: string | null;
  groupId: string | null;
  groupName: string | null;
  videoPath: string;
  createdAt: string;
  jobs: BatchJob[];
  notificationChannels: NotificationChannel[];
};

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  let batch: BatchDetail | null = null;
  try {
    batch = await createServerApiClient().get<BatchDetail>(
      `/post-jobs/batch/${batchId}`,
    );
  } catch {
    notFound();
  }
  if (!batch) notFound();

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        ← Jobs
      </Link>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">
          {batch.title ?? "Untitled"}
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          {batch.groupName && (
            <Link
              href={`/groups/${batch.groupId}`}
              className="text-indigo-400/80 hover:text-indigo-300"
            >
              {batch.groupName}
            </Link>
          )}
          <span>·</span>
          <span>{batch.jobs.length} destinations</span>
          <span>·</span>
          <span className="font-mono">
            {new Date(batch.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <ProcessFlow batch={batch} />
    </div>
  );
}
