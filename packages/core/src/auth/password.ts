import argon2 from "argon2";

const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and 128 characters`);
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    throw new Error("Password must contain letters and numbers");
  }
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  assertPasswordPolicy(password);
  return argon2.hash(`${password}\u0000${pepper}`, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string, pepper: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, `${password}\u0000${pepper}`);
  } catch {
    return false;
  }
}
