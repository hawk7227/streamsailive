# Editor Core Six Import Notes

Imported these six systems from streamsai-editor-main:

1. Full Studio shell
2. Right EditorPro system
3. Center Preview Runtime
4. iframe/proxy inspection layer
5. GitHub file system logic
6. Staging / diff system

Target branch: feature/editorpro-import

Test routes:
- /studio-pro-test = full shell
- /editor-pro-test = right EditorPro only
- /preview = center preview runtime

Not imported in this slice:
- Quality Gate system
- old chat runtime/routes
- mobile chat app
- generation pipeline state

This slice still should not touch the working /streams-ai chat runtime.
