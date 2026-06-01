import { Controller, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { tmpdir } from "os";
import { extname } from "path";
import { nanoid } from "nanoid";
import { diskStorage } from "multer";
import { UploadsUseCases } from "../use-cases/uploads.use-cases";

@Controller("videos")
export class UploadsController {
  constructor(private readonly uploads: UploadsUseCases) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
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
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Res({ passthrough: true }) res: Response) {
    if (!file) {
      res.status(400);
      return { error: "No file provided" };
    }
    return this.uploads.saveTempFile(file);
  }
}
