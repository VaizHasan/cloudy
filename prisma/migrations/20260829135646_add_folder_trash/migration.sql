-- CreateIndex
CREATE INDEX "Folder_ownerId_isDeleted_idx" ON "Folder"("ownerId", "isDeleted");
