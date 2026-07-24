import type {
  BoardQuery,
  LifecycleBoardDto,
  LearnerWorkspaceDto,
  SessionUser,
} from "../types";

/**
 * Ports — permanent contracts.
 * Standalone and future portal adapters implement these.
 * Feature UI must depend on ports only, never on Prisma/Auth.js directly.
 */

export interface AuthPort {
  getSessionUser(): Promise<SessionUser | null>;
}

export interface LearnerLifecycleDataPort {
  getLifecycleBoard(query: BoardQuery): Promise<LifecycleBoardDto>;
  getLearnerWorkspace(learnerId: string): Promise<LearnerWorkspaceDto | null>;
}

export type LearnerLifecyclePorts = {
  auth: AuthPort;
  data: LearnerLifecycleDataPort;
};
