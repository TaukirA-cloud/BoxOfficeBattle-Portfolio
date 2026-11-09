export const rewardRules = [
  { id: 'newcomer', kind: 'title', name: 'Movie newcomer', level: 1 },
  { id: 'gold', kind: 'theme', name: 'Premiere gold', color: '#eac77a', level: 1 },
  { id: 'regular', kind: 'title', name: 'Cinema regular', level: 2 },
  { id: 'mint', kind: 'theme', name: 'Mint screening', color: '#9cdec4', level: 3 },
  { id: 'expert', kind: 'title', name: 'Box office expert', level: 5 },
  { id: 'violet', kind: 'theme', name: 'Midnight violet', color: '#c6b4ff', level: 7 },
  { id: 'legend', kind: 'title', name: 'Cinema legend', level: 10 },
  { id: 'debut-title', kind: 'title', name: 'Opening night star', achievement: 'debut' },
  {
    id: 'streak-theme',
    kind: 'theme',
    name: 'Royal blue',
    color: '#9bc9ff',
    achievement: 'ten',
  },
  {
    id: 'critic-title',
    kind: 'title',
    name: 'Resident film critic',
    achievement: 'critic',
  },
  {
    id: 'daily-theme',
    kind: 'theme',
    name: 'Sunset screening',
    color: '#ffb79c',
    achievement: 'daily',
  },
  { id: 'perfect-title', kind: 'title', name: 'Perfect picture', achievement: 'perfect' },
];

export function playerRewards(stats, equipped = {}) {
  const rewards = rewardRules.map((rule) => {
    const achievement = stats.achievements.find((a) => a.id === rule.achievement);
    return {
      ...rule,
      unlocked: rule.level ? stats.level >= rule.level : Boolean(achievement?.unlocked),
      requirement: rule.level ? `Reach level ${rule.level}` : achievement?.description,
      progress: rule.level
        ? Math.min(stats.level, rule.level)
        : achievement?.progress || 0,
      target: rule.level || achievement?.target || 1,
    };
  });
  const selection = {};
  for (const kind of ['title', 'theme'])
    selection[kind] =
      rewards.find((r) => r.kind === kind && r.id === equipped[kind] && r.unlocked) ||
      rewards.find((r) => r.kind === kind && r.unlocked);
  return { rewards, equipped: selection };
}
