export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  APP_NAME: string;
  ENVIRONMENT: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
}
