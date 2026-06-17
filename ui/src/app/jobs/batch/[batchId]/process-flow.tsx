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

type Batch = {
  batchId: string;
  title: string | null;
  videoPath: string;
  createdAt: string;
  jobs: BatchJob[];
};

function UploadNode({ batch }: { batch: Batch }) {
  const allDone = batch.jobs.every((j) => ["Published", "Failed", "Cancelled"].includes(j.status));
  const anyUploading = batch.jobs.some((j) => ["Uploading", "Processing", "Initializing"].includes(j.status));
  const status = anyUploading ? "Uploading" : allDone ? "Published" : "Created";
  const color = STATUS_COLOR[status] ?? DEFAULT_COLOR;
  const fileName = batch.videoPath.split(/[/\\]/).pop() ?? batch.videoPath;

  return (
    <div className={`rounded-xl border-2 ${color.border} ${color.bg} p-5 w-72 shrink-0`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Upload Video</div>
          <div className="text-[10px] text-gray-500">Source file</div>
        </div>
      </div>
      <div className="text-xs text-gray-400 truncate font-mono" title={batch.videoPath}>
        {fileName}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
        <span className={`text-[11px] font-medium ${color.text}`}>
          {anyUploading ? "In Progress" : allDone ? "Completed" : "Queued"}
        </span>
      </div>
    </div>
  );
}

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

export function ProcessFlow({ batch }: { batch: Batch }) {
  const uploadRef = useRef<HTMLDivElement>(null);
  const destRefs = useRef<(HTMLDivElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; color: string; dashed: boolean }[]>([]);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const upload = uploadRef.current;
    const svg = svgRef.current;
    if (!container || !upload || !svg) return;

    const containerRect = container.getBoundingClientRect();
    const uploadRect = upload.getBoundingClientRect();
    const srcX = uploadRect.right - containerRect.left;
    const srcY = uploadRect.top + uploadRect.height / 2 - containerRect.top;

    const newPaths: typeof paths = [];
    let maxBottom = 0;

    destRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dstX = r.left - containerRect.left;
      const dstY = r.top + r.height / 2 - containerRect.top;
      maxBottom = Math.max(maxBottom, r.bottom - containerRect.top);

      const job = batch.jobs[i];
      const color =
        job.status === "Published" ? "#22c55e" :
        job.status === "Failed" ? "#ef4444" :
        job.status === "Uploading" ? "#3b82f6" :
        "#4b5563";
      const midX = (srcX + dstX) / 2;
      newPaths.push({
        d: `M ${srcX} ${srcY} C ${midX} ${srcY}, ${midX} ${dstY}, ${dstX} ${dstY}`,
        color,
        dashed: ["Created", "Cancelled"].includes(job.status),
      });
    });

    setSvgHeight(Math.max(maxBottom, uploadRect.bottom - containerRect.top));
    setPaths(newPaths);
  }, [batch.jobs]);

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

      {/* Upload source node */}
      <div className="flex flex-col justify-center self-center z-10" ref={uploadRef}>
        <UploadNode batch={batch} />
      </div>

      {/* Destination nodes */}
      <div className="flex flex-col gap-4 z-10">
        {batch.jobs.map((job, i) => (
          <div key={job.id} ref={(el) => { destRefs.current[i] = el; }}>
            <DestinationNode job={job} />
          </div>
        ))}
      </div>
    </div>
  );
}
