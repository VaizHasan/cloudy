/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,parentId,name]` on the table `Folder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Folder_ownerId_parentId_name_key" ON "Folder"("ownerId", "parentId", "name");
