# thoughts-translator
A Marinara extension for translating AI reasoning (thoughts) into Korean.

The 2.4.0 extension uses the current chat's AI translation connection and its own
reasoning translation instructions. Its translation request is separate from
Marinara Translation Tools, so that extension's presets, glossary, other
instructions, and previous conversation context do not affect Model Thoughts.
The chat's legacy translation prompt is not used. Translations are requested
only when the user clicks the button; repeated text is cached in memory.
If a standalone writing cue such as "Let me write..." is the final line,
the 2.4.0 extension excludes that line from the translation request while
leaving the full original visible. The request counts show the excluded length.

Downloads:
- GitHub Releases
