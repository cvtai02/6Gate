import { Injectable, OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings, groups } from "@/server/db/schema";
import { DispatchNextQueuedGroupUploadUseCase } from "./dispatch-next-queued-group-upload.usecase";
import {
  DEFAULT_UPLOAD_TIMES,
  groupSettingClaimWhere,
  localDateKey,
  localTimeKey,
  makeLastTriggeredSlot,
  parseLastTriggeredSlot,
  parseUploadTimes,
} from "../shared/group-helpers";

type GroupQueueSchedulerState = {
  intervalId: ReturnType<typeof setInterval> | null;
  running: boolean;
};

const _global = globalThis as unknown as { __6gate_groupQueueSchedulerState?: GroupQueueSchedulerState };
const schedulerState =
  _global.__6gate_groupQueueSchedulerState ??
  (_global.__6gate_groupQueueSchedulerState = { intervalId: null, running: false });

@Injectable()
export class ProcessDueGroupQueuesUseCase implements OnModuleInit {
  constructor(private readonly dispatchNextQueuedUpload: DispatchNextQueuedGroupUploadUseCase) {}

  onModuleInit() {
    this.startScheduler();
  }

  async execute() {
    if (schedulerState.running) return;
    schedulerState.running = true;
    try {
      await this.bootstrapMissingUploadSettings();
      const today = localDateKey();
      const nowTime = localTimeKey();
      const settings = await getDb().select().from(groupUploadSettings);

      for (const setting of settings) {
        const sortedSlots = parseUploadTimes(setting.uploadTimeInDay).sort();
        const lastSlot = parseLastTriggeredSlot(setting.lastTriggeredDate);

        // Find the earliest due slot that hasn't been triggered yet today
        let dueSlot: string | null = null;
        for (const slot of sortedSlots) {
          if (nowTime < slot) break; // slots are sorted; everything after is also in the future

          const alreadyTriggeredToday =
            lastSlot !== null &&
            lastSlot.date === today &&
            slot <= lastSlot.slot;

          if (alreadyTriggeredToday) continue;
          dueSlot = slot;
          break;
        }

        if (!dueSlot) continue;

        const now = new Date().toISOString();
        const claimed = await getDb()
          .update(groupUploadSettings)
          .set({ lastTriggeredDate: makeLastTriggeredSlot(today, dueSlot), updatedAt: now })
          .where(groupSettingClaimWhere(setting.groupId, setting.updatedAt))
          .returning()
          .then((r) => r[0]);

        if (!claimed) continue;
        await this.dispatchNextQueuedUpload.execute(setting.groupId).catch(() => undefined);
      }
    } finally {
      schedulerState.running = false;
    }
  }

  private startScheduler() {
    if (schedulerState.intervalId) return;
    schedulerState.intervalId = setInterval(() => void this.execute(), 30000);
    void this.execute();
  }

  private async bootstrapMissingUploadSettings() {
    const db = getDb();
    const allGroups = await db.select().from(groups);
    for (const group of allGroups) {
      const existing = await db
        .select({ groupId: groupUploadSettings.groupId })
        .from(groupUploadSettings)
        .where(eq(groupUploadSettings.groupId, group.id))
        .then((r) => r[0]);
      if (existing) continue;
      const now = new Date().toISOString();
      await db.insert(groupUploadSettings).values({
        groupId: group.id,
        uploadTimeInDay: DEFAULT_UPLOAD_TIMES,
        lastTriggeredDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
