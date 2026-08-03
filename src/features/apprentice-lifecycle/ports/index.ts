import type {
  BoardQuery,
  LifecycleBoardDto,
  ApprenticeWorkspaceDto,
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

export interface ApprenticeLifecycleDataPort {
  getLifecycleBoard(query: BoardQuery): Promise<LifecycleBoardDto>;
  getApprenticeWorkspace(apprenticeId: string): Promise<ApprenticeWorkspaceDto | null>;
}

export type ApprenticeLifecyclePorts = {
  auth: AuthPort;
  data: ApprenticeLifecycleDataPort;
};
