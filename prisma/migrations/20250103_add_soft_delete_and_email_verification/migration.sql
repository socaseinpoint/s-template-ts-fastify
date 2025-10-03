-- Add soft delete and email verification fields to User
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Add soft delete to Item
ALTER TABLE "Item" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create indexes for better performance
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");

