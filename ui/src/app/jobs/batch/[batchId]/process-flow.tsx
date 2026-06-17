"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDestinationIconPath } from "@/lib/destination-icons";
import { DEST_TYPE_LABEL } from "@/lib/destination-types";

const STATUS_COLOR: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  Created:      { border: "border-yellow-500/40", bg: "bg-yellow-500/5",  text: "text-yellow-400", dot: "bg-yellow-400" },
  Uploading:    { border: "border-blue-500/40",   bg: "bg-blue-500/5",    text: "text-blue-400",   dot: "bg-blue-400 animate-pulse" },
  Processing:   { border: "border-indigo-500/40", bg: "bg-indigo-500/5",  text: "text-indigo-400", dot: "bg-indigo-400 animate-pulse" },
  Published:    { border: "border-green-500/40",  bg: "bg-green-500/5",   text: "text-green-400",  dot: "bg-green-400" },
  Failed:       { border: "border-red-500/40",    bg: "bg-red-500/5",     text: "text-red-400",    dot: "bg-red-400" },
  Cancelled:    { border: "border-gray-500/40",   bg: "bg-gray-500/5",    text: "text-gray-400",   dot: "bg-gray-400" },
};

const DEFAULT_COLOR = { border: "border-gray-500/40", bg: "bg-gray-500/5", text: "text-gray-400", dot: "bg-gray-400" };

type BatchJob = {
  id: string;
  platform: string;
  status: string;
  title: string | null;
  providerPostUrl: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
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

type Batch = {
  batchId: string;
  title: string | null;
  videoPath: string;
  createdAt: string;
  jobs: BatchJob[];
  notificationChannels?: NotificationChannel[];
};

function DestinationNode({ job }: { job: BatchJob }) {
  const router = useRouter();
  const color = STATUS_COLOR[job.status] ?? DEFAULT_COLOR;
  const icon = getDestinationIconPath(job.destinationType, job.providerType);
  const isScheduled = job.status === "Created" && job.scheduledAt;

  return (
    <div
      className={`rounded-xl border-2 ${color.border} ${color.bg} p-4 w-72 cursor-pointer hover:brightness-110 transition-all`}
      onClick={() => router.push(`/jobs/${job.id}`)}
    >
      <div className="flex items-center gap-3 mb-3">
        {(job.destinationAvatar ?? job.accountAvatar) ? (
          <img
            src={(job.destinationAvatar ?? job.accountAvatar)!}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0 bg-gray-700"
          />
        ) : icon ? (
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 p-1.5">
            <img src={icon} alt="" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-400 uppercase">
            {(job.destinationName ?? job.platform).slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {job.destinationName ?? job.platform}
          </div>
          <div className="text-[10px] text-gray-500">
            {job.destinationType
              ? (DEST_TYPE_LABEL[job.destinationType] ?? job.destinationType)
              : job.platform}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
          <span className={`text-[11px] font-medium ${color.text}`}>
            {isScheduled ? "Scheduled" : job.status}
          </span>
        </div>
        {job.providerPostUrl && (
          <a
            href={job.providerPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-400/70 hover:text-green-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            View Post ↗
          </a>
        )}
      </div>

      {job.errorMessage && (
        <div className="mt-2 text-[10px] text-red-400/70 truncate" title={job.errorMessage}>
          {job.errorMessage}
        </div>
      )}
    </div>
  );
}

function NotificationNode({ channels, allDone, anyFailed }: { channels: NotificationChannel[]; allDone: boolean; anyFailed: boolean }) {
  const status = !allDone ? "Pending" : "Sent";
  const color = !allDone
    ? { border: "border-gray-500/40", bg: "bg-gray-500/5", text: "text-gray-400", dot: "bg-gray-400" }
    : anyFailed
      ? { border: "border-yellow-500/40", bg: "bg-yellow-500/5", text: "text-yellow-400", dot: "bg-yellow-400" }
      : { border: "border-sky-500/40", bg: "bg-sky-500/5", text: "text-sky-400", dot: "bg-sky-400" };

  return (
    <div className={`rounded-xl border-2 ${color.border} ${color.bg} p-5 w-72 shrink-0`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Notification</div>
          <div className="text-[10px] text-gray-500">Telegram</div>
        </div>
      </div>
      <div className="space-y-1">
        {channels.map((ch) => (
          <div key={ch.id} className="flex items-center gap-1.5 text-xs text-gray-400">
            <img src="/icons/telegram.svg" alt="" className="w-3 h-3 opacity-60" />
            <span className="truncate">{ch.chatName || ch.chatId}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
        <span className={`text-[11px] font-medium ${color.text}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

export function ProcessFlow({ batch }: { batch: Batch }) {
  const destRefs = useRef<(HTMLDivElement | null)[]>([]);
  const notifyRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; color: string; dashed: boolean }[]>([]);
  const [svgHeight, setSvgHeight] = useState(0);

  const channels = batch.notificationChannels ?? [];
  const hasNotify = channels.length > 0;
  const allDone = batch.jobs.every((j) => ["Published", "Failed", "Cancelled"].includes(j.status));
  const anyFailed = batch.jobs.some((j) => j.status === "Failed");

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const containerRect = container.getBoundingClientRect();
    const newPaths: typeof paths = [];
    let maxBottom = 0;

    if (hasNotify && notifyRef.current) {
      const notifyRect = notifyRef.current.getBoundingClientRect();
      const notifyX = notifyRect.left - containerRect.left;
      const notifyY = notifyRect.top + notifyRect.height / 2 - containerRect.top;
      maxBottom = Math.max(maxBottom, notifyRect.bottom - containerRect.top);

      destRefs.current.forEach((el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const destRightX = r.right - containerRect.left;
        const destY = r.top + r.height / 2 - containerRect.top;
        maxBottom = Math.max(maxBottom, r.bottom - containerRect.top);

        const color = allDone ? "#0ea5e9" : "#4b5563";
        const midX = (destRightX + notifyX) / 2;
        newPaths.push({
          d: `M ${destRightX} ${destY} C ${midX} ${destY}, ${midX} ${notifyY}, ${notifyX} ${notifyY}`,
          color,
          dashed: !allDone,
        });
      });
    } else {
      destRefs.current.forEach((el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        maxBottom = Math.max(maxBottom, r.bottom - containerRect.top);
      });
    }

    setSvgHeight(maxBottom);
    setPaths(newPaths);
  }, [batch.jobs, hasNotify, allDone]);

  return (
    <div ref={containerRef} className="relative flex items-start gap-16">
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height={svgHeight || "100%"}
        style={{ overflow: "visible" }}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.color}
            strokeWidth="2"
            fill="none"
            strokeDasharray={p.dashed ? "6 4" : undefined}
            opacity={0.5}
          />
        ))}
      </svg>

      {/* Destination nodes */}
      <div className="flex flex-col gap-4 z-10">
        {batch.jobs.map((job, i) => (
          <div key={job.id} ref={(el) => { destRefs.current[i] = el; }}>
            <DestinationNode job={job} />
          </div>
        ))}
      </div>

      {/* Notification node */}
      {hasNotify && (
        <div className="flex flex-col justify-center self-center z-10" ref={notifyRef}>
          <NotificationNode channels={channels} allDone={allDone} anyFailed={anyFailed} />
        </div>
      )}
    </div>
  );
}
