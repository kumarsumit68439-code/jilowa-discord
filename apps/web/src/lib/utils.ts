import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function userTag(u: { username: string; discriminator: string }) {
  return `${u.username}#${u.discriminator}`;
}

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
