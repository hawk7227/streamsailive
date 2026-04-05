Zip 2 multimodel patch

Drop these files into zip 2.

Included:
- real model-aware router
- fal.ai multi-model provider from zip 1
- DB model tracking migration
- /api/generations model wiring
- pipeline/test model selectors

Image models:
- openai-image
- seedream-lite-v5
- nano-banana-2

Video models:
- kling-v3
- veo-3.1

Notes:
- OpenAI image path is preserved through zip 2's existing enforced image flow in /api/generations when provider=openai.
- fal video/image requests use the lifted zip 1 fal provider and store exact model names in generations.model.
- Apply the Supabase migration before testing.