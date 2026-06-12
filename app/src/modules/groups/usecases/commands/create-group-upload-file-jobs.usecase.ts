import { Injectable } from "@nestjs/common";
import { CreateGroupUploadJobsUseCase } from "./create-group-upload-jobs.usecase";
import type { UploadedFileMetadataDto } from "../../dtos/uploaded-file-metadata.dto";

@Injectable()
export class CreateGroupUploadFileJobsUseCase {
  constructor(private readonly createGroupUploadJobs: CreateGroupUploadJobsUseCase) {}

  async execute(groupId: string, filePath: string, input: UploadedFileMetadataDto, baseUrl: string) {
    return this.createGroupUploadJobs.executeFromLocalFile(groupId, filePath, input, baseUrl);
  }
}
