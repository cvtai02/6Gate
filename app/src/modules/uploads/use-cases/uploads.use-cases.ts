import { Injectable } from "@nestjs/common";
@Injectable()
export class UploadsUseCases {
  saveTempFile(file: Express.Multer.File) {
    return { path: file.path };
  }
}
