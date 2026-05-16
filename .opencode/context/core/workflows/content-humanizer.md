<!-- Context: core/workflows/content-humanizer | Priority: critical | Version: 1.0 -->

# Content Humanizer Policy

**Purpose**: All AI-generated content intended for human readers MUST be processed through the Humanizer skill to remove AI writing patterns before delivery.

> **Rule**: Before delivering any article, web page content, documentation, marketing copy, blog post, or any text meant to be read by humans → load and apply the Humanizer skill.

## When to Use

This policy applies to ALL content generated for human consumption:

| Content Type | Required | Agents |
|---|---|---|
| Articles, blog posts, essays | ✅ Always | copywriter, openagent |
| Web page content / UI copy | ✅ Always | frontend-specialist, copywriter |
| Documentation / READMEs | ✅ Always | documentation, technical-writer |
| Marketing / promotional copy | ✅ Always | copywriter |
| Email content | ✅ Always | copywriter |
| Social media posts | ✅ Always | copywriter |
| Code comments / docstrings | ℹ️ When verbose | coder-agent |
| Technical reports | ✅ Always | technical-writer |
| Generated prose (any) | ✅ Always | all agents |

## How to Apply

### Step 1: Load the Skill

Before generating human-facing content, load the Humanizer skill:

```javascript
skill("humanizer")
```

### Step 2: Generate Content

Write your content naturally, following the project's quality standards.

### Step 3: Humanize

After generating the initial draft, use the Humanizer skill to:
1. Run the draft through the **29 pattern detectors** (AI vocabulary, passive voice, em dash overuse, promotional language, etc.)
2. Apply the **voice calibration** — if the user has provided a writing sample, match their style
3. Inject **personality and soul** — add opinions, vary rhythm, acknowledge complexity
4. Run the **final anti-AI audit** — ask "What makes this obviously AI generated?" and fix remaining tells

### Step 4: Deliver

Present the humanized final version. You may optionally include a summary of changes made.

## Key Patterns to Fix (Summary)

### Remove:
- Significance inflation ("pivotal moment", "transformative", "groundbreaking")
- Promotional language ("nestled", "breathtaking", "vibrant")
- AI vocabulary ("showcase", "underscore", "testament", "landscape")
- Copula avoidance ("serves as", "features", "boasts" → "is", "has")
- Em dash overuse (use commas or periods instead)
- Rule of three forcing (don't force ideas into groups of 3)
- Synonym cycling (don't vary words just to avoid repetition)
- Emojis in content 🚀
- Chatbot artifacts ("I hope this helps!", "Let me know if...")
- Curly quotes (use straight quotes)
- Filler phrases ("In order to" → "To", "Due to the fact that" → "Because")
- Excessive hedging ("could potentially possibly" → "may")
- Generic conclusions ("The future looks bright" → specific facts)
- Signposting ("Let's dive in", "Here's what you need to know")
- Fragmented headers (don't restate the heading in the first sentence)

### Add:
- **Voice and personality** — opinions, varied rhythm, mixed feelings
- **Specifics over vagueness** — real facts, concrete examples
- **Active voice** — name the actor when it helps clarity
- **Natural sentence structure** — short and long sentences mixed

## Skill Location

The Humanizer skill is installed at:
`.opencode/skills/humanizer/SKILL.md`

## Integration with Existing Workflows

### For OpenAgent (orchestrator):
When delegating content-generation tasks to subagents (copywriter, frontend-specialist, technical-writer, documentation), include in your delegation prompt:
```
IMPORTANT: After generating the content, load and apply the humanizer skill 
(.opencode/skills/humanizer/SKILL.md) to remove AI writing patterns before delivery.
```

### For content subagents (copywriter, technical-writer, documentation):
When executing content-generation tasks, load the Humanizer skill before finalizing:
```javascript
skill("humanizer")
```

### For frontend-specialist:
When generating web page content, UI copy, or any text displayed to users, humanize it using the same process.

## Validation

Before delivering any content, verify:
- [ ] Skill loaded and applied
- [ ] No AI vocabulary words remain
- [ ] No promotional language
- [ ] No chatbot artifacts
- [ ] Natural sentence rhythm
- [ ] Specific facts over vague claims
- [ ] Appropriate tone for context
- [ ] Final anti-AI audit pass completed
