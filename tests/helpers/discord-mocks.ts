/**
 * Discord.js Mock 工廠
 *
 * 提供各種 Discord.js 物件的 Mock 實作，
 * 讓測試可以專注於業務邏輯而非 Discord API 互動。
 *
 * 使用方式：
 * ```typescript
 * const user = createMockUser({ id: '123', username: 'TestUser' });
 * const interaction = createMockButtonInteraction({ userId: '123' });
 * ```
 */

import { vi } from 'vitest';
import { Collection } from 'discord.js';
import type {
  Client,
  Guild,
  User,
  TextChannel,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  GuildMember,
  Role,
  ThreadChannel,
  Message,
  CategoryChannel,
  PermissionOverwriteManager,
} from 'discord.js';

// ============================================
// User Mock
// ============================================

export interface MockUserOptions {
  id?: string;
  username?: string;
  globalName?: string;
  tag?: string;
  bot?: boolean;
  displayAvatarURL?: string;
}

export function createMockUser(options: MockUserOptions = {}): User {
  const id = options.id ?? '123456789012345678';
  const username = options.username ?? 'TestUser';

  return {
    id,
    username,
    globalName: options.globalName ?? username,
    tag: options.tag ?? `${username}#0000`,
    bot: options.bot ?? false,
    displayAvatarURL: vi
      .fn()
      .mockReturnValue(
        options.displayAvatarURL ??
          'https://cdn.discordapp.com/embed/avatars/0.png'
      ),
    send: vi.fn().mockResolvedValue({ id: `dm-message-${Date.now()}` }),
    toString: vi.fn().mockReturnValue(`<@${id}>`),
    fetch: vi.fn().mockImplementation(async function (this: User) {
      return this;
    }),
  } as unknown as User;
}

// ============================================
// Guild Mock
// ============================================

export interface MockGuildOptions {
  id?: string;
  name?: string;
  iconURL?: string;
  ownerId?: string;
}

export function createMockGuild(options: MockGuildOptions = {}): Guild {
  const id = options.id ?? '987654321098765432';
  const mockChannels = new Map<string, TextChannel>();

  const guild = {
    id,
    name: options.name ?? 'Test Guild',
    ownerId: options.ownerId ?? '123456789012345678',
    iconURL: vi.fn().mockReturnValue(options.iconURL ?? null),
    channels: {
      create: vi.fn().mockImplementation(async (opts: { name: string }) => {
        const channel = createMockTextChannel({
          id: `channel-${Date.now()}`,
          name: opts.name,
          guildId: id,
        });
        mockChannels.set(channel.id, channel);
        return channel;
      }),
      fetch: vi
        .fn()
        .mockImplementation(
          async (channelId: string) => mockChannels.get(channelId) ?? null
        ),
      cache: new Collection<string, TextChannel>(),
    },
    roles: {
      everyone: { id },
      fetch: vi.fn().mockResolvedValue(new Collection()),
      cache: new Collection<string, Role>(),
    },
    members: {
      fetch: vi.fn().mockImplementation(async (memberId: string) => {
        return createMockGuildMember({ id: memberId });
      }),
      cache: new Collection<string, GuildMember>(),
    },
    fetchOwner: vi.fn().mockImplementation(async () => {
      return createMockGuildMember({ id: options.ownerId });
    }),
  } as unknown as Guild;

  return guild;
}

// ============================================
// TextChannel Mock
// ============================================

export interface MockTextChannelOptions {
  id?: string;
  name?: string;
  guildId?: string;
  parentId?: string;
}

export function createMockTextChannel(
  options: MockTextChannelOptions = {}
): TextChannel {
  const id = options.id ?? `channel-${Date.now()}`;
  const guildId = options.guildId ?? '987654321098765432';
  const mockGuild = createMockGuild({ id: guildId });

  return {
    id,
    name: options.name ?? 'test-channel',
    guild: mockGuild,
    guildId,
    parentId: options.parentId ?? null,
    type: 0, // ChannelType.GuildText
    send: vi.fn().mockResolvedValue(createMockMessage({ channelId: id })),
    delete: vi.fn().mockResolvedValue(undefined),
    setParent: vi.fn().mockResolvedValue(undefined),
    setName: vi.fn().mockResolvedValue(undefined),
    permissionOverwrites: {
      edit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      cache: new Collection(),
    } as unknown as PermissionOverwriteManager,
    messages: {
      fetch: vi.fn().mockResolvedValue(new Collection()),
    },
    isTextBased: vi.fn().mockReturnValue(true),
    toString: vi.fn().mockReturnValue(`<#${id}>`),
    // Flag for instanceof checks with mocked TextChannel
    _isMockTextChannel: true,
  } as unknown as TextChannel;
}

// ============================================
// CategoryChannel Mock
// ============================================

export interface MockCategoryChannelOptions {
  id?: string;
  name?: string;
  guildId?: string;
}

export function createMockCategoryChannel(
  options: MockCategoryChannelOptions = {}
): CategoryChannel {
  const id = options.id ?? `category-${Date.now()}`;

  return {
    id,
    name: options.name ?? 'Test Category',
    guildId: options.guildId ?? '987654321098765432',
    type: 4, // ChannelType.GuildCategory
  } as unknown as CategoryChannel;
}

// ============================================
// GuildMember Mock
// ============================================

export interface MockGuildMemberOptions {
  id?: string;
  user?: User;
  roles?: string[];
  nickname?: string;
  permissions?: bigint;
}

export function createMockGuildMember(
  options: MockGuildMemberOptions = {}
): GuildMember {
  const id = options.id ?? '123456789012345678';
  const roleIds = new Set(options.roles ?? []);
  const user = options.user ?? createMockUser({ id });

  return {
    id,
    user,
    nickname: options.nickname ?? null,
    displayName: options.nickname ?? user.username,
    roles: {
      cache: {
        has: vi.fn().mockImplementation((roleId: string) => roleIds.has(roleId)),
        get: vi.fn(),
        map: vi.fn().mockReturnValue([...roleIds]),
      },
    },
    permissions: {
      has: vi.fn().mockReturnValue(true),
      bitfield: options.permissions ?? BigInt(0),
    },
    kick: vi.fn().mockResolvedValue(undefined),
    ban: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({ id: `member-dm-${Date.now()}` }),
    toString: vi.fn().mockReturnValue(`<@${id}>`),
  } as unknown as GuildMember;
}

// ============================================
// Message Mock
// ============================================

export interface MockMessageOptions {
  id?: string;
  content?: string;
  channelId?: string;
  authorId?: string;
}

export function createMockMessage(options: MockMessageOptions = {}): Message {
  const id = options.id ?? `message-${Date.now()}`;
  const authorId = options.authorId ?? '123456789012345678';

  // 使用簡單物件避免循環依賴
  const simpleAuthor = {
    id: authorId,
    username: 'MessageAuthor',
    tag: 'MessageAuthor#0000',
    bot: false,
    displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discordapp.com/embed/avatars/0.png'),
    toString: vi.fn().mockReturnValue(`<@${authorId}>`),
  };

  return {
    id,
    content: options.content ?? '',
    channelId: options.channelId ?? 'channel-123456789',
    author: simpleAuthor,
    edit: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ id: `reply-${Date.now()}` }),
    react: vi.fn().mockResolvedValue(undefined),
  } as unknown as Message;
}

// ============================================
// ButtonInteraction Mock
// ============================================

export interface MockButtonInteractionOptions {
  userId?: string;
  guildId?: string;
  channelId?: string;
  customId?: string;
  deferred?: boolean;
  replied?: boolean;
  memberRoles?: string[];
}

export function createMockButtonInteraction(
  options: MockButtonInteractionOptions = {}
): ButtonInteraction {
  const userId = options.userId ?? '123456789012345678';
  const guildId = options.guildId ?? '987654321098765432';
  const channelId = options.channelId ?? 'channel-123456789';

  const user = createMockUser({ id: userId });
  const guild = createMockGuild({ id: guildId });
  const channel = createMockTextChannel({ id: channelId, guildId });
  const member = createMockGuildMember({
    id: userId,
    user,
    roles: options.memberRoles,
  });

  return {
    user,
    member,
    guild,
    guildId,
    channel,
    channelId,
    customId: options.customId ?? 'test_button',
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    inGuild: vi.fn().mockReturnValue(!!guildId),
    inCachedGuild: vi.fn().mockReturnValue(!!guildId),
    isRepliable: vi.fn().mockReturnValue(true),
    isButton: vi.fn().mockReturnValue(true),
    deferReply: vi.fn().mockImplementation(async function () {
      (this as any).deferred = true;
      return undefined;
    }),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockImplementation(async function () {
      (this as any).replied = true;
      return undefined;
    }),
    editReply: vi.fn().mockResolvedValue(createMockMessage()),
    followUp: vi.fn().mockResolvedValue(createMockMessage()),
    update: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    message: createMockMessage(),
  } as unknown as ButtonInteraction;
}

// ============================================
// ModalSubmitInteraction Mock
// ============================================

export interface MockModalSubmitInteractionOptions
  extends MockButtonInteractionOptions {
  fields?: Record<string, string>;
}

export function createMockModalSubmitInteraction(
  options: MockModalSubmitInteractionOptions = {}
): ModalSubmitInteraction {
  const baseInteraction = createMockButtonInteraction(options);
  const fieldValues = options.fields ?? {};

  return {
    ...baseInteraction,
    isModalSubmit: vi.fn().mockReturnValue(true),
    fields: {
      getTextInputValue: vi
        .fn()
        .mockImplementation((fieldId: string) => fieldValues[fieldId] ?? ''),
      getField: vi.fn().mockImplementation((fieldId: string) => ({
        value: fieldValues[fieldId] ?? '',
        customId: fieldId,
      })),
    },
  } as unknown as ModalSubmitInteraction;
}

// ============================================
// ChatInputCommandInteraction Mock
// ============================================

export interface MockCommandInteractionOptions
  extends MockButtonInteractionOptions {
  commandName?: string;
  options?: Record<string, any>;
}

export function createMockCommandInteraction(
  options: MockCommandInteractionOptions = {}
): ChatInputCommandInteraction {
  const baseInteraction = createMockButtonInteraction(options);
  const optionValues = options.options ?? {};

  return {
    ...baseInteraction,
    commandName: options.commandName ?? 'test-command',
    isChatInputCommand: vi.fn().mockReturnValue(true),
    options: {
      getString: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getInteger: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getBoolean: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getUser: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getChannel: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getRole: vi
        .fn()
        .mockImplementation((name: string) => optionValues[name] ?? null),
      getSubcommand: vi.fn().mockReturnValue(optionValues['subcommand'] ?? null),
      getSubcommandGroup: vi
        .fn()
        .mockReturnValue(optionValues['subcommandGroup'] ?? null),
    },
  } as unknown as ChatInputCommandInteraction;
}

// ============================================
// StringSelectMenuInteraction Mock
// ============================================

export interface MockStringSelectMenuInteractionOptions
  extends MockButtonInteractionOptions {
  values?: string[];
}

export function createMockStringSelectMenuInteraction(
  options: MockStringSelectMenuInteractionOptions = {}
): StringSelectMenuInteraction {
  const baseInteraction = createMockButtonInteraction(options);
  const values = options.values ?? [];

  return {
    ...baseInteraction,
    values,
    isStringSelectMenu: vi.fn().mockReturnValue(true),
  } as unknown as StringSelectMenuInteraction;
}

// ============================================
// ThreadChannel Mock
// ============================================

export interface MockThreadChannelOptions {
  id?: string;
  guildId?: string;
  ownerId?: string;
  name?: string;
  parentId?: string;
}

export function createMockThreadChannel(
  options: MockThreadChannelOptions = {}
): ThreadChannel {
  const id = options.id ?? `thread-${Date.now()}`;
  const guildId = options.guildId ?? '987654321098765432';

  return {
    id,
    guildId,
    guild: createMockGuild({ id: guildId }),
    ownerId: options.ownerId ?? '123456789012345678',
    name: options.name ?? 'test-thread',
    parentId: options.parentId ?? 'channel-parent',
    type: 11, // ChannelType.PublicThread
    isThread: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(createMockMessage()),
    messages: {
      fetch: vi.fn().mockResolvedValue(new Collection()),
    },
    members: {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    setName: vi.fn().mockResolvedValue(undefined),
    setArchived: vi.fn().mockResolvedValue(undefined),
    setLocked: vi.fn().mockResolvedValue(undefined),
    toString: vi.fn().mockReturnValue(`<#${id}>`),
  } as unknown as ThreadChannel;
}

// ============================================
// Client Mock
// ============================================

export interface MockClientOptions {
  userId?: string;
}

export function createMockClient(options: MockClientOptions = {}): Client {
  const userId = options.userId ?? 'bot-123456789';

  return {
    user: createMockUser({ id: userId, username: 'TestBot', bot: true }),
    ws: {
      ping: 42,
    },
    users: {
      fetch: vi
        .fn()
        .mockImplementation(async (id: string) => createMockUser({ id })),
      cache: new Collection<string, User>(),
    },
    channels: {
      fetch: vi.fn().mockImplementation(async (id: string) => {
        return createMockTextChannel({ id });
      }),
      cache: new Collection(),
    },
    guilds: {
      fetch: vi.fn().mockImplementation(async (id: string) => {
        return createMockGuild({ id });
      }),
      cache: new Collection<string, Guild>(),
    },
    isReady: vi.fn().mockReturnValue(true),
    login: vi.fn().mockResolvedValue('token'),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as unknown as Client;
}

// ============================================
// 匯出所有工廠函數
// ============================================

export const discordMocks = {
  createMockUser,
  createMockGuild,
  createMockTextChannel,
  createMockCategoryChannel,
  createMockGuildMember,
  createMockMessage,
  createMockButtonInteraction,
  createMockModalSubmitInteraction,
  createMockCommandInteraction,
  createMockStringSelectMenuInteraction,
  createMockThreadChannel,
  createMockClient,
};
