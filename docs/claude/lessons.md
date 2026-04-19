# Lessons Learned

- **This project uses shadcn v4 `base-nova` style with `@base-ui/react` primitives — NOT `@radix-ui/react-*`**: When adding new shadcn components, use `npx shadcn@latest add <component>` — do NOT manually import from `@radix-ui`. The `base-nova` style uses `@base-ui/react` instead of Radix. `toast` is replaced by `sonner`. Check `components.json` for the source of truth on style configuration.
