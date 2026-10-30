# Repository Guidelines

## Project Structure & Module Organization
This is an Astro blog site. Source code lives under `src/`, with content in `src/content/post/` and `src/content/page/`, shared layouts in `src/layouts/`, UI components in `src/components/`, and route files in `src/pages/`. Site-wide configuration is in `src/site.config.ts`, content schemas in `src/content.config.ts`, and shared styling in `src/styles/global.css`. Static files go in `public/`, and generated output is written to `dist/`.

## Build, Test, and Development Commands
- `pnpm dev`: start the local Astro dev server with HMR.
- `pnpm build`: run `astro check`, then build the site and generate Pagefind search indexes.
- `pnpm preview`: preview the production build locally.
- `pnpm lint`: run Biome linting across the repo.
- `pnpm format`: format code with Biome and Prettier.
- `pnpm check`: run Astro type/content checks only.

## Coding Style & Naming Conventions
Use tabs for indentation, 100-character lines, and semicolons in JavaScript/TypeScript files. Biome handles formatting and import organization; prefer `pnpm format` or `pnpm run format:imports` instead of manual reordering. Keep filenames descriptive and route-oriented: Astro pages use path-based names like `src/pages/posts/[...slug].astro`, and content files should use lowercase, hyphenated slugs such as `src/content/post/my-post.mdx`.

## Testing Guidelines
There is no dedicated unit test suite in this repository. Validation is done through `pnpm check` and `pnpm build`, which catch schema, type, and integration issues. Before opening a PR, run both commands and verify the site in `pnpm preview` if you changed rendering, routes, or content collections.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages such as `Add XML rendering support` and `Remove intermediary frames for XML and HTML figures`. Keep commits focused and descriptive. Pull requests should include a clear summary, note any content or config changes, and add screenshots or build notes when UI output changes. Link related issues when applicable.

## Configuration Notes
Personal settings belong in `src/site.config.ts`. Update site metadata, profile links, comments, and analytics there. For deployment or base-path changes, prefer the existing `BASE_PATH` handling and Netlify/Astro config rather than hardcoding paths.
