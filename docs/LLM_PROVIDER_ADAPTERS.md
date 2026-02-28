# LLM Provider Adapters
Support:
- OpenAI
- Anthropic
Future: Gemini, Perplexity, Copilot.

All prompts must return JSON:
{
  "answerText": "...",
  "citations": [{ "url": "...", "title": "..." }]
}