export type OrbitAccountAction =
  | "sign-in"
  | "sign-up"
  | "verify"
  | "recover"
  | "recover-verify"
  | "update-password"
  | "update-email";
export interface OrbitAccountInput {
  action: OrbitAccountAction;
  email?: string;
  password?: string;
  displayName?: string;
  code?: string;
}
export type OrbitAccountResult =
  | { ok: true; status: "signed-in" | "check-email" | "updated" }
  | {
      ok: false;
      error:
        | "not-configured"
        | "invalid-input"
        | "auth"
        | "network"
        | "secure-storage";
    };
export interface OrbitAccountAPI {
  getOrbitAccountStatus(): Promise<{ configured: boolean }>;
  submitOrbitAccount(input: OrbitAccountInput): Promise<OrbitAccountResult>;
  onOrbitAuthRequest(callback: (page: string) => void): () => void;
}
