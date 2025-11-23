# Keyword Command - Components v2 Migration

## Issue
The `/keyword list` command was throwing an error:
```
DiscordAPIError[50035]: Invalid Form Body
content[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length.
```

This occurred when the keyword list exceeded 2000 characters in a single text message.

## Solution
Migrated the keyword list display to Discord Components v2, which provides:
- Better visual organization with containers and sections
- Character limit handling through chunking
- Enhanced UI with separators and accent colors
- Support for much larger content (4000 chars total across all TextDisplayBuilders)

## Implementation Details

### Components Used
1. **ContainerBuilder**: Main wrapper with accent color (#5865F2)
2. **TextDisplayBuilder**: For headers and content blocks
3. **SectionBuilder**: Groups related keyword information
4. **SeparatorBuilder**: Visual dividers between sections

### Key Features
- **Grouped by Type**: Keywords are organized into "🎯 Exact Match" and "🔍 Contains" categories
- **Chunking**: Keywords are split into groups of 4 to prevent character overflow
- **Truncation**: Long replies (>80 chars) are automatically truncated with "..."
- **Visual Hierarchy**: Uses markdown headers, separators with spacing, and dividers

### Code Structure
```typescript
const container = new ContainerBuilder()
  .setAccentColor(0x5865F2);

// Header
container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent('# Title\n*Summary*')
);

// Separator
container.addSeparatorComponents(
  new SeparatorBuilder()
    .setSpacing(SeparatorSpacingSize.Small)
    .setDivider(true)
);

// Content sections
container.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Content')
    )
);

// Send with Components v2 flag
await interaction.editReply({
  components: [container],
  flags: [MessageFlags.IsComponentsV2]
});
```

## Benefits
1. **No Character Limit Errors**: Properly handles large keyword lists
2. **Better UX**: Clean, organized layout with visual separators
3. **Scalable**: Can handle up to 40 components (Discord limit)
4. **Modern**: Uses latest Discord Components v2 API

## Testing Recommendations
- Test with 0 keywords (empty state)
- Test with 1-5 keywords (small list)
- Test with 20+ keywords (chunking behavior)
- Test with very long keyword replies (truncation)
- Test with mixed exact/contains types
