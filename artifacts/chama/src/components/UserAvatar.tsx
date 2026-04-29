import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function isEmoji(str: string) {
  if (!str) return false;
  const emojiRegex = /^\p{Emoji}/u;
  return emojiRegex.test(str.trim());
}

interface UserAvatarProps {
  name: string;
  avatar?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  sidebarStyle?: boolean;
}

const sizeMap = {
  xs: { outer: "w-6 h-6", text: "text-[10px]", emoji: "text-xs" },
  sm: { outer: "w-7 h-7", text: "text-xs", emoji: "text-sm" },
  md: { outer: "w-9 h-9", text: "text-sm", emoji: "text-base" },
  lg: { outer: "w-12 h-12", text: "text-base", emoji: "text-xl" },
  xl: { outer: "w-20 h-20", text: "text-2xl", emoji: "text-4xl" },
};

export function UserAvatar({ name, avatar, size = "md", className, sidebarStyle }: UserAvatarProps) {
  const sz = sizeMap[size];
  const hasEmoji = avatar && isEmoji(avatar);
  const colorClass = colorForName(name);

  if (hasEmoji) {
    return (
      <div
        className={cn(
          sz.outer,
          "rounded-full flex items-center justify-center shrink-0 select-none",
          sidebarStyle ? "bg-sidebar-primary/20" : "bg-muted",
          sz.emoji,
          className
        )}
      >
        {avatar}
      </div>
    );
  }

  return (
    <div
      className={cn(
        sz.outer,
        "rounded-full flex items-center justify-center shrink-0 font-semibold select-none",
        sidebarStyle ? "bg-sidebar-primary/20 text-sidebar-primary" : colorClass,
        sz.text,
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export const EMOJI_PICKER_OPTIONS = [
  "😀","😎","🤩","🥳","🌟","✨","🔥","💫","🎉","🎊",
  "🌈","🦋","🌸","🌺","🍀","🌻","🦁","🐯","🦊","🐼",
  "🐨","🦄","🐸","🦋","🐬","🦅","🌙","⭐","💎","🚀",
  "🎸","🎵","🎨","🏆","💪","🙌","👑","❤️","💜","💙",
  "💚","💛","🧡","❤️‍🔥","💝","🫶","🤜","✌️","🤟","🤙",
];
