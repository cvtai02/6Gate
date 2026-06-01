import { Module } from "@nestjs/common";
import { GroupsController } from "./api/groups.controller";
import { GroupsUseCases } from "./use-cases/groups.use-cases";

@Module({
  controllers: [GroupsController],
  providers: [GroupsUseCases],
})
export class GroupsModule {}
