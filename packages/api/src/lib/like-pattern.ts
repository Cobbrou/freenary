const LIKE_SPECIAL_CHARACTERS = /[\\%_]/gu;

export const escapeLikePattern = (text: string) =>
  text.replaceAll(LIKE_SPECIAL_CHARACTERS, String.raw`\$&`);
