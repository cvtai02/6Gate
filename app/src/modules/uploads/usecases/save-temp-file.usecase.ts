import { Injectable } from "@nestjs/common";
import type { UploadTempFileDto } from "../dtos/upload-temp-file.dto";

@Injectable()
export class SaveTempFileUseCase {
  execute(file: Express.Multer.File): UploadTempFileDto {
    return { path: file.path };
  }
}
