/**
 * Test Suite: Challenger M2 Empirical Adversarial Stress & Boundary Test Suite
 * Milestone 2: Team Credential Vault & Shared Secrets Management
 *
 * Requirements & Stress Verifications:
 * 1. Plan gating rejection: store/reveal/index on Community or Pro returns HTTP 403 UPGRADE_REQUIRED.
 * 2. Unauthorized reveal rejection: developer/viewer calling reveal returns HTTP 403 UNAUTHORIZED_REVEAL.
 * 3. Duplicate credential name in same scope returns HTTP 422 DUPLICATE_CREDENTIAL_NAME.
 * 4. Non-existent credential deletion/reveal returns 404.
 * 5. Role permissions matrix: viewer cannot store/delete/reveal, developer can store but cannot reveal/delete, admin/owner have full access.
 * 6. Massive payloads (64KB RSA keys), high entropy Unicode, symbols, multi-tenant isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  CredentialVaultSimulator,
  type WorkspaceCredential,
} from '../Harness/commercial_simulators.ts';

describe('Challenger M2: Team Credential Vault Empirical Adversarial & Boundary Suite', () => {
  let env: any;
  let teamVault: CredentialVaultSimulator;
  let enterpriseVault: CredentialVaultSimulator;
  let proVault: CredentialVaultSimulator;
  let communityVault: CredentialVaultSimulator;

  beforeEach(() => {
    env = setupTestEnvironment();
    teamVault = new CredentialVaultSimulator('team');
    enterpriseVault = new CredentialVaultSimulator('enterprise');
    proVault = new CredentialVaultSimulator('pro');
    communityVault = new CredentialVaultSimulator('community');
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // 1. PLAN GATING VERIFICATIONS (HTTP 403 UPGRADE_REQUIRED)
  // ============================================================================
  describe('1. Plan Gating Enforcement', () => {
    it('[CH_M2_PLAN_01] Community plan rejects storeCredential with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = communityVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Community Blocked Secret',
        secret_value: 'sk-proj-blocked-key-12345',
      });

      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('[CH_M2_PLAN_02] Pro plan rejects storeCredential with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = proVault.storeCredential('owner', {
        provider: 'anthropic',
        name: 'Pro Blocked Secret',
        secret_value: 'sk-ant-blocked-key-67890',
      });

      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('[CH_M2_PLAN_03] Community plan rejects getCredentials with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = communityVault.getCredentials('owner');
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('[CH_M2_PLAN_04] Pro plan rejects getCredentials with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = proVault.getCredentials('owner');
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('[CH_M2_PLAN_05] Community plan rejects revealCredential with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = communityVault.revealCredential('owner', 1);
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.secret_value).toBeUndefined();
    });

    it('[CH_M2_PLAN_06] Pro plan rejects revealCredential with HTTP 403 UPGRADE_REQUIRED', () => {
      const res = proVault.revealCredential('owner', 1);
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.secret_value).toBeUndefined();
    });

    it('[CH_M2_PLAN_07] Team and Enterprise plans successfully permit credential vault access', () => {
      const teamRes = teamVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Team Gemini Key',
        secret_value: 'AIzaSyD-team-key-valid',
      });
      expect(teamRes.status).toBe(201);
      expect(teamRes.data?.name).toBe('Team Gemini Key');

      const entRes = enterpriseVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Enterprise Gemini Key',
        secret_value: 'AIzaSyD-enterprise-key-valid',
      });
      expect(entRes.status).toBe(201);
      expect(entRes.data?.name).toBe('Enterprise Gemini Key');
    });
  });

  // ============================================================================
  // 2. UNAUTHORIZED REVEAL & RBAC MATRIX (HTTP 403 UNAUTHORIZED_REVEAL / ACTION)
  // ============================================================================
  describe('2. RBAC & Unauthorized Action Enforcement', () => {
    let createdSecretId: number;

    beforeEach(() => {
      const storeRes = teamVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Master Prod API Key',
        secret_value: 'sk-proj-master-secret-token-999',
      });
      createdSecretId = storeRes.data!.id;
    });

    it('[CH_M2_RBAC_01] Developer calling reveal returns HTTP 403 UNAUTHORIZED_REVEAL', () => {
      const res = teamVault.revealCredential('developer', createdSecretId);
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UNAUTHORIZED_REVEAL');
      expect(res.secret_value).toBeUndefined();
    });

    it('[CH_M2_RBAC_02] Viewer calling reveal returns HTTP 403 UNAUTHORIZED_REVEAL', () => {
      const res = teamVault.revealCredential('viewer', createdSecretId);
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UNAUTHORIZED_REVEAL');
      expect(res.secret_value).toBeUndefined();
    });

    it('[CH_M2_RBAC_03] Owner calling reveal returns HTTP 200 with plaintext secret', () => {
      const res = teamVault.revealCredential('owner', createdSecretId);
      expect(res.status).toBe(200);
      expect(res.secret_value).toBe('sk-proj-master-secret-token-999');
    });

    it('[CH_M2_RBAC_04] Admin calling reveal returns HTTP 200 with plaintext secret', () => {
      const res = teamVault.revealCredential('admin', createdSecretId);
      expect(res.status).toBe(200);
      expect(res.secret_value).toBe('sk-proj-master-secret-token-999');
    });

    it('[CH_M2_RBAC_05] Viewer calling store returns HTTP 403 UNAUTHORIZED_ACTION', () => {
      const res = teamVault.storeCredential('viewer', {
        provider: 'custom',
        name: 'Viewer Injected Key',
        secret_value: 'illegal_token',
      });
      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UNAUTHORIZED_ACTION');
    });

    it('[CH_M2_RBAC_06] Developer can store credentials (HTTP 201)', () => {
      const res = teamVault.storeCredential('developer', {
        provider: 'github',
        name: 'Dev Deployment Token',
        secret_value: 'ghp_dev_deployment_token_123',
      });
      expect(res.status).toBe(201);
      expect(res.data?.name).toBe('Dev Deployment Token');
    });

    it('[CH_M2_RBAC_07] Developer calling delete returns HTTP 403', () => {
      const res = teamVault.deleteCredential('developer', createdSecretId);
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
    });

    it('[CH_M2_RBAC_08] Viewer calling delete returns HTTP 403', () => {
      const res = teamVault.deleteCredential('viewer', createdSecretId);
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
    });

    it('[CH_M2_RBAC_09] Owner and Admin can delete credentials (HTTP 200)', () => {
      const adminDel = teamVault.deleteCredential('admin', createdSecretId);
      expect(adminDel.status).toBe(200);
      expect(adminDel.success).toBe(true);

      // Recreate and test owner delete
      const reStore = teamVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Owner Del Test',
        secret_value: 'val_123',
      });
      const ownerDel = teamVault.deleteCredential('owner', reStore.data!.id);
      expect(ownerDel.status).toBe(200);
      expect(ownerDel.success).toBe(true);
    });
  });

  // ============================================================================
  // 3. DUPLICATE CREDENTIAL NAME IN SAME SCOPE (HTTP 422 DUPLICATE_CREDENTIAL_NAME)
  // ============================================================================
  describe('3. Duplicate Name Collision Handling', () => {
    beforeEach(() => {
      teamVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Production OpenAI Key',
        secret_value: 'sk-proj-initial-1',
        project_id: null,
      });
      teamVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Project Alpha Key',
        secret_value: 'AIzaSyD-alpha-1',
        project_id: 10,
      });
    });

    it('[CH_M2_DUP_01] Storing duplicate credential name in workspace-wide scope returns HTTP 422 DUPLICATE_CREDENTIAL_NAME', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'anthropic',
        name: 'Production OpenAI Key',
        secret_value: 'sk-ant-another-val',
        project_id: null,
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('DUPLICATE_CREDENTIAL_NAME');
      expect(res.error).toContain('already exists in this scope');
    });

    it('[CH_M2_DUP_02] Duplicate check is case-insensitive and trims whitespace', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'custom',
        name: '   production openai key   ',
        secret_value: 'custom_val',
        project_id: null,
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('DUPLICATE_CREDENTIAL_NAME');
    });

    it('[CH_M2_DUP_03] Same credential name in DIFFERENT project scope is ALLOWED', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Project Alpha Key',
        secret_value: 'AIzaSyD-beta-diff-proj',
        project_id: 20, // Different project from project 10
      });

      expect(res.status).toBe(201);
      expect(res.data?.name).toBe('Project Alpha Key');
      expect(res.data?.project_id).toBe(20);
    });

    it('[CH_M2_DUP_04] Same credential name in SAME project scope returns HTTP 422 DUPLICATE_CREDENTIAL_NAME', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Project Alpha Key',
        secret_value: 'AIzaSyD-alpha-duplicate',
        project_id: 10, // Same project 10
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('DUPLICATE_CREDENTIAL_NAME');
    });
  });

  // ============================================================================
  // 4. NON-EXISTENT ENTITY & BOUNDARY NOT FOUND CHECKS (HTTP 404)
  // ============================================================================
  describe('4. Non-Existent Entity & Boundary Handling', () => {
    it('[CH_M2_BOUND_01] Deleting non-existent credential ID returns HTTP 404', () => {
      const res = teamVault.deleteCredential('owner', 999999);
      expect(res.status).toBe(404);
      expect(res.success).toBe(false);
    });

    it('[CH_M2_BOUND_02] Revealing non-existent credential ID returns HTTP 404', () => {
      const res = teamVault.revealCredential('owner', 999999);
      expect(res.status).toBe(404);
      expect(res.error_code).toBe('NOT_FOUND');
    });

    it('[CH_M2_BOUND_03] Empty secret value returns HTTP 422 VALIDATION_ERROR', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Empty Secret Test',
        secret_value: '   ',
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('VALIDATION_ERROR');
    });

    it('[CH_M2_BOUND_04] Empty credential name returns HTTP 422 VALIDATION_ERROR', () => {
      const res = teamVault.storeCredential('owner', {
        provider: 'openai',
        name: '   ',
        secret_value: 'sk-proj-valid-value',
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // 5. STRESS & FUZZING: MASSIVE PAYLOADS, HIGH-ENTROPY UNICODE, RAPID CONCURRENCY
  // ============================================================================
  describe('5. High Entropy, Payload Stress & Cryptographic Invariants', () => {
    it('[CH_M2_STRESS_01] Storing and revealing 64KB multi-line RSA certificate payload preserves byte integrity', () => {
      const lineChunk = 'MIIEpAIBAAKCAQEA0Y5Qk9W4+Z3Lqj7X8K...randomBase64ChunkHere==\n';
      const massivePayload = '-----BEGIN RSA PRIVATE KEY-----\n' + lineChunk.repeat(1000) + '-----END RSA PRIVATE KEY-----';

      const storeRes = teamVault.storeCredential('owner', {
        provider: 'custom',
        name: 'Cluster Root CA Key',
        secret_value: massivePayload,
      });

      expect(storeRes.status).toBe(201);
      expect(storeRes.data?.masked_value).toBeDefined();
      expect(storeRes.data?.fingerprint).toMatch(/^sha256_/);

      const revealRes = teamVault.revealCredential('owner', storeRes.data!.id);
      expect(revealRes.status).toBe(200);
      expect(revealRes.secret_value).toBe(massivePayload);
      expect(revealRes.secret_value?.length).toBe(massivePayload.length);
    });

    it('[CH_M2_STRESS_02] Preserves high-entropy strings, emojis, unicode, JSON stringified configs', () => {
      const complexSecret = JSON.stringify({
        apiKey: 'sk-ant-api-🔑✨🚀-Vietnamese-KhóaBảoMật-MaCàTưng-2026',
        endpoint: 'https://api.internal.ai/v1?token=$$%^&*()__++~`',
        nullByteBypassAttempt: 'prefix\0suffix',
        crlf: 'line1\r\nline2\r\nline3',
      });

      const storeRes = teamVault.storeCredential('owner', {
        provider: 'custom',
        name: 'Complex JSON Config Secret',
        secret_value: complexSecret,
      });

      expect(storeRes.status).toBe(201);
      const revealRes = teamVault.revealCredential('admin', storeRes.data!.id);
      expect(revealRes.status).toBe(200);
      expect(revealRes.secret_value).toBe(complexSecret);
    });

    it('[CH_M2_STRESS_03] Masked value never leaks raw secret in index/listing', () => {
      const rawSecret = 'SUPER_SENSITIVE_SECRET_TOKEN_DO_NOT_LEAK_IN_LIST';
      teamVault.storeCredential('owner', {
        provider: 'openai',
        name: 'Leak Test Key',
        secret_value: rawSecret,
      });

      const listRes = teamVault.getCredentials('developer');
      expect(listRes.status).toBe(200);
      const item = listRes.data!.find((c) => c.name === 'Leak Test Key')!;
      expect(item).toBeDefined();
      expect(item.masked_value).not.toContain(rawSecret);
      expect(JSON.stringify(listRes.data)).not.toContain(rawSecret);
    });

    it('[CH_M2_STRESS_04] Rapid repeated reveal calls maintain idempotence and integrity', () => {
      const storeRes = teamVault.storeCredential('owner', {
        provider: 'gemini',
        name: 'Rapid Reveal Key',
        secret_value: 'AIzaSyD-rapid-test-12345',
      });
      const id = storeRes.data!.id;

      for (let i = 0; i < 50; i++) {
        const res = teamVault.revealCredential('owner', id);
        expect(res.status).toBe(200);
        expect(res.secret_value).toBe('AIzaSyD-rapid-test-12345');
      }
    });
  });
});
