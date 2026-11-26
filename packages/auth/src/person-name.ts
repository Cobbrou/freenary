const WHITESPACE = /\s+/gu;

export interface PersonName {
  firstName: string;
  lastName: string | null;
}

type Text = string | null | undefined;

const cleanedText = (value: Text): string =>
  (value ?? "").replaceAll(WHITESPACE, " ").trim();

export const splitFullName = (fullName: Text): PersonName => {
  const cleaned = cleanedText(fullName);
  const firstSpace = cleaned.indexOf(" ");

  return firstSpace === -1
    ? { firstName: cleaned, lastName: null }
    : {
        firstName: cleaned.slice(0, firstSpace),
        lastName: cleaned.slice(firstSpace + 1),
      };
};

export const fullNameOf = ({ firstName, lastName }: PersonName): string =>
  lastName ? `${firstName} ${lastName}`.trim() : firstName;

interface NamedProfile {
  family_name?: Text;
  given_name?: Text;
  name?: Text;
}

export const personNameOfProfile = (profile: NamedProfile): PersonName => {
  const given = cleanedText(profile.given_name);

  if (given.length === 0) {
    return splitFullName(profile.name);
  }

  const family = cleanedText(profile.family_name);

  return { firstName: given, lastName: family.length > 0 ? family : null };
};

export const betterAuthUserOf = (profile: NamedProfile) => {
  const { firstName, lastName } = personNameOfProfile(profile);

  return { lastName, name: firstName };
};
