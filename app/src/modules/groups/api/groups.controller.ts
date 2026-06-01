import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { tmpdir } from "os";
import { extname } from "path";
import { nanoid } from "nanoid";
import { diskStorage } from "multer";
import { GroupsUseCases } from "../use-cases/groups.use-cases";

function requestBaseUrl(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function statusFromError(err: unknown) {
  const status = (err as Error & { status?: number })?.status;
  return typeof status === "number" ? status : 400;
}

@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsUseCases) {}

  @Get(["groups", "combos"])
  list() {
    return this.groups.list();
  }

  @Post(["groups", "combos"])
  async create(@Body() body: { name?: string }, @Res({ passthrough: true }) res: Response) {
    try {
      res.status(201);
      return await this.groups.create(body);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Patch(["groups/:id", "combos/:id"])
  async rename(@Param("id") id: string, @Body() body: { name?: string }, @Res({ passthrough: true }) res: Response) {
    try {
      const updated = await this.groups.rename(id, body);
      if (!updated) {
        res.status(404);
        return { error: "Not found" };
      }
      return updated;
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Delete(["groups/:id", "combos/:id"])
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.groups.remove(id);
  }

  @Post(["groups/:id/destinations", "combos/:id/destinations"])
  async addDestination(
    @Param("id") id: string,
    @Body() body: { destinationId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      res.status(201);
      return await this.groups.addDestination(id, body.destinationId);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Delete(["groups/:id/destinations/:destinationId", "combos/:id/destinations/:destinationId"])
  @HttpCode(204)
  removeDestination(@Param("id") id: string, @Param("destinationId") destinationId: string) {
    return this.groups.removeDestination(id, destinationId);
  }

  @Get(["groups/:id/history", "combos/:id/history"])
  history(@Param("id") id: string, @Query("limit") limit: string | undefined, @Req() req: Request) {
    return this.groups.history(id, Number(limit ?? 100), requestBaseUrl(req));
  }

  @Post(["groups/:id/upload-by-path", "combos/:id/upload-by-path"])
  async uploadByPath(
    @Param("id") id: string,
    @Body()
    body: { videoPath?: string; title?: string; caption?: string; privacy?: string; scheduledAt?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.groups.createUploadJobs(id, body, requestBaseUrl(req));
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Post(["groups/:id/upload", "combos/:id/upload"])
  @UseInterceptors(
    FileInterceptor("video", {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || "") || ".mp4";
          cb(null, `6gate_${nanoid(8)}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { title?: string; caption?: string; privacy?: string; scheduledAt?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) {
      res.status(400);
      return { error: "video file is required" };
    }

    const videoPath = file.path;

    try {
      return await this.groups.createUploadJobs(id, { ...body, videoPath }, requestBaseUrl(req));
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
