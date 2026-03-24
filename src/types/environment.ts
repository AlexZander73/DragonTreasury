export const SCENE_THEMES = ['cave', 'castle', 'mountain', 'forest', 'ocean', 'treasury'] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

export const SCENE_THEME_LABELS: Record<SceneTheme, string> = {
  cave: 'Dragon Cave',
  castle: 'Castle Vault',
  mountain: 'Mountain Summit',
  forest: 'Ancient Forest',
  ocean: 'Sunken Treasury',
  treasury: 'Royal Treasury',
};

export const BGM_TRACKS = ['scene', 'off', 'embersong', 'courtyard', 'wilds', 'abyssal'] as const;
export type BgmTrack = (typeof BGM_TRACKS)[number];

export const BGM_TRACK_LABELS: Record<BgmTrack, string> = {
  scene: 'Scene Theme (Auto)',
  off: 'No music',
  embersong: 'Embersong',
  courtyard: 'Castle Courtyard',
  wilds: 'Winds of the Wilds',
  abyssal: 'Abyssal Hymn',
};
