export interface ProfileAvatar {
  id: string;
  label: string;
  src: string;
}

const AVATAR_DEFINITIONS: Array<[string, string]> = [
  ['miyoro', 'Miyoro'],
  ['blackcat', 'Black Cat'],
  ['kitsune', 'Kitsune'],
  ['fox', 'Fox'],
  ['panda', 'Panda'],
  ['bunny', 'Bunny'],
  ['bear', 'Bear'],
  ['frog', 'Frog'],
  ['penguin', 'Penguin'],
  ['octopus', 'Octopus'],
  ['alien', 'Alien'],
  ['robot', 'Robot'],
  ['ninja', 'Ninja'],
  ['vampire', 'Vampire'],
  ['oni', 'Oni'],
  ['ghost', 'Ghost'],
  ['kawaii', 'Kawaii'],
  ['blush', 'Blush'],
  ['grumpy', 'Grumpy'],
  ['sad', 'Moody'],
  ['boba', 'Boba'],
  ['ramen', 'Ramen'],
  ['sushi', 'Sushi'],
  ['onigiri', 'Onigiri'],
  ['dango', 'Dango'],
  ['pizza', 'Pizza'],
  ['popcorn', 'Popcorn'],
  ['sakura', 'Sakura'],
  ['rose', 'Rose'],
  ['cactus', 'Cactus'],
  ['mushroom', 'Mushroom'],
  ['star', 'Star'],
  ['moon', 'Moon'],
  ['sun', 'Sun'],
  ['cloud', 'Cloud'],
  ['heart', 'Heart'],
  ['gamepad', 'Gamer'],
  ['phones', 'Headphones'],
  ['amber', 'Amber'],
  ['mint', 'Mint'],
  ['sky', 'Sky'],
  ['teal', 'Teal'],
  ['violet', 'Violet'],
  ['sunset', 'Sunset'],
  ['slate', 'Slate'],
  ['paper', 'Paper'],
];

export const PROFILE_AVATARS: ProfileAvatar[] = AVATAR_DEFINITIONS.map(([id, label]) => ({
  id,
  label,
  src: `/avatars/${id}.svg`,
}));

export const VALID_AVATAR_IDS = new Set<string>(PROFILE_AVATARS.map((a) => a.id));

export function isValidAvatarId(id: unknown): id is string {
  return typeof id === 'string' && VALID_AVATAR_IDS.has(id);
}

export function getAvatarSrc(id: string): string {
  return `/avatars/${isValidAvatarId(id) ? id : 'miyoro'}.svg`;
}

export function getRandomAvatarId(excludeId?: string | null): string {
  const pool = excludeId
    ? PROFILE_AVATARS.filter((a) => a.id !== excludeId)
    : PROFILE_AVATARS;
  const pickFrom = pool.length > 0 ? pool : PROFILE_AVATARS;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)].id;
}
