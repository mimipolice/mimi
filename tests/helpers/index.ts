/**
 * 測試輔助工具匯出
 *
 * 使用方式：
 * ```typescript
 * import {
 *   createMockUser,
 *   createMockKysely,
 *   createMockRedisClient,
 * } from '@tests/helpers';
 * ```
 */

// Discord.js Mocks
export {
  createMockUser,
  createMockGuild,
  createMockTextChannel,
  createMockCategoryChannel,
  createMockGuildMember,
  createMockMessage,
  createMockButtonInteraction,
  createMockModalSubmitInteraction,
  createMockCommandInteraction,
  createMockThreadChannel,
  createMockClient,
  discordMocks,
  type MockUserOptions,
  type MockGuildOptions,
  type MockTextChannelOptions,
  type MockCategoryChannelOptions,
  type MockGuildMemberOptions,
  type MockMessageOptions,
  type MockButtonInteractionOptions,
  type MockModalSubmitInteractionOptions,
  type MockCommandInteractionOptions,
  type MockThreadChannelOptions,
  type MockClientOptions,
} from './discord-mocks.js';

// Kysely Mocks
export {
  createMockQueryBuilder,
  createMockKysely,
  setupRepositoryMocks,
  setupQueryError,
  createPostgresError,
  PG_ERROR_CODES,
  kyselyMocks,
  type MockQueryBuilder,
  type MockKyselyInstance,
  type RepositoryMockSetup,
} from './kysely-mocks.js';

// Redis Mocks
export {
  createMockRedisClient,
  createFailingRedisClient,
  nullRedisClient,
  redisMocks,
  type MockRedisClient,
} from './redis-mocks.js';
