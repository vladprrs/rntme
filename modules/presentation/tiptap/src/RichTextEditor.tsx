import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useOperationRegistry } from '@rntme/ui-runtime/client';

export type RichTextEditorProps = {
  placeholder?: string | undefined;
  __rntmeElementId?: string | undefined;
};

export function RichTextEditor(props: RichTextEditorProps): React.ReactElement {
  const { register } = useOperationRegistry();
  const editor = useEditor({
    extensions: [StarterKit, Image],
    immediatelyRender: false,
    content: '<p></p>',
  });

  React.useEffect(() => {
    const id = props.__rntmeElementId;
    if (!id || !editor) return undefined;
    return register(id, {
      toggleBold: () => {
        editor.chain().focus().toggleBold().run();
      },
      toggleItalic: () => {
        editor.chain().focus().toggleItalic().run();
      },
      insertImage: (p: Record<string, unknown>) => {
        const src = p.src as string;
        editor.chain().focus().setImage({ src }).run();
      },
    });
  }, [editor, props.__rntmeElementId, register]);

  return React.createElement(
    'div',
    { className: 'rntme-richtext', 'data-placeholder': props.placeholder ?? '' },
    React.createElement(EditorContent, { editor }),
  );
}
