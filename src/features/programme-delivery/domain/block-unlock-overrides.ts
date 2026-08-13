export type EnrolmentBlockUnlock = {
  id: string;
  apprenticeProgrammeId: string;
  spineItemId: string;
  unlockedBy: string | null;
  unlockedByName: string;
  unlockedAt: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateEnrolmentBlockUnlockInput = {
  apprenticeProgrammeId: string;
  spineItemId: string;
  unlockedBy: string | null;
  unlockedByName: string;
  reason: string;
};
