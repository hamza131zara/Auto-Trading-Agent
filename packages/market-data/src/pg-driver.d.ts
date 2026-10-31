declare module "pg" {
  export class Pool {
    constructor(config: Record<string, unknown>);
    query<Row extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      parameters?: readonly unknown[]
    ): Promise<{ rows: Row[] }>;
    connect(): Promise<{
      query<Row extends Record<string, unknown> = Record<string, unknown>>(
        sql: string,
        parameters?: readonly unknown[]
      ): Promise<{ rows: Row[] }>;
      release(): void;
    }>;
    end(): Promise<void>;
    on(event: "error", listener: (error: Error) => void): this;
    readonly waitingCount: number;
    readonly totalCount: number;
    readonly idleCount: number;
  }
}
