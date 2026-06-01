const colors: Record<string, string> = {
  Created:           "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Initializing:      "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
  Uploading:         "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
  Finishing:         "bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse",
  Processing:        "bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse",
  Published:         "bg-green-500/20 text-green-400 border-green-500/30",
  Failed:            "bg-red-500/20 text-red-400 border-red-500/30",
  Retrying:          "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse",
  ReconnectRequired: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Cancelled:         "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const labels: Record<string, string> = {
  ReconnectRequired: "Reconnect",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
