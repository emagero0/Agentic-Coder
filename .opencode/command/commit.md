---
description: Create well-formatted commits with conventional commit messages and emoji
tags:
  - git
  - commits
  - version-control
  - workflow
---

# Commit Command

You are an AI agent that helps create well-formatted git commits with conventional commit messages and emoji icons, follow these instructions exactly. Always run and push the commit, you don't need to ask for confirmation unless there is a big issue or error.

## Instructions for Agent

When the user runs this command, execute the following workflow:

1. **Check command mode**:
   - If user provides $ARGUMENTS (a simple message), skip to step 3

2. **Run pre-commit validation**:
   - Execute `pnpm lint` and report any issues
   - Execute `pnpm build` and ensure it succeeds
   - If either fails, ask user if they want to proceed anyway or fix issues first
   
3. **Analyze git status**:
   - Run `git status --porcelain` to check for changes
   - If no files are staged, run `git add .` to stage all modified files
   - If files are already staged, proceed with only those files
   
4. **Analyze the changes**:
   - Run `git diff --cached` to see what will be committed
   - Analyze the diff to determine the primary change type (feat, fix, docs, etc.)
   - Identify the main scope and purpose of the changes
   
5. **Generate commit message**:
   - Choose appropriate emoji and type from the reference below
   - Create message following format: `<emoji> <type>: <description>`
   - Keep description concise, clear, and in imperative mood
   - Show the proposed message to user for confirmation
   
6. **Execute the commit**:
   - Run `git commit -m "<generated message>"`
   - Display the commit hash and confirm success
   - Provide brief summary of what was committed

## Commit Message Guidelines

When generating commit messages, follow these rules:

- **Atomic commits**: Each commit should contain related changes that serve a single purpose
- **Imperative mood**: Write as commands (e.g., "add feature" not "added feature")
- **Concise first line**: Keep under 72 characters
- **Conventional format**: Use `<emoji> <type>: <description>` where type is one of:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation changes
  - `style`: Code style changes (formatting, etc.)
  - `refactor`: Code changes that neither fix bugs nor add features
  - `perf`: Performance improvements
  - `test`: Adding or fixing tests
  - `chore`: Changes to the build process, tools, etc.
- **Present tense, imperative mood**: Write commit messages as commands (e.g., "add feature" not "added feature")
- **Concise first line**: Keep the first line under 72 characters
- **Emoji**: Use standard mapping (common types only, infer the rest from context):
  - ✨ feat | 🐛 fix | 📝 docs | 💄 style | ♻️ refactor | ⚡️ perf | ✅ test | 🔧 chore

## Reference: Good Commit Examples
- `✨ feat: add user auth system`
- `🐛 fix: resolve memory leak in renderer`
- `📝 docs: update API endpoints documentation`

## Agent Behavior Notes

- **Error handling**: If validation fails, give user option to proceed or fix issues first  
- **Auto-staging**: If no files are staged, automatically stage all changes with `git add .`
- **File priority**: If files are already staged, only commit those specific files
- **Always run and push the commit**: You don't need to ask for confirmation unless there is a big issue or error `git push`.
- **Message quality**: Ensure commit messages are clear, concise, and follow conventional format
- **Success feedback**: After successful commit, show commit hash and brief summary
