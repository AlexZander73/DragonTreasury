export const DRAGON_COLOR_THEMES = ['ember', 'verdant', 'sapphire', 'amethyst', 'obsidian'] as const;

export type DragonColorTheme = (typeof DRAGON_COLOR_THEMES)[number];

export const DRAGON_COLOR_THEME_LABELS: Record<DragonColorTheme, string> = {
  ember: 'Ember Wyrm',
  verdant: 'Verdant Drake',
  sapphire: 'Sapphire Drake',
  amethyst: 'Amethyst Drake',
  obsidian: 'Obsidian Drake',
};
