import { Injectable, OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { groupUploadSettings, groups } from "@/server/db/schema";
import { DispatchNextQueuedGroupUploadUseCase } from "./dispatch-next-queued-group-upload.usecase";
import {
  DEFAULT_UPLOAD_TIME_IN_DAY,
  groupSettingClaimWhere,
  localDateKey,
  localTimeKey,
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
      const settings = await getDb().select().from(groupUploadSettings).all();
      for (const setting of settings) {
        if (setting.lastTriggeredDate === today || nowTime < setting.uploadTimeInDay) continue;

        const now = new Date().toISOString();
        const claimed = await getDb()
          .update(groupUploadSettings)
          .set({ lastTriggeredDate: today, updatedAt: now })
          .where(groupSettingClaimWhere(setting.groupId, setting.updatedAt))
          .returning()
          .get();
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
    const allGroups = await db.select().from(groups).all();
    for (const group of allGroups) {
      const existing = await db
        .select({ groupId: groupUploadSettings.groupId })
        .from(groupUploadSettings)
        .where(eq(groupUploadSettings.groupId, group.id))
        .get();
      if (existing) continue;
      const now = new Date().toISOString();
      await db.insert(groupUploadSettings).values({
        groupId: group.id,
        uploadTimeInDay: DEFAULT_UPLOAD_TIME_IN_DAY,
        lastTriggeredDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
