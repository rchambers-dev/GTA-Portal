declare module "pg" {
  export class Pool {
    constructor(config: { connectionString: string; max?: number });
    connect(): Promise<{
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
      release: () => void;
    }>;
    end(): Promise<void>;
  }
}
