interface NamedUser {
  lastName?: string | null;
  name: string;
}

export const firstNameOf = (user: NamedUser | null | undefined): string =>
  user?.name ?? "";

export const fullNameOf = (
  user: NamedUser | null | undefined
): string | undefined => {
  if (!user) {
    return undefined;
  }

  return user.lastName ? `${user.name} ${user.lastName}` : user.name;
};
